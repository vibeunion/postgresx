import { describe, expect, test } from "bun:test";
import {
  PgKvCache,
  type BunSqlLike,
  type PgKvCacheListenerFactoryOptions,
  type PgKvNotification
} from "./kv-cache";
import type { PgListenerEvents, PgListenerHandle, PgListenerHealth } from "./pubsub";

interface StoredValue {
  value: unknown;
  expiresAt: number | null;
}

class MockSql implements BunSqlLike {
  now = 1_000;
  beginCalls = 0;
  readonly rows = new Map<string, StoredValue>();
  readonly queries: Array<{ query: string; params: readonly unknown[]; inTransaction: boolean }> = [];
  readonly notifications: PgKvNotification[] = [];
  private transactionDepth = 0;

  async begin<T>(callback: (tx: BunSqlLike) => Promise<T>): Promise<T> {
    this.beginCalls += 1;
    this.transactionDepth += 1;
    try {
      return await callback(this);
    } finally {
      this.transactionDepth -= 1;
    }
  }

  async unsafe<T = Record<string, unknown>>(query: string, params: readonly unknown[] = []): Promise<T[]> {
    this.queries.push({ query, params, inTransaction: this.transactionDepth > 0 });
    const normalized = query.replace(/\s+/g, " ").trim().toUpperCase();

    if (normalized.startsWith("CREATE")) return [] as T[];
    if (normalized.startsWith("SET TRANSACTION")) return [] as T[];

    if (normalized.startsWith("SELECT PG_NOTIFY")) {
      this.notifications.push(JSON.parse(String(params[1])) as PgKvNotification);
      return [] as T[];
    }

    if (normalized.startsWith("INSERT INTO")) {
      // NX mode: ON CONFLICT ... WHERE expired - skip if row exists and is not expired
      if (normalized.includes("EXPIRES_AT IS NOT NULL") && normalized.includes("EXPIRES_AT <=")) {
        const namespace = String(params[0]);
        const key = String(params[1]);
        const existing = this.getLiveRow(namespace, key);
        if (existing) return [] as T[];
      }
      const stride = normalized.includes("$3::JSONB, NULL, NOW()") ? 3 : 4;
      for (let index = 0; index < params.length; index += stride) {
        const namespace = String(params[index]);
        const key = String(params[index + 1]);
        const value = JSON.parse(String(params[index + 2])) as unknown;
        const ttlMs = stride === 3 || params[index + 3] === null ? null : Number(params[index + 3]);
        this.rows.set(this.rowKey(namespace, key), {
          value,
          expiresAt: ttlMs === null ? null : this.now + ttlMs
        });
      }
      return [{ key: String(params[1]) }] as T[];
    }

    if (normalized.startsWith("UPDATE")) {
      const namespace = String(params[0]);
      const key = String(params[1]);
      const compoundKey = this.rowKey(namespace, key);
      const row = this.getLiveRow(namespace, key);
      if (!row) return [] as T[];

      if (normalized.includes("VALUE = $3::JSONB") || normalized.includes("VALUE = $4::JSONB")) {
        const valueParam = normalized.includes("VALUE = $3::JSONB") ? 2 : 3;
        const ttlParam = normalized.includes("VALUE = $3::JSONB") ? 3 : 4;
        const expectedParam = normalized.includes("VALUE = $4::JSONB") ? 2 : null;
        if (expectedParam !== null && JSON.stringify(row.value) !== String(params[expectedParam])) return [] as T[];
        const ttlMs = params[ttlParam] === null ? null : Number(params[ttlParam]);
        const value = JSON.parse(String(params[valueParam])) as unknown;
        this.rows.set(compoundKey, {
          value,
          expiresAt: ttlMs === null ? null : this.now + ttlMs
        });
        return [{ key, value, expires_at: this.toDate(ttlMs === null ? null : this.now + ttlMs) }] as T[];
      }

      if (normalized.includes("EXPIRES_AT = NOW()")) {
        const ttlMs = Number(params[2]);
        row.expiresAt = this.now + ttlMs;
        return [{ key, value: row.value, expires_at: this.toDate(row.expiresAt) }] as T[];
      }

      if (normalized.includes("EXPIRES_AT = NULL")) {
        row.expiresAt = null;
        return [{ key, value: row.value, expires_at: null }] as T[];
      }

      return [{ key }] as T[];
    }

    if (normalized.startsWith("SELECT VALUE")) {
      const namespace = String(params[0]);
      const key = String(params[1]);
      const row = this.getLiveRow(namespace, key);
      return (row ? [{ value: row.value, expires_at: this.toDate(row.expiresAt) }] : []) as T[];
    }

    if (normalized.startsWith("SELECT KEY, VALUE")) {
      const namespace = String(params[0]);
      const keys = params.slice(1).map(String);
      return keys.flatMap((key) => {
        const row = this.getLiveRow(namespace, key);
        return row ? [{ key, value: row.value, expires_at: this.toDate(row.expiresAt) }] : [];
      }) as T[];
    }

    if (normalized.startsWith("SELECT KEY FROM")) {
      const namespace = String(params[0]);
      const pattern = this.likePatternToRegExp(String(params[1]));
      const cursor = params.length > 3 ? String(params[2] ?? "") : "";
      const limit = Number(params[params.length - 1] ?? 1000);
      const rows = Array.from(this.rows.keys())
        .flatMap((compoundKey) => {
          const [rowNamespace, key] = compoundKey.split("\0");
          const row = this.getLiveRow(rowNamespace!, key!);
          return rowNamespace === namespace && row && pattern.test(key!) && key! > cursor ? [key!] : [];
        })
        .sort()
        .slice(0, limit)
        .map((key) => ({ key }));
      return rows as T[];
    }

    if (normalized.startsWith("WITH SOURCE")) {
      const namespace = String(params[0]);
      const key = String(params[1]);
      const newKey = String(params[2]);
      const row = this.getLiveRow(namespace, key);
      if (!row) return [] as T[];
      this.rows.delete(this.rowKey(namespace, newKey));
      this.rows.delete(this.rowKey(namespace, key));
      this.rows.set(this.rowKey(namespace, newKey), row);
      return [{ key: newKey }] as T[];
    }

    if (normalized.startsWith("WITH DELETED AS")) {
      const namespace = String(params[0]);
      const key = String(params[1]);
      const row = this.rows.get(this.rowKey(namespace, key));
      if (!row) return [] as T[];
      this.rows.delete(this.rowKey(namespace, key));
      return [{
        value: row.value,
        is_live: row.expiresAt === null || row.expiresAt > this.now
      }] as T[];
    }

    if (normalized.startsWith("DELETE FROM") && normalized.includes("EXPIRES_AT IS NOT NULL")) {
      const deleted: Array<{ namespace: string; key: string }> = [];
      for (const [compoundKey, row] of this.rows.entries()) {
        if (row.expiresAt !== null && row.expiresAt <= this.now) {
          const [namespace, key] = compoundKey.split("\0");
          this.rows.delete(compoundKey);
          deleted.push({ namespace: namespace!, key: key! });
        }
      }
      return deleted as T[];
    }

    if (normalized.startsWith("DELETE FROM") && normalized.includes("KEY LIKE")) {
      const namespace = String(params[0]);
      const prefix = String(params[1]).replace(/%$/, "").replace(/\\/g, "");
      const deleted: Array<{ key: string }> = [];
      for (const compoundKey of Array.from(this.rows.keys())) {
        const [rowNamespace, key] = compoundKey.split("\0");
        if (rowNamespace === namespace && key!.startsWith(prefix)) {
          this.rows.delete(compoundKey);
          deleted.push({ key: key! });
        }
      }
      return deleted as T[];
    }

    if (normalized.startsWith("DELETE FROM") && normalized.includes("KEY IN")) {
      const namespace = String(params[0]);
      const keys = params.slice(1).map(String);
      const deleted: Array<{ key: string }> = [];
      for (const key of keys) {
        if (this.rows.delete(this.rowKey(namespace, key))) deleted.push({ key });
      }
      return deleted as T[];
    }

    if (normalized.startsWith("DELETE FROM") && normalized.includes("AND KEY =")) {
      const namespace = String(params[0]);
      const key = String(params[1]);
      const deleted = this.rows.delete(this.rowKey(namespace, key));
      return (deleted ? [{ key }] : []) as T[];
    }

    if (normalized.startsWith("DELETE FROM") && normalized.includes("WHERE NAMESPACE =")) {
      const namespace = String(params[0]);
      const deleted: Array<{ key: string }> = [];
      for (const compoundKey of Array.from(this.rows.keys())) {
        const [rowNamespace, key] = compoundKey.split("\0");
        if (rowNamespace === namespace) {
          this.rows.delete(compoundKey);
          deleted.push({ key: key! });
        }
      }
      return deleted as T[];
    }

    throw new Error(`Unhandled SQL: ${query}`);
  }

