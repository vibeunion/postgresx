import type { NotifyHandler, PgListenerHandle } from "./pubsub";

export interface BunSqlLike {
  unsafe<T = Record<string, unknown>>(query: string, params?: readonly unknown[]): Promise<T[]>;
  begin?<T>(callback: (tx: BunSqlLike) => Promise<T>): Promise<T>;
}

export interface PgKvCacheL1Options {
  max?: number;
  ttlMs?: number;
  /**
   * Cache L2 misses for this many milliseconds so repeated reads of an absent
   * key do not each reach Postgres. Defaults to 0 (disabled). Keep it short
   * (for example 250ms) to bound how long a concurrent write stays hidden; a
   * set/delete notification clears the entry immediately.
   */
  negativeTtlMs?: number;
  /**
   * Evict least-recently-used entries once the approximate cache size exceeds
   * this many bytes. Defaults to 0 (no byte cap; only `max` entries apply).
   */
  maxBytes?: number;
  /**
   * Refuse to cache any single value larger than this many bytes. Defaults to
   * 0 (no per-value limit).
   */
  maxEntryBytes?: number;
}

export interface PgKvCacheNotifyOptions {
  channel?: string;
  enabled?: boolean;
  listener?: PgKvCacheListenerFactory;
  clearL1OnReconnect?: boolean;
  /** Pause L1 reads and fills while the invalidation listener is unhealthy. Defaults to true. */
  pauseOnDisconnect?: boolean;
}

export interface PgKvCacheListenerFactoryOptions {
  channels: string[];
  onNotify: NotifyHandler;
}

export type PgKvCacheListenerFactory = (options: PgKvCacheListenerFactoryOptions) => PgListenerHandle;

export interface PgKvCacheInvalidationOptions {
  clearL1OnReconnect?: boolean;
  /** Pause L1 reads and fills while the invalidation listener is unhealthy. Defaults to true. */
  pauseOnDisconnect?: boolean;
}

export interface PgKvCacheOptions {
  sql: BunSqlLike;
  namespace?: string;
  tableName?: string;
  l1?: false | PgKvCacheL1Options;
  notify?: false | PgKvCacheNotifyOptions;
  instanceId?: string;
  now?: () => number;
  serializer?: PgKvSerializer;
  /**
   * Coalesce concurrent reads of the same key into a single Postgres query.
   * Defaults to true; set to false to issue one query per caller.
   */
  singleflight?: boolean;
}

export interface PgKvSetOptions {
  ttlMs?: number | null;
  notify?: boolean;
  mode?: "always" | "nx" | "xx";
  nx?: boolean;
  xx?: boolean;
}

export interface PgKvCompareAndSwapOptions extends PgKvSetOptions {
  expectedMissing?: boolean;
}

export interface PgKvSchemaOptions {
  unlogged?: boolean;
}

export interface PgKvSerializer {
  serialize(value: unknown): unknown;
  deserialize(value: unknown): unknown;
}

export interface PgKvNotification {
  namespace: string;
  key?: string;
  prefix?: string;
  op: "set" | "delete" | "clearPrefix" | "clearNamespace";
  senderId?: string;
}

export interface PgKvCacheStats {
  namespace: string;
  tableName: string;
  l1Size: number;
  l1Max: number;
  /** Monotonic L1 read hits since the cache was created. */
  l1Hits: number;
  /** Monotonic L1 read misses (absent or expired) since the cache was created. */
  l1Misses: number;
  /** Monotonic reads served from a cached L2 miss (negative cache). */
  l1NegativeHits: number;
  /** True while L1 is bypassed because the invalidation listener is unhealthy. */
  l1Paused: boolean;
  /** Reads currently coalesced into an in-flight query. */
  inflightReads: number;
  /** Monotonic count of reads that joined an in-flight query for the same key. */
  coalescedReads: number;
  /** Approximate bytes currently held by L1 (0 when byte accounting is off). */
  l1Bytes: number;
  /** Configured byte cap, or 0 when unlimited. */
  l1MaxBytes: number;
}

interface L1Entry<T = unknown> {
  value: T;
  expiresAt: number | null;
  negative?: boolean;
  bytes?: number;
}

interface CacheRow {
  key?: string;
  value: unknown;
  expires_at: Date | string | null;
}

const DEFAULT_TABLE_NAME = "pg_kv_cache";
const DEFAULT_NAMESPACE = "default";
const DEFAULT_L1_MAX = 10_000;
const DEFAULT_L1_TTL_MS = 60_000;
const DEFAULT_NOTIFY_CHANNEL = "pg_kv_cache_invalidate";
const textEncoder = new TextEncoder();

