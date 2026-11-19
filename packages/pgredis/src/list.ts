import { indexName, quoteQualifiedName, type PgSqlLike } from "./sql";

export interface PgListOptions {
  sql: PgSqlLike;
  namespace?: string;
  tableName?: string;
}

export interface PgListSchemaOptions {
  unlogged?: boolean;
}

export interface PgListScanResult<T = unknown> {
  cursor: number | null;
  values: T[];
}

export interface PgListBlockingPopOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
}

export interface PgListBlockingPopResult<T = unknown> {
  key: string;
  value: T;
}

interface ListRow {
  value: unknown;
}

interface CountRow {
  count: number | string;
}

const DEFAULT_TABLE_NAME = "pgredis_list";
const DEFAULT_NAMESPACE = "default";

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

export class PgList {
  readonly namespace: string;
  readonly tableName: string;
  readonly quotedTableName: string;

  private readonly sql: PgSqlLike;
  private readonly now: () => number;

  constructor(options: PgListOptions & { now?: () => number }) {
    this.sql = options.sql;
    this.namespace = options.namespace || DEFAULT_NAMESPACE;
    this.tableName = options.tableName || DEFAULT_TABLE_NAME;
    this.quotedTableName = quoteQualifiedName(this.tableName);
    this.now = options.now || Date.now;
  }

  async ensureSchema(options: PgListSchemaOptions = {}): Promise<void> {
    const persistence = options.unlogged === false ? "" : "UNLOGGED ";
    await this.sql.unsafe(`
      CREATE ${persistence}TABLE IF NOT EXISTS ${this.quotedTableName} (
        id BIGSERIAL PRIMARY KEY,
        namespace TEXT NOT NULL,
        key TEXT NOT NULL,
        position DOUBLE PRECISION NOT NULL,
        value JSONB NOT NULL,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.sql.unsafe(`
      ALTER TABLE ${this.quotedTableName}
      ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ
    `);
    await this.sql.unsafe(`
      CREATE INDEX IF NOT EXISTS ${indexName(this.tableName, "position")}
      ON ${this.quotedTableName} (namespace, key, position ASC, id ASC)
    `);
    await this.sql.unsafe(`
      CREATE INDEX IF NOT EXISTS ${indexName(this.tableName, "expires_at")}
      ON ${this.quotedTableName} (expires_at)
      WHERE expires_at IS NOT NULL
    `);
  }

  async lpush<T = unknown>(key: string, ...values: T[]): Promise<number> {
    return this.push(key, values, "left");
  }

  async rpush<T = unknown>(key: string, ...values: T[]): Promise<number> {
    return this.push(key, values, "right");
  }

  async lpop<T = unknown>(key: string, count = 1): Promise<T[]> {
    return this.pop<T>(key, count, "ASC");
  }

  async rpop<T = unknown>(key: string, count = 1): Promise<T[]> {
    return this.pop<T>(key, count, "DESC");
  }

  async blpop<T = unknown>(
    keys: string | readonly string[],
    options: PgListBlockingPopOptions = {}
  ): Promise<PgListBlockingPopResult<T> | null> {
    return this.blockingPop<T>(keys, "left", options);
  }

  async brpop<T = unknown>(
    keys: string | readonly string[],
    options: PgListBlockingPopOptions = {}
  ): Promise<PgListBlockingPopResult<T> | null> {
    return this.blockingPop<T>(keys, "right", options);
  }

  async lrange<T = unknown>(key: string, start = 0, stop = -1): Promise<T[]> {
    const limit = stop < 0 ? null : Math.max(0, stop - start + 1);
    const rows = await this.sql.unsafe<ListRow>(
      `SELECT value
       FROM ${this.quotedTableName}
       WHERE namespace = $1 AND key = $2
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY position ASC, id ASC
       OFFSET $3
       LIMIT COALESCE($4::bigint, 9223372036854775807)`,
      [this.namespace, key, Math.max(0, start), limit]
    );
    return rows.map((row) => parseValue<T>(row.value));
  }

  async llen(key: string): Promise<number> {
    const rows = await this.sql.unsafe<CountRow>(
      `SELECT COUNT(*)::bigint AS count
       FROM ${this.quotedTableName}
       WHERE namespace = $1 AND key = $2
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [this.namespace, key]
    );
    return Number(rows[0]?.count ?? 0);
  }

  async lclear(key: string): Promise<number> {
    const rows = await this.sql.unsafe<{ id: string }>(
      `DELETE FROM ${this.quotedTableName}
       WHERE namespace = $1 AND key = $2
       RETURNING id`,
      [this.namespace, key]
    );
    return rows.length;
  }