  private rowKey(namespace: string, key: string): string {
    return `${namespace}\0${key}`;
  }

  private getLiveRow(namespace: string, key: string): StoredValue | null {
    const row = this.rows.get(this.rowKey(namespace, key));
    if (!row) return null;
    if (row.expiresAt !== null && row.expiresAt <= this.now) return null;
    return row;
  }

  private toDate(expiresAt: number | null): Date | null {
    return expiresAt === null ? null : new Date(expiresAt);
  }

  private likePatternToRegExp(pattern: string): RegExp {
    let source = "^";
    for (let index = 0; index < pattern.length; index++) {
      const char = pattern[index]!;
      if (char === "\\") {
        source += this.escapeRegExp(pattern[++index] ?? "");
      } else if (char === "%") {
        source += ".*";
      } else if (char === "_") {
        source += ".";
      } else {
        source += this.escapeRegExp(char);
      }
    }
    return new RegExp(`${source}$`);
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}

class DelayedReadSql extends MockSql {
  readonly readStarted: Promise<void>;
  private readonly readGate: Promise<void>;
  private markReadStarted!: () => void;
  private releaseReadGate!: () => void;
  private delayNextRead = true;

  constructor() {
    super();
    this.readStarted = new Promise((resolve) => {
      this.markReadStarted = resolve;
    });
    this.readGate = new Promise((resolve) => {
      this.releaseReadGate = resolve;
    });
  }