function estimateValueBytes(value: unknown): number {
  try {
    const json = JSON.stringify(value);
    return json === undefined ? 0 : textEncoder.encode(json).length;
  } catch {
    return 0;
  }
}

function randomId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function quoteIdentifier(identifier: string): string {
  const trimmed = identifier.trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
    throw new Error(`Invalid SQL identifier: ${identifier}`);
  }
  return `"${trimmed.replaceAll('"', '""')}"`;
}

function quoteQualifiedName(name: string): string {
  const parts = name.split(".").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0 || parts.length > 2) {
    throw new Error(`Invalid SQL table name: ${name}`);
  }
  return parts.map(quoteIdentifier).join(".");
}

function indexName(tableName: string, suffix: string): string {
  const normalized = tableName
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/^_+/, "")
    .slice(0, 42) || DEFAULT_TABLE_NAME;
  return quoteIdentifier(`idx_${normalized}_${suffix}`.slice(0, 63));
}

function jsonValue(value: unknown): string {
  return JSON.stringify(value);
}

function parseValue<T>(value: unknown): T {
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return value as T;
  }
}

function rowExpiresAt(row: CacheRow): number | null {
  if (!row.expires_at) return null;
  if (row.expires_at instanceof Date) return row.expires_at.getTime();
  const time = new Date(row.expires_at).getTime();
  return Number.isFinite(time) ? time : null;
}

function normalizeTtlMs(ttlMs: number | null | undefined): number | null {
  if (ttlMs === null || ttlMs === undefined) return null;
  if (!Number.isFinite(ttlMs)) throw new Error(`Invalid ttlMs: ${ttlMs}`);
  return Math.max(0, Math.floor(ttlMs));
}

function isSerializationFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ("code" in error && error.code === "40001") return true;
  return "cause" in error && isSerializationFailure(error.cause);
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function redisPatternToSqlLike(pattern: string): string {
  let sqlPattern = "";
  for (const char of pattern) {
    if (char === "*") sqlPattern += "%";
    else if (char === "?") sqlPattern += "_";
    else sqlPattern += escapeLike(char);
  }
  return sqlPattern;
}

export class PgKvCache {
  readonly namespace: string;
  readonly tableName: string;
  readonly quotedTableName: string;
  readonly notifyChannel: string;
  readonly instanceId: string;

  private readonly sql: BunSqlLike;
  private readonly now: () => number;
  private readonly l1Enabled: boolean;
  private readonly l1Max: number;
  private readonly l1TtlMs: number;
  private readonly l1NegativeTtlMs: number;
  private readonly l1MaxBytes: number;
  private readonly l1MaxEntryBytes: number;
  private readonly notifyEnabled: boolean;
  private readonly serializer: PgKvSerializer;
  private readonly singleflight: boolean;
  private readonly l1 = new Map<string, L1Entry>();
  private readonly inflight = new Map<string, Promise<unknown>>();
  private l1Generation = 0;
  private l1Hits = 0;
  private l1Misses = 0;
  private l1NegativeHits = 0;
  private l1Paused = false;
  private l1Bytes = 0;
  private coalescedReads = 0;
  private invalidationListener: PgListenerHandle | null = null;
  private invalidationUnsubscribers: Array<() => void> = [];

  constructor(options: PgKvCacheOptions) {
    this.sql = options.sql;
    this.namespace = options.namespace || DEFAULT_NAMESPACE;
    this.tableName = options.tableName || DEFAULT_TABLE_NAME;
    this.quotedTableName = quoteQualifiedName(this.tableName);
    this.now = options.now || Date.now;
    this.instanceId = options.instanceId || randomId();

    this.l1Enabled = options.l1 !== false;
    this.l1Max = options.l1 && options.l1.max !== undefined ? options.l1.max : DEFAULT_L1_MAX;
    this.l1TtlMs = options.l1 && options.l1.ttlMs !== undefined ? options.l1.ttlMs : DEFAULT_L1_TTL_MS;
    this.l1NegativeTtlMs =
      options.l1 && options.l1.negativeTtlMs !== undefined && options.l1.negativeTtlMs > 0
        ? options.l1.negativeTtlMs
        : 0;
    this.l1MaxBytes =
      options.l1 && options.l1.maxBytes !== undefined && options.l1.maxBytes > 0
        ? options.l1.maxBytes
        : 0;
    this.l1MaxEntryBytes =
      options.l1 && options.l1.maxEntryBytes !== undefined && options.l1.maxEntryBytes > 0
        ? options.l1.maxEntryBytes
        : 0;

    this.notifyEnabled = options.notify !== false && options.notify?.enabled !== false;
    this.notifyChannel = options.notify && options.notify.channel ? options.notify.channel : DEFAULT_NOTIFY_CHANNEL;
    this.serializer = options.serializer ?? {
      serialize: (value) => value,
      deserialize: (value) => value
    };
    this.singleflight = options.singleflight !== false;

    const listenerFactory = this.resolveNotifyOptions(options.notify)?.listener;
    if (listenerFactory) {
      this.startInvalidationListener(listenerFactory, {
        clearL1OnReconnect: this.resolveNotifyOptions(options.notify)?.clearL1OnReconnect,
        pauseOnDisconnect: this.resolveNotifyOptions(options.notify)?.pauseOnDisconnect
      });
    }
  }