  private async push<T>(key: string, values: T[], side: "left" | "right"): Promise<number> {
    if (values.length === 0) return this.llen(key);
    // Positions must stay ordered, so anchor the batch past the edge of the
    // list instead of at the clock: two pushes in the same millisecond used to
    // collide and fall back to id order, which put the newer batch first. The
    // subquery sees the pre-statement snapshot, so every row of this batch
    // shares one anchor.
    const nowParam = `$${values.length * 3 + 1}`;
    const anchor = side === "left"
      ? `(SELECT LEAST(COALESCE(MIN(position) - 1, ${nowParam}::double precision), ${nowParam}::double precision) FROM ${this.quotedTableName} WHERE namespace = $1 AND key = $2)`
      : `(SELECT GREATEST(COALESCE(MAX(position) + 1, ${nowParam}::double precision), ${nowParam}::double precision) FROM ${this.quotedTableName} WHERE namespace = $1 AND key = $2)`;
    const params: unknown[] = [];
    const groups = values.map((value, index) => {
      // LPUSH puts the last argument at the head, RPUSH the first at the tail.
      const position = side === "left"
        ? `${anchor} - ${values.length - 1 - index}`
        : `${anchor} + ${index}`;
      const paramIndex = index * 3;
      params.push(this.namespace, key, jsonValue(value));
      return `($${paramIndex + 1}, $${paramIndex + 2}, ${position}, $${paramIndex + 3}::jsonb, (SELECT MAX(expires_at) FROM ${this.quotedTableName} WHERE namespace = $${paramIndex + 1} AND key = $${paramIndex + 2}), NOW())`;
    }).join(", ");
    params.push(this.now());

    await this.sql.unsafe(
      `INSERT INTO ${this.quotedTableName} (namespace, key, position, value, expires_at, created_at)
       VALUES ${groups}`,
      params
    );
    return this.llen(key);
  }
  private async pop<T>(key: string, count: number, direction: "ASC" | "DESC"): Promise<T[]> {
    const limit = Math.max(1, Math.floor(count));
    const rows = await this.sql.unsafe<ListRow>(
      `WITH picked AS (
         SELECT id, value, position
         FROM ${this.quotedTableName}
         WHERE namespace = $1 AND key = $2
           AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY position ${direction}, id ${direction}
         LIMIT $3
       ), deleted AS (
         DELETE FROM ${this.quotedTableName} target
         USING picked
         WHERE target.id = picked.id
         RETURNING picked.value, picked.position
       )
       SELECT value
       FROM deleted
       ORDER BY position ${direction}`,
      [this.namespace, key, limit]
    );
    return rows.map((row) => parseValue<T>(row.value));
  }

  private async blockingPop<T>(
    keys: string | readonly string[],
    side: "left" | "right",
    options: PgListBlockingPopOptions
  ): Promise<PgListBlockingPopResult<T> | null> {
    const listKeys = typeof keys === "string" ? [keys] : [...keys];
    if (listKeys.length === 0) return null;
    const timeoutMs = options.timeoutMs ?? 0;
    const pollIntervalMs = Math.max(1, Math.floor(options.pollIntervalMs ?? 100));
    const deadline = timeoutMs <= 0 ? null : this.now() + timeoutMs;

    while (true) {
      for (const key of listKeys) {
        const values = side === "left" ? await this.lpop<T>(key, 1) : await this.rpop<T>(key, 1);
        if (values.length > 0) return { key, value: values[0]! };
      }

      if (deadline !== null && this.now() >= deadline) return null;
      const delayMs = deadline === null ? pollIntervalMs : Math.min(pollIntervalMs, Math.max(0, deadline - this.now()));
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  async lscan<T = unknown>(key: string, cursor: number | null = null, count = 100): Promise<PgListScanResult<T>> {
    const limit = Math.max(1, Math.floor(count));
    const rows = await this.sql.unsafe<{ position: number | string; value: unknown }>(
      `SELECT position, value
       FROM ${this.quotedTableName}
       WHERE namespace = $1
         AND key = $2
         AND position > COALESCE($3::double precision, '-Infinity'::double precision)
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY position ASC, id ASC
       LIMIT $4`,
      [this.namespace, key, cursor, limit]
    );
    return {
      cursor: rows.length === limit ? Number(rows[rows.length - 1]!.position) : null,
      values: rows.map((row) => parseValue<T>(row.value))
    };
  }

  async expire(key: string, ttlMs: number): Promise<number> {
    const rows = await this.sql.unsafe<{ id: string }>(
      `UPDATE ${this.quotedTableName}
       SET expires_at = NOW() + ($3::bigint * INTERVAL '1 millisecond')
       WHERE namespace = $1 AND key = $2
       RETURNING id`,
      [this.namespace, key, Math.max(0, Math.floor(ttlMs))]
    );
    return rows.length;
  }

  async persist(key: string): Promise<number> {
    const rows = await this.sql.unsafe<{ id: string }>(
      `UPDATE ${this.quotedTableName}
       SET expires_at = NULL
       WHERE namespace = $1 AND key = $2
       RETURNING id`,
      [this.namespace, key]
    );
    return rows.length;
  }

  async ttl(key: string): Promise<number | null> {
    const rows = await this.sql.unsafe<{ ttl_ms: number | string | null }>(
      `SELECT CASE
         WHEN MAX(expires_at) IS NULL THEN NULL
         ELSE GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (MAX(expires_at) - NOW())) * 1000))::bigint
       END AS ttl_ms
       FROM ${this.quotedTableName}
       WHERE namespace = $1 AND key = $2`,
      [this.namespace, key]
    );
    return rows[0]?.ttl_ms === null || rows[0]?.ttl_ms === undefined ? null : Number(rows[0].ttl_ms);
  }

  async cleanupExpired(limit = 1000): Promise<number> {
    const rows = await this.sql.unsafe<{ id: string }>(
      `DELETE FROM ${this.quotedTableName}
       WHERE ctid IN (
         SELECT ctid
         FROM ${this.quotedTableName}
         WHERE expires_at IS NOT NULL AND expires_at <= NOW()
         LIMIT $1
       )
       RETURNING id`,
      [Math.max(1, Math.floor(limit))]
    );
    return rows.length;
  }
}

export function createPgList(options: PgListOptions): PgList {
  return new PgList(options);
}