  releaseRead(): void {
    this.releaseReadGate();
  }

  override async unsafe<T = Record<string, unknown>>(
    query: string,
    params: readonly unknown[] = []
  ): Promise<T[]> {
    const normalized = query.replace(/\s+/g, " ").trim().toUpperCase();
    if (this.delayNextRead && normalized.startsWith("SELECT VALUE")) {
      this.delayNextRead = false;
      this.markReadStarted();
      await this.readGate;
    }
    return super.unsafe<T>(query, params);
  }
}

class FakeListener implements PgListenerHandle {
  closeCalls = 0;
  private readonly listeners = new Map<
    keyof PgListenerEvents,
    Set<(payload: PgListenerEvents[keyof PgListenerEvents]) => void>
  >();

  close(): void {
    this.closeCalls += 1;
  }

  async notify(): Promise<void> {}

  getHealth(): PgListenerHealth {
    return {
      status: this.closeCalls > 0 ? "closed" : "connected",
      connected: this.closeCalls === 0,
      listeningChannels: [],
      queuedQueries: 0,
      activeQuery: false,
      reconnectAttempts: 0,
      lastConnectedAt: null,
      lastMessageAt: null,
      lastNotificationAt: null,
      lastError: null
    };
  }

  on<K extends keyof PgListenerEvents>(
    event: K,
    handler: (payload: PgListenerEvents[K]) => void
  ): () => void {
    const bucket = this.listeners.get(event) ?? new Set();
    bucket.add(handler as (payload: PgListenerEvents[keyof PgListenerEvents]) => void);
    this.listeners.set(event, bucket);
    return () => this.off(event, handler);
  }