  async ensureSchema(options: PgKvSchemaOptions = {}): Promise<void> {
    const persistence = options.unlogged === false ? "" : "UNLOGGED ";
    await this.sql.unsafe(`
      CREATE ${persistence}TABLE IF NOT EXISTS ${this.quotedTableName} (
        namespace TEXT NOT NULL,
        key TEXT NOT NULL,
        value JSONB NOT NULL,
        expires_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (namespace, key)
      )
    `);
    await this.sql.unsafe(`
      CREATE INDEX IF NOT EXISTS ${indexName(this.tableName, "expires_at")}
      ON ${this.quotedTableName} (expires_at)
      WHERE expires_at IS NOT NULL
    `);
    await this.sql.unsafe(`
      CREATE INDEX IF NOT EXISTS ${indexName(this.tableName, "namespace_key_pattern")}
      ON ${this.quotedTableName} (namespace, key text_pattern_ops)
    `);
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const cached = this.getL1<T>(key);
    if (cached.hit) return cached.value;
    return this.loadKey<T>(key);
  }

  private loadKey<T>(key: string): Promise<T | null> {
    if (!this.singleflight) return this.readKey<T>(key);
    const existing = this.inflight.get(key);
    if (existing) {
      this.coalescedReads += 1;
      return existing as Promise<T | null>;
    }
    const pending = this.readKey<T>(key).finally(() => {
      if (this.inflight.get(key) === pending) this.inflight.delete(key);
    });
    this.inflight.set(key, pending);
    return pending;
  }

  private async readKey<T = unknown>(key: string): Promise<T | null> {
    const l1Generation = this.l1Generation;

    const rows = await this.sql.unsafe<CacheRow>(
      `SELECT value, expires_at
       FROM ${this.quotedTableName}
       WHERE namespace = $1
         AND key = $2
         AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      [this.namespace, key]
    );
    const row = rows[0];
    if (!row) {
      if (this.l1NegativeTtlMs > 0) this.setNegativeL1(key, l1Generation);
      else this.deleteL1(key);
      return null;
    }

    const value = this.deserialize<T>(row.value);
    this.setL1(key, value, rowExpiresAt(row), l1Generation);
    return value;
  }

  async mget<T = unknown>(keys: readonly string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>();
    const missing: string[] = [];

    for (const key of keys) {
      const cached = this.getL1<T>(key);
      if (cached.hit) {
        if (cached.value !== null) result.set(key, cached.value);
      } else {
        missing.push(key);
      }
    }

    if (missing.length === 0) return result;
    const l1Generation = this.l1Generation;

    const placeholders = missing.map((_, index) => `$${index + 2}`).join(", ");
    const rows = await this.sql.unsafe<CacheRow>(
      `SELECT key, value, expires_at
       FROM ${this.quotedTableName}
       WHERE namespace = $1
         AND key IN (${placeholders})
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [this.namespace, ...missing]
    );

    for (const row of rows) {
      if (!row.key) continue;
      const value = this.deserialize<T>(row.value);
      result.set(row.key, value);
      this.setL1(row.key, value, rowExpiresAt(row), l1Generation);
    }

    for (const key of missing) {
      if (result.has(key)) continue;
      if (this.l1NegativeTtlMs > 0) this.setNegativeL1(key, l1Generation);
      else this.deleteL1(key);
    }

    return result;
  }

