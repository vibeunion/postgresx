import { describe, expect, test } from "bun:test";
import { PgAdvisoryLockBusyError } from "./advisory-lock";
import { createPgAdapter } from "./adapters/node";
import { createPgredis } from "./client";
import { createPgNodeListener } from "./adapters/node";
import { quoteIdentifier } from "./sql";

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const integrationTest = databaseUrl ? test : test.skip;

function uniqueName(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function pgredisTableNames(tablePrefix: string): string[] {
  return ["kv", "counter", "hash", "set", "list", "sorted_set", "rate_limit", "outbox"]
    .map((name) => `${tablePrefix}_${name}`);
}

async function dropTables(sql: ReturnType<typeof createPgAdapter>, tablePrefix: string): Promise<void> {
  for (const name of pgredisTableNames(tablePrefix)) {
    await sql.unsafe(`DROP TABLE IF EXISTS ${quoteIdentifier(name)} CASCADE`);
  }
}

function createIntegrationClient(
  sql: ReturnType<typeof createPgAdapter>,
  namespace: string,
  tablePrefix: string
) {
  return createPgredis({
    sql,
    namespace,
    tablePrefix,
    cache: { l1: false, notify: false },
    rateLimit: { limit: 10, windowMs: 1000 }
  });
}

type IntegrationClient = ReturnType<typeof createIntegrationClient>;

async function expectWalBackedTables(
  sql: ReturnType<typeof createPgAdapter>,
  tablePrefix: string
): Promise<void> {
  const relations = await sql.unsafe<{ relname: string; relpersistence: string }>(
    `SELECT relname, relpersistence
     FROM pg_class
     WHERE relname = ANY($1::text[])
     ORDER BY relname`,
    [pgredisTableNames(tablePrefix)]
  );
  expect(relations).toHaveLength(8);
  expect(relations.every(({ relpersistence }) => relpersistence === "p")).toBe(true);
}

async function expectAtomicGetdel(writer: IntegrationClient, contender: IntegrationClient): Promise<void> {
  await writer.cache.set("take-once", { id: 1 }, { notify: false });
  const claims = await Promise.all(Array.from({ length: 16 }, (_, index) => (
    (index % 2 === 0 ? writer : contender).cache.getdel<{ id: number }>("take-once")
  )));
  expect(claims.filter((claim) => claim !== null)).toEqual([{ id: 1 }]);
}

async function expectReconnectPersistence(
  writer: IntegrationClient,
  writerSql: ReturnType<typeof createPgAdapter>,
  namespace: string,
  tablePrefix: string
): Promise<ReturnType<typeof createPgAdapter>> {
  await writer.cache.set("reconnect", "persisted", { notify: false });
  await writerSql.close();
  const reopenedSql = createPgAdapter(databaseUrl!);
  const reopened = createIntegrationClient(reopenedSql, namespace, tablePrefix);
  await expect(reopened.cache.get("reconnect")).resolves.toBe("persisted");
  return reopenedSql;
}

function waitForEvent<T>(register: (handler: (payload: T) => void) => () => void, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    let unsubscribe: (() => void) | null = null;
    const timer = setTimeout(() => {
      unsubscribe?.();
      reject(new Error(`Timed out waiting for event after ${timeoutMs}ms`));
    }, timeoutMs);

    unsubscribe = register((payload) => {
      clearTimeout(timer);
      unsubscribe?.();
      resolve(payload);
    });
  });
}