  off<K extends keyof PgListenerEvents>(
    event: K,
    handler: (payload: PgListenerEvents[K]) => void
  ): void {
    this.listeners.get(event)?.delete(
      handler as (payload: PgListenerEvents[keyof PgListenerEvents]) => void
    );
  }

  emit<K extends keyof PgListenerEvents>(event: K, payload: PgListenerEvents[K]): void {
    for (const handler of this.listeners.get(event) ?? []) {
      handler(payload);
    }
  }
}

describe("PgKvCache", () => {
  test("creates an unlogged schema with ttl and prefix indexes", async () => {
    const sql = new MockSql();
    const cache = new PgKvCache({ sql, tableName: "public.pg_kv_cache" });

    await cache.ensureSchema();

    expect(sql.queries).toHaveLength(3);
    expect(sql.queries[0]!.query).toContain("CREATE UNLOGGED TABLE");
    expect(sql.queries[1]!.query).toContain("expires_at");
    expect(sql.queries[2]!.query).toContain("text_pattern_ops");
  });

  test("serves fresh values from L1 without reading Postgres again", async () => {
    const sql = new MockSql();
    const cache = new PgKvCache({ sql, namespace: "auth", instanceId: "local" });

    await cache.set("token-a", { userId: 1 }, { ttlMs: 60_000 });
    const queryCountAfterSet = sql.queries.length;
    const value = await cache.get<{ userId: number }>("token-a");

    expect(value).toEqual({ userId: 1 });
    expect(sql.queries).toHaveLength(queryCountAfterSet);
    expect(sql.notifications[0]).toMatchObject({ namespace: "auth", key: "token-a", op: "set" });
  });

  test("falls back to Postgres after L1 ttl expires", async () => {
    const sql = new MockSql();
    const cache = new PgKvCache({ sql, namespace: "auth", l1: { ttlMs: 10 }, now: () => sql.now });

    await cache.set("token-b", { userId: 2 }, { ttlMs: 1_000 });
    sql.now += 20;

    const value = await cache.get<{ userId: number }>("token-b");

    expect(value).toEqual({ userId: 2 });
    expect(sql.queries.some((entry) => entry.query.includes("SELECT value"))).toBe(true);
  });

  test("returns null for expired L2 rows", async () => {
    const sql = new MockSql();
    const cache = new PgKvCache({ sql, namespace: "auth", l1: false, now: () => sql.now });

    await cache.set("token-c", { userId: 3 }, { ttlMs: 5 });
    sql.now += 10;

    await expect(cache.get("token-c")).resolves.toBeNull();
  });

  test("supports mset, mget and prefix clearing", async () => {
    const sql = new MockSql();
    const cache = new PgKvCache({ sql, namespace: "models" });

    await cache.mset([
      ["channel:a", { id: 1 }],
      ["channel:b", { id: 2 }],
      ["option:c", { id: 3 }]
    ]);

    const values = await cache.mget<{ id: number }>(["channel:a", "channel:b", "missing"]);
    expect(values.get("channel:a")).toEqual({ id: 1 });
    expect(values.get("channel:b")).toEqual({ id: 2 });
    expect(values.has("missing")).toBe(false);

    await expect(cache.clearPrefix("channel:")).resolves.toBe(2);
    await expect(cache.get("channel:a")).resolves.toBeNull();
    await expect(cache.get("option:c")).resolves.toEqual({ id: 3 });
  });

  test("supports Redis-style key globbing and cursor scans", async () => {
    const sql = new MockSql();
    const cache = new PgKvCache({ sql, namespace: "models", l1: false });

    await cache.mset([
      ["user:1", { id: 1 }],
      ["user:2", { id: 2 }],
      ["session:1", { id: 3 }]
    ]);

    await expect(cache.keys("user:*")).resolves.toEqual(["user:1", "user:2"]);
    await expect(cache.keys("*:1")).resolves.toEqual(["session:1", "user:1"]);

    const first = await cache.scan(null, 1, "user:*");
    expect(first).toEqual({ cursor: "user:1", keys: ["user:1"] });
    await expect(cache.scan(first.cursor, 10, "user:*")).resolves.toEqual({ cursor: null, keys: ["user:2"] });
  });

  test("rename overwrites the destination key", async () => {
    const sql = new MockSql();
    const cache = new PgKvCache({ sql, namespace: "models", l1: false });

    await cache.set("old", { id: 1 });
    await cache.set("new", { id: 2 });

    await expect(cache.rename("old", "new")).resolves.toBe(true);
    await expect(cache.get("old")).resolves.toBeNull();
    await expect(cache.get("new")).resolves.toEqual({ id: 1 });
    await expect(cache.rename("missing", "newer")).resolves.toBe(false);
  });

  test("applies remote invalidation and ignores self notifications", async () => {
    const sql = new MockSql();
    const cache = new PgKvCache({ sql, namespace: "auth", instanceId: "local" });

    await cache.set("token-d", { userId: 4 });
    expect(cache.stats().l1Size).toBe(1);

    expect(cache.handleNotification({
      namespace: "auth",
      key: "token-d",
      op: "delete",
      senderId: "remote"
    })).toBe(true);
    expect(cache.stats().l1Size).toBe(0);

    await cache.set("token-d", { userId: 4 });
    expect(cache.handleNotification({
      namespace: "auth",
      key: "token-d",
      op: "delete",
      senderId: "local"
    })).toBe(false);
    expect(cache.stats().l1Size).toBe(1);
  });

  test("automatically wires L1 invalidation and owns the listener lifecycle", async () => {
    const sql = new MockSql();
    const listeners: FakeListener[] = [];
    const factoryCalls: PgKvCacheListenerFactoryOptions[] = [];
    const factory = (options: PgKvCacheListenerFactoryOptions): PgListenerHandle => {
      factoryCalls.push(options);
      const listener = new FakeListener();
      listeners.push(listener);
      return listener;
    };
    const cache = new PgKvCache({
      sql,
      namespace: "auth",
      instanceId: "local",
      notify: { channel: "auth_cache_invalidate", listener: factory }
    });

    expect(factoryCalls[0]?.channels).toEqual(["auth_cache_invalidate"]);
    await cache.set("token", { userId: 1 });
    factoryCalls[0]!.onNotify("other_channel", JSON.stringify({
      namespace: "auth",
      key: "token",
      op: "delete",
      senderId: "remote"
    }));
    expect(cache.stats().l1Size).toBe(1);

    factoryCalls[0]!.onNotify("auth_cache_invalidate", JSON.stringify({
      namespace: "auth",
      key: "token",
      op: "delete",
      senderId: "remote"
    }));
    expect(cache.stats().l1Size).toBe(0);

    await cache.set("token", { userId: 1 });
    factoryCalls[0]!.onNotify("auth_cache_invalidate", JSON.stringify({
      namespace: "auth",
      key: "token",
      op: "delete",
      senderId: "local"
    }));
    expect(cache.stats().l1Size).toBe(1);

    listeners[0]!.emit("reconnect", { attempt: 1, delayMs: 10 });
    expect(cache.stats().l1Size).toBe(0);

    const replacement = cache.startInvalidationListener(factory);
    expect(replacement).toBe(listeners[1]);
    expect(listeners[0]!.closeCalls).toBe(1);

    await cache.set("token", { userId: 1 });
    cache.stopInvalidationListener();
    expect(listeners[1]!.closeCalls).toBe(1);
    listeners[1]!.emit("reconnect", { attempt: 2, delayMs: 20 });
    expect(cache.stats().l1Size).toBe(1);
  });

  test("does not repopulate L1 from a read started before reconnect", async () => {
    const sql = new DelayedReadSql();
    const listener = new FakeListener();
    const cache = new PgKvCache({ sql, namespace: "auth" });
    cache.startInvalidationListener(() => listener);
    await cache.set("token", { userId: 1 });
    cache.invalidate("token");

    const pendingRead = cache.get("token");
    await sql.readStarted;
    listener.emit("reconnect", { attempt: 1, delayMs: 10 });
    sql.releaseRead();

    await expect(pendingRead).resolves.toEqual({ userId: 1 });
    expect(cache.stats().l1Size).toBe(0);
  });
});