  async set<T = unknown>(key: string, value: T, options: PgKvSetOptions = {}): Promise<boolean> {
    const ttlMs = normalizeTtlMs(options.ttlMs);
    const mode = this.resolveSetMode(options);
    const serialized = jsonValue(this.serializer.serialize(value));
    const rows = mode === "xx"
      ? await this.sql.unsafe<{ key: string }>(
          `UPDATE ${this.quotedTableName}
           SET value = $3::jsonb,
               expires_at = CASE WHEN $4::bigint IS NULL THEN NULL ELSE NOW() + ($4::bigint * INTERVAL '1 millisecond') END,
               updated_at = NOW()
           WHERE namespace = $1
             AND key = $2
             AND (expires_at IS NULL OR expires_at > NOW())
           RETURNING key`,
          [this.namespace, key, serialized, ttlMs]
        )
      : await this.sql.unsafe<{ key: string }>(
          `INSERT INTO ${this.quotedTableName} (namespace, key, value, expires_at, updated_at)
           VALUES (
             $1,
             $2,
             $3::jsonb,
             CASE WHEN $4::bigint IS NULL THEN NULL ELSE NOW() + ($4::bigint * INTERVAL '1 millisecond') END,
             NOW()
           )
           ON CONFLICT (namespace, key) DO UPDATE
           SET value = EXCLUDED.value,
               expires_at = EXCLUDED.expires_at,
               updated_at = NOW()
           ${mode === "nx" ? `WHERE ${this.quotedTableName}.expires_at IS NOT NULL AND ${this.quotedTableName}.expires_at <= NOW()` : ""}
           RETURNING key`,
          [this.namespace, key, serialized, ttlMs]
        );

    const written = rows.length > 0;
    if (!written) {
      if (mode === "xx") this.deleteL1(key);
      return false;
    }

    this.setL1(key, value, ttlMs === null ? null : this.now() + ttlMs);
    if (options.notify !== false) await this.publish({ op: "set", key });
    return true;
  }

  async mset<T = unknown>(entries: Iterable<readonly [string, T]>, options: PgKvSetOptions = {}): Promise<void> {
    const values = Array.from(entries);
    if (values.length === 0) return;

    const ttlMs = normalizeTtlMs(options.ttlMs);
    const params: unknown[] = [];
    const groups = values.map(([key, value], index) => {
      const base = index * 4;
      params.push(this.namespace, key, jsonValue(this.serializer.serialize(value)), ttlMs);
      return `($${base + 1}, $${base + 2}, $${base + 3}::jsonb, CASE WHEN $${base + 4}::bigint IS NULL THEN NULL ELSE NOW() + ($${base + 4}::bigint * INTERVAL '1 millisecond') END, NOW())`;
    }).join(", ");

    await this.sql.unsafe(
      `INSERT INTO ${this.quotedTableName} (namespace, key, value, expires_at, updated_at)
       VALUES ${groups}
       ON CONFLICT (namespace, key) DO UPDATE
       SET value = EXCLUDED.value,
           expires_at = EXCLUDED.expires_at,
           updated_at = NOW()`,
      params
    );

    const expiresAt = ttlMs === null ? null : this.now() + ttlMs;
    for (const [key, value] of values) {
      this.setL1(key, value, expiresAt);
    }
    if (options.notify !== false) await this.publish({ op: "clearNamespace" });
  }

  async delete(key: string, options: { notify?: boolean } = {}): Promise<boolean> {
    const rows = await this.sql.unsafe<{ key: string }>(
      `DELETE FROM ${this.quotedTableName}
       WHERE namespace = $1 AND key = $2
       RETURNING key`,
      [this.namespace, key]
    );
    this.deleteL1(key);
    if (options.notify !== false) await this.publish({ op: "delete", key });
    return rows.length > 0;
  }

  async clearPrefix(prefix: string, options: { notify?: boolean } = {}): Promise<number> {
    const rows = await this.sql.unsafe<{ key: string }>(
      `DELETE FROM ${this.quotedTableName}
       WHERE namespace = $1 AND key LIKE $2 ESCAPE '\\'
       RETURNING key`,
      [this.namespace, `${escapeLike(prefix)}%`]
    );
    for (const row of rows) this.deleteL1(row.key);
    if (options.notify !== false) await this.publish({ op: "clearPrefix", prefix });
    return rows.length;
  }

  async clearNamespace(options: { notify?: boolean } = {}): Promise<number> {
    const rows = await this.sql.unsafe<{ key: string }>(
      `DELETE FROM ${this.quotedTableName}
       WHERE namespace = $1
       RETURNING key`,
      [this.namespace]
    );
    this.invalidateAll();
    if (options.notify !== false) await this.publish({ op: "clearNamespace" });
    return rows.length;
  }

  async cleanupExpired(limit = 1000): Promise<number> {
    const rows = await this.sql.unsafe<{ namespace: string; key: string }>(
      `DELETE FROM ${this.quotedTableName}
       WHERE ctid IN (
         SELECT ctid
         FROM ${this.quotedTableName}
         WHERE namespace = $1
           AND expires_at IS NOT NULL
           AND expires_at <= NOW()
         LIMIT $2
       )
       RETURNING namespace, key`,
      [this.namespace, Math.max(1, Math.floor(limit))]
    );
    for (const row of rows) {
      if (row.namespace === this.namespace) this.deleteL1(row.key);
    }
    this.cleanupL1();
    return rows.length;
  }