describe("PostgreSQL integration", () => {
  integrationTest("creates schemas and exercises cache TTL plus collection ordering", async () => {
    const sql = createPgAdapter(databaseUrl!);
    const namespace = uniqueName("ns");
    const tablePrefix = uniqueName("pgredis_it");
    const client = createPgredis({
      sql,
      namespace,
      tablePrefix,
      rateLimit: { limit: 2, windowMs: 1000 }
    });

    try {
      await client.ensureSchema();

      await client.cache.set("session:1", { userId: 1 }, { ttlMs: 0, notify: false });
      await expect(client.cache.get("session:1")).resolves.toBeNull();
      await expect(client.cleanupExpired()).resolves.toMatchObject({ cache: 1 });

      await client.hash.hmset("hash:1", [["b", 2], ["a", 1]]);
      await expect(client.hash.hgetall<number>("hash:1")).resolves.toEqual({ a: 1, b: 2 });
      await expect(client.hash.hscan<number>("hash:1", null, 1)).resolves.toMatchObject({
        cursor: "a",
        entries: [["a", 1]]
      });

      await client.list.rpush("events", "a", "b");
      await client.list.lpush("events", "z");
      await expect(client.list.lrange<string>("events", 0, -1)).resolves.toEqual(["z", "a", "b"]);
      await expect(client.list.rpop<string>("events")).resolves.toEqual(["b"]);

      await expect(client.set.sadd("roles", "admin", "editor")).resolves.toBe(2);
      await expect(client.set.sinter("roles", "missing")).resolves.toEqual([]);

      await expect(client.sortedSet.zadd("scores", 10, "u1")).resolves.toBe(true);
      await expect(client.sortedSet.zadd("scores", 20, "u2")).resolves.toBe(true);
      await expect(client.sortedSet.zrange("scores", 0, -1)).resolves.toEqual(["u1", "u2"]);

      await expect(client.rateLimit?.hit("user:1")).resolves.toMatchObject({ allowed: true, remaining: 1 });
      await expect(client.rateLimit?.hit("user:1")).resolves.toMatchObject({ allowed: true, remaining: 0 });
      await expect(client.rateLimit?.hit("user:1")).resolves.toMatchObject({ allowed: false });
    } finally {
      await dropTables(sql, tablePrefix).catch(() => undefined);
      await sql.close();
    }
  });

  integrationTest("supports KV conditionals, pipeline aliases, outbox stream, and metrics", async () => {
    const sql = createPgAdapter(databaseUrl!);
    const namespace = uniqueName("ns");
    const tablePrefix = uniqueName("pgredis_it");
    const client = createPgredis({ sql, namespace, tablePrefix });

    try {
      await client.ensureSchema();

      await expect(client.cache.set("feature", "a", { nx: true })).resolves.toBe(true);
      await expect(client.cache.set("feature", "b", { nx: true })).resolves.toBe(false);
      await expect(client.cache.get("feature")).resolves.toBe("a");
      await expect(client.cache.set("missing", "x", { xx: true })).resolves.toBe(false);
      await expect(client.cache.compareAndSwap("feature", "a", "c")).resolves.toBe(true);
      await expect(client.cache.compareAndSwap("feature", "a", "d")).resolves.toBe(false);
      await expect(client.cache.expire("feature", 60_000)).resolves.toBe(true);
      await expect(client.cache.ttl("feature")).resolves.toBeGreaterThan(0);
      await expect(client.cache.persist("feature")).resolves.toBe(true);
      await expect(client.cache.ttl("feature")).resolves.toBeNull();

      await client.cache.set("atomic", "old", { ttlMs: 60_000 });
      await expect(client.cache.getset("atomic", "new")).resolves.toBe("old");
      await expect(client.cache.ttl("atomic")).resolves.toBeNull();
      await expect(client.cache.getdel("atomic")).resolves.toBe("new");
      await expect(client.cache.get("atomic")).resolves.toBeNull();

      const batchResult = await client.batch(async (pg) => {
        await pg.cache.set("batch", { ok: true });
        return pg.cache.get<{ ok: boolean }>("batch");
      });
      expect(batchResult).toEqual({ ok: true });

      await expect(
        client.pipeline()
          .set("pipe", 1)
          .get<number>("pipe")
          .incr("pipe-counter")
          .exec()
      ).resolves.toEqual([true, 1, 1]);

      await expect(client.redis.set("alias", "value", { NX: true })).resolves.toBe("OK");
      await expect(client.redis.set("alias", "next", { NX: true })).resolves.toBeNull();
      await expect(client.redis.get("alias")).resolves.toBe("value");

      const id = await client.outbox.append("events", { kind: "created" });
      await expect(client.outbox.read("events")).resolves.toMatchObject([
        { id, stream: "events", payload: { kind: "created" }, processedAt: null }
      ]);
      const claimed = await client.outbox.claim<{ kind: string }>("events", "worker-a");
      expect(claimed).toHaveLength(1);
      expect(claimed[0]).toMatchObject({ id, consumer: "worker-a", deliveryCount: 1 });
      await expect(client.outbox.ack([id])).resolves.toBe(1);
      await expect(client.outbox.pending("events")).resolves.toEqual({ pending: 0, locked: 0 });
      await expect(client.outbox.trim({ stream: "events", limit: 10 })).resolves.toBe(1);

      await client.cache.set("expired", "value", { ttlMs: 0, notify: false });
      await expect(client.cleanupExpired()).resolves.toMatchObject({ cache: 1 });
      const metrics = await client.metrics();
      expect(metrics.cleanup?.totalDeleted).toBeGreaterThanOrEqual(1);
      expect(metrics.tables.some((table) => table.tableName === `${tablePrefix}_kv`)).toBe(true);
    } finally {
      await dropTables(sql, tablePrefix).catch(() => undefined);
      await sql.close();
    }
  });

  integrationTest("supports WAL-backed persistence and atomic take-once operations", async () => {
    const writerSql = createPgAdapter(databaseUrl!);
    const contenderSql = createPgAdapter(databaseUrl!);
    const namespace = uniqueName("ns");
    const tablePrefix = uniqueName("pgredis_it");
    const writer = createIntegrationClient(writerSql, namespace, tablePrefix);
    const contender = createIntegrationClient(contenderSql, namespace, tablePrefix);
    let reopenedSql: ReturnType<typeof createPgAdapter> | null = null;

    try {
      await writer.ensureSchema({ unlogged: false });
      await expectWalBackedTables(writerSql, tablePrefix);
      await expectAtomicGetdel(writer, contender);
      reopenedSql = await expectReconnectPersistence(writer, writerSql, namespace, tablePrefix);
    } finally {
      const cleanupSql = reopenedSql ?? contenderSql;
      await dropTables(cleanupSql, tablePrefix).catch(() => undefined);
      await Promise.allSettled([
        writerSql.close(),
        contenderSql.close(),
        reopenedSql?.close() ?? Promise.resolve()
      ]);
    }
  });

  integrationTest("enforces transaction-scoped advisory lock contention", async () => {
    const holderSql = createPgAdapter(databaseUrl!);
    const contenderSql = createPgAdapter(databaseUrl!);
    const holder = createPgredis({ sql: holderSql });
    const contender = createPgredis({ sql: contenderSql });
    let releaseHolder!: () => void;

    const holderReady = new Promise<void>((resolve) => {
      const holding = holder.locks.withLock(42, async () => {
        resolve();
        await new Promise<void>((release) => {
          releaseHolder = release;
        });
      });
      void holding.finally(() => holderSql.close());
    });

    try {
      await holderReady;
      await expect(
        contender.locks.withLock(42, async () => undefined, { wait: false })
      ).rejects.toBeInstanceOf(PgAdvisoryLockBusyError);
    } finally {
      releaseHolder?.();
      await contenderSql.close();
    }
  });

  integrationTest("receives PostgreSQL NOTIFY messages through the Node listener", async () => {
    const sql = createPgAdapter(databaseUrl!);
    const channel = uniqueName("pgredis_notify");
    const listener = createPgNodeListener(databaseUrl!, {
      channels: [channel],
      healthCheckIntervalMs: 0,
      reconnectDelayMs: 100,
      logger: false
    });

    try {
      await waitForEvent((handler) => listener.on("connected", handler));
      const notification = waitForEvent((handler) => listener.on("notification", handler));
      await sql.unsafe("SELECT pg_notify($1, $2)", [channel, JSON.stringify({ ok: true })]);
      await expect(notification).resolves.toEqual({ channel, payload: "{\"ok\":true}" });
    } finally {
      listener.close();
      await sql.close();
    }
  });

  integrationTest("invalidates the cache L1 through an injected LISTEN connection", async () => {
    const writerSql = createPgAdapter(databaseUrl!);
    const readerSql = createPgAdapter(databaseUrl!);
    const namespace = uniqueName("ns");
    const tablePrefix = uniqueName("pgredis_it");
    const channel = uniqueName("pgredis_cache_invalidate");
    let listener!: ReturnType<typeof createPgNodeListener>;
    const writer = createPgredis({
      sql: writerSql,
      namespace,
      tablePrefix,
      cache: { notify: { channel } }
    });
    const reader = createPgredis({
      sql: readerSql,
      namespace,
      tablePrefix,
      cache: {
        notify: {
          channel,
          listener: ({ channels, onNotify }) => {
            listener = createPgNodeListener(databaseUrl!, {
              channels,
              onNotify,
              healthCheckIntervalMs: 0,
              reconnectDelayMs: 100,
              logger: false
            });
            return listener;
          }
        }
      }
    });

    try {
      const connected = waitForEvent((handler) => listener.on("connected", handler));
      await writer.ensureSchema();
      await connected;
      await writer.cache.set("shared", "old");
      await expect(reader.cache.get("shared")).resolves.toBe("old");

      const notification = waitForEvent((handler) => listener.on("notification", handler));
      await writer.cache.set("shared", "new");
      await notification;
      await expect(reader.cache.get("shared")).resolves.toBe("new");
    } finally {
      reader.cache.stopInvalidationListener();
      await dropTables(writerSql, tablePrefix).catch(() => undefined);
      await writerSql.close();
      await readerSql.close();
    }
  });
});