  test("NX: set only when key is missing", async () => {
    const sql = new MockSql();
    const cache = new PgKvCache({ sql, namespace: "nx" });

    await cache.set("existing", { v: 1 }, { ttlMs: 60_000 });
    // NX on existing key should not overwrite
    const written = await cache.set("existing", { v: 2 }, { nx: true });
    expect(written).toBe(false);
    const val = await cache.get("existing");
    expect(val).toEqual({ v: 1 });
  });

  test("XX: set only when key exists", async () => {
    const sql = new MockSql();
    const cache = new PgKvCache({ sql, namespace: "xx" });

    // XX on missing key
    const miss = await cache.set("missing", { v: 1 }, { xx: true });
    expect(miss).toBe(false);

    await cache.set("present", { v: 1 }, { ttlMs: 60_000 });
    const hit = await cache.set("present", { v: 2 }, { xx: true });
    expect(hit).toBe(true);
  });

  test("NX and XX together throws", async () => {
    const sql = new MockSql();
    const cache = new PgKvCache({ sql, namespace: "both" });
    await expect(cache.set("k", { v: 1 }, { nx: true, xx: true })).rejects.toThrow("nx and xx");
  });

  test("compareAndSwap replaces only when expected matches", async () => {
    const sql = new MockSql();
    const cache = new PgKvCache({ sql, namespace: "cas" });

    await cache.set("counter", 1, { ttlMs: 60_000 });
    // CAS with wrong expected value
    const miss = await cache.compareAndSwap("counter", 999, 2);
    expect(miss).toBe(false);

    // CAS with correct expected value
    const hit = await cache.compareAndSwap("counter", 1, 2);
    expect(hit).toBe(true);
    const val = await cache.get("counter");
    expect(val).toBe(2);
  });