  async compareAndSwap<T = unknown>(
    key: string,
    expected: T | null,
    next: T,
    options: PgKvCompareAndSwapOptions = {}
  ): Promise<boolean> {
    const ttlMs = normalizeTtlMs(options.ttlMs);
    const nextValue = jsonValue(this.serializer.serialize(next));
    const expectedValue = expected === null ? null : jsonValue(this.serializer.serialize(expected));
    const expectedMissing = options.expectedMissing ?? expected === null;

    const rows = expectedMissing
      ? await this.sql.unsafe<{ key: string }>(
          `INSERT INTO ${this.quotedTableName} (namespace, key, value, expires_at, updated_at)
           VALUES (
             $1,
             $2,
             $3::jsonb,
             CASE WHEN $4::bigint IS NULL THEN NULL ELSE NOW() + ($4::bigint * INTERVAL '1 millisecond') END,
             NOW()
           )
           ON CONFLICT (namespace, key) DO UPDATE
           SET value = EXCLUDED.value,
               expires_at = EXCLUDED.expires_at,
               updated_at = NOW()
           WHERE ${this.quotedTableName}.expires_at IS NOT NULL AND ${this.quotedTableName}.expires_at <= NOW()
           RETURNING key`,
          [this.namespace, key, nextValue, ttlMs]
        )
      : await this.sql.unsafe<{ key: string }>(
          `UPDATE ${this.quotedTableName}
           SET value = $4::jsonb,
               expires_at = CASE WHEN $5::bigint IS NULL THEN NULL ELSE NOW() + ($5::bigint * INTERVAL '1 millisecond') END,
               updated_at = NOW()
           WHERE namespace = $1
             AND key = $2
             AND value = $3::jsonb
             AND (expires_at IS NULL OR expires_at > NOW())
           RETURNING key`,
          [this.namespace, key, expectedValue, nextValue, ttlMs]
        );

    const written = rows.length > 0;
    if (!written) {
      this.deleteL1(key);
      return false;
    }

    this.setL1(key, next, ttlMs === null ? null : this.now() + ttlMs);
    if (options.notify !== false) await this.publish({ op: "set", key });
    return true;
  }

  async expire(key: string, ttlMs: number, options: { notify?: boolean } = {}): Promise<boolean> {
    const normalizedTtlMs = normalizeTtlMs(ttlMs) ?? 0;
    const rows = await this.sql.unsafe<{ key: string; value: unknown; expires_at: Date | string | null }>(
      `UPDATE ${this.quotedTableName}
       SET expires_at = NOW() + ($3::bigint * INTERVAL '1 millisecond'),
           updated_at = NOW()
       WHERE namespace = $1
         AND key = $2
         AND (expires_at IS NULL OR expires_at > NOW())
       RETURNING key, value, expires_at`,
      [this.namespace, key, normalizedTtlMs]
    );
    const row = rows[0];
    if (!row) {
      this.deleteL1(key);
      return false;
    }
    this.setL1(key, this.deserialize(row.value), rowExpiresAt(row));
    if (options.notify !== false) await this.publish({ op: "set", key });
    return true;
  }

  async persist(key: string, options: { notify?: boolean } = {}): Promise<boolean> {
    const rows = await this.sql.unsafe<{ key: string; value: unknown; expires_at: Date | string | null }>(
      `UPDATE ${this.quotedTableName}
       SET expires_at = NULL,
           updated_at = NOW()
       WHERE namespace = $1
         AND key = $2
         AND (expires_at IS NULL OR expires_at > NOW())
       RETURNING key, value, expires_at`,
      [this.namespace, key]
    );
    const row = rows[0];
    if (!row) {
      this.deleteL1(key);
      return false;
    }
    this.setL1(key, this.deserialize(row.value), null);
    if (options.notify !== false) await this.publish({ op: "set", key });
    return true;
  }

  async touch(key: string): Promise<boolean> {
    const rows = await this.sql.unsafe<{ key: string }>(
      `UPDATE ${this.quotedTableName}
       SET updated_at = NOW()
       WHERE namespace = $1
         AND key = $2
         AND (expires_at IS NULL OR expires_at > NOW())
       RETURNING key`,
      [this.namespace, key]
    );
    return rows.length > 0;
  }

  async ttl(key: string): Promise<number | null> {
    const rows = await this.sql.unsafe<{ ttl_ms: number | string | null }>(
      `SELECT CASE
         WHEN expires_at IS NULL THEN NULL
         ELSE GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (expires_at - NOW())) * 1000))::bigint
       END AS ttl_ms
       FROM ${this.quotedTableName}
       WHERE namespace = $1
         AND key = $2
         AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      [this.namespace, key]
    );
    return rows[0]?.ttl_ms === null || rows[0]?.ttl_ms === undefined ? null : Number(rows[0].ttl_ms);
  }

  invalidate(key: string): void {
    this.deleteL1(key);
  }

  invalidateAll(): void {
    this.l1Generation += 1;
    this.clearL1();
  }

  startInvalidationListener(
    factory: PgKvCacheListenerFactory,
    options: PgKvCacheInvalidationOptions = {}
  ): PgListenerHandle {
    this.stopInvalidationListener();

    const listener = factory({
      channels: [this.notifyChannel],
      onNotify: (channel, payload) => {
        if (channel === this.notifyChannel) this.handleNotification(payload);
      }
    });

    const unsubscribers: Array<() => void> = [];
    if (options.pauseOnDisconnect !== false) {
      // While no live LISTEN is confirmed, remote writes may be missed; L1 must
      // neither serve nor accept entries until "connected" fires again.
      unsubscribers.push(listener.on("close", () => this.pauseL1()));
      unsubscribers.push(listener.on("error", () => this.pauseL1()));
      unsubscribers.push(listener.on("reconnect", () => this.pauseL1()));
      unsubscribers.push(listener.on("connected", () => this.resumeL1()));
    }
    if (options.clearL1OnReconnect !== false) {
      unsubscribers.push(listener.on("reconnect", () => this.invalidateAll()));
    }

    this.invalidationListener = listener;
    this.invalidationUnsubscribers = unsubscribers;

    if (options.pauseOnDisconnect !== false) {
      // A freshly attached listener either confirms a live LISTEN (resume, dropping
      // anything cached while unwatched) or is unhealthy (stay paused).
      if (listener.getHealth().connected) {
        this.resumeL1();
      } else {
        this.pauseL1();
      }
    }
    return listener;
  }

  stopInvalidationListener(): void {
    const listener = this.invalidationListener;
    const unsubscribers = this.invalidationUnsubscribers;
    this.invalidationListener = null;
    this.invalidationUnsubscribers = [];
    for (const unsubscribe of unsubscribers) unsubscribe();
    listener?.close();
  }

  private pauseL1(): void {
    this.l1Paused = true;
    this.l1Generation += 1;
    this.clearL1();
  }

  private resumeL1(): void {
    this.l1Generation += 1;
    this.clearL1();
    this.l1Paused = false;
  }

  private clearL1(): void {
    this.l1.clear();
    this.l1Bytes = 0;
  }

  handleNotification(payload: string | PgKvNotification): boolean {
    const event = typeof payload === "string" ? this.parseNotification(payload) : payload;
    if (!event || event.namespace !== this.namespace || event.senderId === this.instanceId) return false;

    if (event.op === "set" || event.op === "delete") {
      if (event.key) this.deleteL1(event.key);
      return true;
    }
    if (event.op === "clearPrefix") {
      if (!event.prefix) return false;
      this.l1Generation += 1;
      for (const key of this.l1.keys()) {
        if (key.startsWith(event.prefix)) this.removeEntry(key);
      }
      return true;
    }
    if (event.op === "clearNamespace") {
      this.invalidateAll();
      return true;
    }
    return false;
  }


  async keys(pattern = "*", limit = 1000): Promise<string[]> {
    const like = redisPatternToSqlLike(pattern);
    const rows = await this.sql.unsafe<{ key: string }>(
      `SELECT key FROM ${this.quotedTableName}
       WHERE namespace = $1 AND key LIKE $2 ESCAPE '\\'
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY key ASC LIMIT $3`,
      [this.namespace, like, Math.max(1, Math.floor(limit))]
    );
    return rows.map((r) => r.key);
  }

  async scan(cursor: string | null = null, count = 100, pattern = "*"): Promise<{ cursor: string | null; keys: string[] }> {
    const like = redisPatternToSqlLike(pattern);
    const limit = Math.max(1, Math.floor(count));
    const rows = await this.sql.unsafe<{ key: string }>(
      `SELECT key FROM ${this.quotedTableName}
       WHERE namespace = $1 AND key LIKE $2 ESCAPE '\\'
         AND key > COALESCE($3::text, '')
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY key ASC LIMIT $4`,
      [this.namespace, like, cursor, limit]
    );
    return {
      cursor: rows.length === limit ? rows[rows.length - 1]!.key : null,
      keys: rows.map((r) => r.key)
    };
  }

  async rename(key: string, newKey: string): Promise<boolean> {
    if (key === newKey) return await this.get(key) !== null;
    const rows = await this.sql.unsafe<{ key: string }>(
      `WITH source AS (
         SELECT key
         FROM ${this.quotedTableName}
         WHERE namespace = $1
           AND key = $2
           AND (expires_at IS NULL OR expires_at > NOW())
         LIMIT 1
       ), deleted_target AS (
         DELETE FROM ${this.quotedTableName}
         WHERE namespace = $1
           AND key = $3
           AND EXISTS (SELECT 1 FROM source)
       )
       UPDATE ${this.quotedTableName}
       SET key = $3,
           updated_at = NOW()
       WHERE namespace = $1
         AND key = $2
         AND EXISTS (SELECT 1 FROM source)
       RETURNING key`,
      [this.namespace, key, newKey]
    );
    if (rows.length === 0) return false;
    this.deleteL1(key);
    this.deleteL1(newKey);
    return true;
  }

  async type(key: string): Promise<"string" | "none"> {
    const value = await this.get(key);
    return value === null ? "none" : "string";
  }

  async unlink(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    const placeholders = keys.map((_, i) => `$${i + 2}`).join(", ");
    const rows = await this.sql.unsafe<{ key: string }>(
      `DELETE FROM ${this.quotedTableName}
       WHERE namespace = $1 AND key IN (${placeholders})
       RETURNING key`,
      [this.namespace, ...keys]
    );
    for (const r of rows) this.deleteL1(r.key);
    return rows.length;
  }

  async setex<T = unknown>(key: string, seconds: number, value: T): Promise<"OK"> {
    await this.set(key, value, { ttlMs: seconds * 1000 });
    return "OK";
  }

  async psetex<T = unknown>(key: string, milliseconds: number, value: T): Promise<"OK"> {
    await this.set(key, value, { ttlMs: milliseconds });
    return "OK";
  }

  async setnx<T = unknown>(key: string, value: T): Promise<number> {
    const written = await this.set(key, value, { nx: true });
    return written ? 1 : 0;
  }

  async getset<T = unknown>(key: string, value: T): Promise<T | null> {
    const serialized = jsonValue(this.serializer.serialize(value));
    const l1Generation = this.l1Generation;
    const oldValue = await this.runSerializable(async (tx) => {
      const rows = await tx.unsafe<CacheRow>(
        `SELECT value, expires_at
         FROM ${this.quotedTableName}
         WHERE namespace = $1
           AND key = $2
           AND (expires_at IS NULL OR expires_at > NOW())
         FOR UPDATE`,
        [this.namespace, key]
      );

      await tx.unsafe(
        `INSERT INTO ${this.quotedTableName} (namespace, key, value, expires_at, updated_at)
         VALUES ($1, $2, $3::jsonb, NULL, NOW())
         ON CONFLICT (namespace, key) DO UPDATE
         SET value = EXCLUDED.value,
             expires_at = NULL,
             updated_at = NOW()`,
        [this.namespace, key, serialized]
      );

      return rows[0] ? this.deserialize<T>(rows[0].value) : null;
    });

    this.setL1(key, value, null, l1Generation);
    await this.publish({ op: "set", key });
    return oldValue;
  }

  async getdel<T = unknown>(key: string): Promise<T | null> {
    const rows = await this.sql.unsafe<{ value: unknown; is_live: boolean }>(
      `WITH deleted AS (
         DELETE FROM ${this.quotedTableName}
         WHERE namespace = $1 AND key = $2
         RETURNING value, expires_at
       )
       SELECT value,
              (expires_at IS NULL OR expires_at > NOW()) AS is_live
       FROM deleted`,
      [this.namespace, key]
    );
    const row = rows[0];
    this.deleteL1(key);
    if (!row) return null;
    await this.publish({ op: "delete", key });
    return row.is_live ? this.deserialize<T>(row.value) : null;
  }

  stats(): PgKvCacheStats {
    this.cleanupL1();
    return {
      namespace: this.namespace,
      tableName: this.tableName,
      l1Size: this.l1.size,
      l1Max: this.l1Max,
      l1Hits: this.l1Hits,
      l1Misses: this.l1Misses,
      l1NegativeHits: this.l1NegativeHits,
      l1Paused: this.l1Paused,
      inflightReads: this.inflight.size,
      coalescedReads: this.coalescedReads,
      l1Bytes: this.l1Bytes,
      l1MaxBytes: this.l1MaxBytes
    };
  }

  private async publish(event: Omit<PgKvNotification, "namespace" | "senderId">): Promise<void> {
    if (!this.notifyEnabled) return;
    const payload: PgKvNotification = {
      namespace: this.namespace,
      senderId: this.instanceId,
      ...event
    };
    await this.sql.unsafe("SELECT pg_notify($1, $2)", [this.notifyChannel, JSON.stringify(payload)]);
  }

  private async runSerializable<T>(operation: (tx: BunSqlLike) => Promise<T>): Promise<T> {
    const begin = this.sql.begin?.bind(this.sql);
    if (!begin) {
      throw new Error("PgKvCache.getset requires a transaction-capable sql adapter");
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await begin(async (tx) => {
          await tx.unsafe("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
          return operation(tx);
        });
      } catch (error) {
        if (!isSerializationFailure(error) || attempt === 2) throw error;
      }
    }

    throw new Error("PgKvCache serializable transaction retry exhausted");
  }

  private deserialize<T>(value: unknown): T {
    return this.serializer.deserialize(parseValue(value)) as T;
  }

  private resolveSetMode(options: PgKvSetOptions): "always" | "nx" | "xx" {
    if (options.nx && options.xx) throw new Error("PgKvCache.set cannot use both nx and xx");
    if (options.nx) return "nx";
    if (options.xx) return "xx";
    return options.mode ?? "always";
  }

  private resolveNotifyOptions(
    options: false | PgKvCacheNotifyOptions | undefined
  ): PgKvCacheNotifyOptions | undefined {
    return options === false ? undefined : options;
  }

  private parseNotification(payload: string): PgKvNotification | null {
    try {
      const value = JSON.parse(payload) as PgKvNotification;
      if (!value || typeof value !== "object") return null;
      return value;
    } catch {
      return null;
    }
  }

  private getL1<T>(key: string): { hit: true; value: T | null } | { hit: false } {
    if (!this.l1Enabled || this.l1Paused) return { hit: false };
    const entry = this.l1.get(key);
    if (!entry) {
      this.l1Misses += 1;
      return { hit: false };
    }
    if (entry.expiresAt !== null && entry.expiresAt <= this.now()) {
      this.removeEntry(key);
      this.l1Misses += 1;
      return { hit: false };
    }
    if (entry.negative) {
      this.l1NegativeHits += 1;
    } else {
      this.l1Hits += 1;
    }
    this.l1.delete(key);
    this.l1.set(key, entry);
    return { hit: true, value: entry.value as T };
  }

  private removeEntry(key: string): void {
    const entry = this.l1.get(key);
    if (!entry) return;
    this.l1.delete(key);
    this.l1Bytes -= entry.bytes ?? 0;
  }

  private tracksBytes(): boolean {
    return this.l1MaxBytes > 0 || this.l1MaxEntryBytes > 0;
  }

  private setNegativeL1(key: string, generation = this.l1Generation): void {
    if (!this.l1Enabled || this.l1Paused || this.l1Max <= 0 || this.l1NegativeTtlMs <= 0) return;
    if (generation !== this.l1Generation) return;
    const expiresAt = this.now() + this.l1NegativeTtlMs;
    this.removeEntry(key);
    this.l1.set(key, { value: null, expiresAt, negative: true, bytes: 0 });
    this.enforceL1Max();
  }

  private setL1<T>(key: string, value: T, l2ExpiresAt: number | null, generation = this.l1Generation): void {
    if (!this.l1Enabled || this.l1Paused || this.l1Max <= 0) return;
    if (generation !== this.l1Generation) return;
    const l1ExpiresAt = this.computeL1ExpiresAt(l2ExpiresAt);
    if (l1ExpiresAt !== null && l1ExpiresAt <= this.now()) {
      this.removeEntry(key);
      return;
    }
    const bytes = this.tracksBytes() ? estimateValueBytes(value) : 0;
    if (this.l1MaxEntryBytes > 0 && bytes > this.l1MaxEntryBytes) {
      this.removeEntry(key);
      return;
    }
    this.removeEntry(key);
    this.l1.set(key, { value, expiresAt: l1ExpiresAt, bytes });
    this.l1Bytes += bytes;
    this.enforceL1Max();
  }

  private computeL1ExpiresAt(l2ExpiresAt: number | null): number | null {
    const localExpiresAt = this.l1TtlMs > 0 ? this.now() + this.l1TtlMs : null;
    if (l2ExpiresAt === null) return localExpiresAt;
    if (localExpiresAt === null) return l2ExpiresAt;
    return Math.min(localExpiresAt, l2ExpiresAt);
  }

  private deleteL1(key: string): void {
    if (!this.l1Enabled) return;
    this.l1Generation += 1;
    this.removeEntry(key);
  }

  private cleanupL1(): void {
    if (!this.l1Enabled) return;
    const now = this.now();
    for (const [key, entry] of this.l1.entries()) {
      if (entry.expiresAt !== null && entry.expiresAt <= now) this.removeEntry(key);
    }
  }

  private enforceL1Max(): void {
    while (this.l1.size > this.l1Max || (this.l1MaxBytes > 0 && this.l1Bytes > this.l1MaxBytes)) {
      const oldest = this.l1.keys().next();
      if (oldest.done) return;
      this.removeEntry(oldest.value);
    }
  }
}

export function createPgKvCache(options: PgKvCacheOptions): PgKvCache {
  return new PgKvCache(options);
}