  test("compareAndSwap handles missing key with expectedMissing", async () => {
    const sql = new MockSql();
    const cache = new PgKvCache({ sql, namespace: "cas-miss" });

    const hit = await cache.compareAndSwap("new-key", null, { v: 1 }, { expectedMissing: true });
    expect(hit).toBe(true);
  });

  test("touch returns true for existing key, false for missing", async () => {
    const sql = new MockSql();
    const cache = new PgKvCache({ sql, namespace: "touch" });

    expect(await cache.touch("missing")).toBe(false);
    await cache.set("present", { v: 1 }, { ttlMs: 60_000 });
    expect(await cache.touch("present")).toBe(true);
  });

  test("expire updates TTL on existing key", async () => {
    const sql = new MockSql();
    const cache = new PgKvCache({ sql, namespace: "ttl" });

    await cache.set("k", { v: 1 }, { ttlMs: 60_000 });
    const result = await cache.expire("k", 120_000);
    expect(result).toBe(true);
    const miss = await cache.expire("missing", 120_000);
    expect(miss).toBe(false);
  });

  test("persist removes TTL", async () => {
    const sql = new MockSql();
    const cache = new PgKvCache({ sql, namespace: "persist" });

    await cache.set("k", { v: 1 }, { ttlMs: 60_000 });
    const result = await cache.persist("k");
    expect(result).toBe(true);
  });

  test("unlink removes multiple keys", async () => {
    const sql = new MockSql();
    const cache = new PgKvCache({ sql, namespace: "unlink" });

    await cache.mset([["a", 1], ["b", 2], ["c", 3]]);
    const count = await cache.unlink("a", "b");
    expect(count).toBe(2);
  });

  test("setex/psetex/setnx shortcuts work", async () => {
    const sql = new MockSql();
    const cache = new PgKvCache({ sql, namespace: "shortcuts" });

    expect(await cache.setex("k1", 60, "v1")).toBe("OK");
    expect(await cache.psetex("k2", 60000, "v2")).toBe("OK");
    expect(await cache.setnx("k3", "v3")).toBe(1);
  });

  test("getset runs in a serializable transaction and removes the TTL", async () => {
    const sql = new MockSql();
    const cache = new PgKvCache({ sql, namespace: "getset", now: () => sql.now });
    await cache.set("key", "old", { ttlMs: 5_000 });
    sql.queries.length = 0;
    sql.notifications.length = 0;

    await expect(cache.getset("key", "new")).resolves.toBe("old");

    expect(sql.beginCalls).toBe(1);
    const transactionQueries = sql.queries.filter((entry) => entry.inTransaction);
    expect(transactionQueries).toHaveLength(3);
    expect(transactionQueries[0]!.query).toContain("SERIALIZABLE");
    expect(transactionQueries[1]!.query).toContain("FOR UPDATE");
    expect(transactionQueries[2]!.query).toContain("expires_at = NULL");
    expect(sql.notifications).toHaveLength(1);
    expect(sql.notifications[0]).toMatchObject({ op: "set", key: "key" });

    sql.now += 70_000;
    await expect(cache.get("key")).resolves.toBe("new");
  });

  test("getset treats an expired row as missing and atomically replaces it", async () => {
    const sql = new MockSql();
    const cache = new PgKvCache({ sql, namespace: "getset-expired", now: () => sql.now });
    await cache.set("key", "expired", { ttlMs: 5 });
    sql.now += 10;
    sql.queries.length = 0;
    sql.notifications.length = 0;

    await expect(cache.getset("key", "new")).resolves.toBeNull();
    await expect(cache.get("key")).resolves.toBe("new");
    expect(sql.beginCalls).toBe(1);
    expect(sql.notifications).toHaveLength(1);
  });

  test("getset fails closed without transaction support", async () => {
    const backing = new MockSql();
    const sql: BunSqlLike = {
      unsafe<T = Record<string, unknown>>(query: string, params?: readonly unknown[]): Promise<T[]> {
        return backing.unsafe<T>(query, params);
      }
    };
    const cache = new PgKvCache({ sql, namespace: "getset-no-transaction" });

    await expect(cache.getset("key", "new")).rejects.toThrow("transaction-capable");
  });

  test("getdel atomically returns and deletes live values", async () => {
    const sql = new MockSql();
    const cache = new PgKvCache({ sql, namespace: "getdel" });
    await cache.set("key", "old");
    sql.queries.length = 0;
    sql.notifications.length = 0;

    await expect(cache.getdel("key")).resolves.toBe("old");

    const dataQueries = sql.queries.filter((entry) => !entry.query.includes("pg_notify"));
    expect(dataQueries).toHaveLength(1);
    expect(dataQueries[0]!.query).toContain("WITH deleted AS");
    expect(sql.notifications).toHaveLength(1);
    expect(sql.notifications[0]).toMatchObject({ op: "delete", key: "key" });
  });

  test("getdel removes expired rows, returns null, and skips missing notifications", async () => {
    const sql = new MockSql();
    const cache = new PgKvCache({ sql, namespace: "getdel-expired", now: () => sql.now });
    await cache.set("expired", "old", { ttlMs: 5 });
    sql.now += 10;
    sql.queries.length = 0;
    sql.notifications.length = 0;

    await expect(cache.getdel("expired")).resolves.toBeNull();
    expect(sql.rows.has("getdel-expired\0expired")).toBe(false);
    expect(sql.notifications).toHaveLength(1);

    sql.notifications.length = 0;
    await expect(cache.getdel("missing")).resolves.toBeNull();
    expect(sql.notifications).toHaveLength(0);
  });

  test("delete returns boolean", async () => {
    const sql = new MockSql();
    const cache = new PgKvCache({ sql, namespace: "del" });

    await cache.set("k", { v: 1 }, { ttlMs: 60_000 });
    expect(await cache.delete("k")).toBe(true);
    expect(await cache.delete("k")).toBe(false);
  });

  test("cleanupExpired removes expired rows", async () => {
    const sql = new MockSql();
    const cache = new PgKvCache({ sql, namespace: "cleanup", l1: false, now: () => sql.now });

    await cache.set("short-lived", { v: 1 }, { ttlMs: 5 });
    sql.now += 10;
    const deleted = await cache.cleanupExpired();
    expect(deleted).toBe(1);
  });
