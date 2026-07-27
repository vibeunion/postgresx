# Benchmark

Generated at: 2026-07-27T02:18:24.999Z

Iterations per case: 2000
Concurrency per case: 16

Services:

- Redis and PostgreSQL run on the same GitHub Actions runner in the benchmark workflow.
- The benchmark workflow runs PostgreSQL 18 with asynchronous I/O enabled via `io_method=worker`.
- The workflow gives both service containers `--cpus 2 --memory 2g`.
- Node.js tests run with `node`; Bun.js tests run with `bun`.
- Node.js PostgreSQL uses a connection pool sized to the benchmark concurrency.
- The recommended cache replacement path is L1 in-process memory backed by PostgreSQL L2 storage. L1 rows show that path; L2 rows show the direct PostgreSQL fallback/backend path.
- The 99%, 95%, and 90% L1 rows intentionally mix local hits with PostgreSQL misses to model realistic cache-aside workloads.
- PostgreSQL tables created by pgredis are `UNLOGGED` by default for cache-like workloads, and the workflow sets `synchronous_commit=off` for the benchmark database. Both choices trade crash-time recency guarantees for cache throughput.

## Application Cache Path

Ops/sec is higher-is-better. This table follows the recommended Redis replacement shape: KV reads use L1 when a matching L1 scenario exists; writes and non-cache primitives use the PostgreSQL backend path.

| Operation | Redis | Redis p50 ms | Node PG | Node PG p50 ms | Node PG/Redis | Bun PG | Bun PG p50 ms | Bun PG/Redis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV write | 35,613.76 | 0.374 | 6,762.46 | 1.86 | 0.19x | 15,475.93 | 0.853 | 0.43x |
| KV write (batch) | 146,597.06 | 1.48 | 45,463.61 | 4.80 | 0.31x | 66,739.87 | 3.44 | 0.46x |
| KV read | 36,780.06 | 0.357 | 9,036.11 | 1.57 | 0.25x | 21,786.28 | 0.613 | 0.59x |
| KV read (batch) | 304,354.61 | 0.613 | 103,744.76 | 2.21 | 0.34x | 136,314.05 | 1.48 | 0.45x |
| KV read (hot cache) L1 | 48,732.82 | 0.308 | 1,360,150.05 | 0.010 | 27.91x | 576,143.57 | 0.024 | 11.82x |
| KV read (99% L1) L1 | 50,722.92 | 0.294 | 622,847.87 | 0.004 | 12.28x | 464,805.62 | 0.009 | 9.16x |
| KV read (95% L1) L1 | 52,092.31 | 0.300 | 239,343.41 | 0.001 | 4.59x | 291,490.5 | 0.001 | 5.6x |
| KV read (90% L1) L1 | 43,950.74 | 0.303 | 181,533.67 | 0.001 | 4.13x | 288,001.8 | 0.001 | 6.55x |
| Counter increment | 49,285.75 | 0.313 | 10,804.98 | 1.32 | 0.22x | 17,786.76 | 0.702 | 0.36x |
| Set add | 55,907.4 | 0.264 | 4,507.65 | 2.26 | 0.08x | 7,121.85 | 1.59 | 0.13x |
| Pub/Sub publish | 62,334.22 | 0.249 | 16,820.43 | 0.884 | 0.27x | 19,365.53 | 0.797 | 0.31x |

## L1 Read Cache

These rows isolate pgredis local memory cache behavior. Mixed hit-rate rows include PostgreSQL misses and are closer to real cache-aside usage than the 100% hot-cache row.

| Operation | Redis | Redis p50 ms | Node PG L1 | Node PG L1 p50 ms | Node PG L1/Redis | Bun PG L1 | Bun PG L1 p50 ms | Bun PG L1/Redis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV read (hot cache) | 48,732.82 | 0.308 | 1,360,150.05 | 0.010 | 27.91x | 576,143.57 | 0.024 | 11.82x |
| KV read (99% L1) | 50,722.92 | 0.294 | 622,847.87 | 0.004 | 12.28x | 464,805.62 | 0.009 | 9.16x |
| KV read (95% L1) | 52,092.31 | 0.300 | 239,343.41 | 0.001 | 4.59x | 291,490.5 | 0.001 | 5.6x |
| KV read (90% L1) | 43,950.74 | 0.303 | 181,533.67 | 0.001 | 4.13x | 288,001.8 | 0.001 | 6.55x |

## L2 Backend Path

These rows disable pgredis L1 and measure direct PostgreSQL access. They are useful for fallback sizing and regression tracking, not as the main cache-hit comparison.

| Operation | Redis | Redis p50 ms | Node PG L2 | Node PG L2 p50 ms | Node PG L2/Redis | Bun PG L2 | Bun PG L2 p50 ms | Bun PG L2/Redis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV write | 35,613.76 | 0.374 | 6,762.46 | 1.86 | 0.19x | 15,475.93 | 0.853 | 0.43x |
| KV write (batch) | 146,597.06 | 1.48 | 45,463.61 | 4.80 | 0.31x | 66,739.87 | 3.44 | 0.46x |
| KV read | 36,780.06 | 0.357 | 9,036.11 | 1.57 | 0.25x | 21,786.28 | 0.613 | 0.59x |
| KV read (batch) | 304,354.61 | 0.613 | 103,744.76 | 2.21 | 0.34x | 136,314.05 | 1.48 | 0.45x |
| KV read (hot cache) | 48,732.82 | 0.308 | 10,485.93 | 1.36 | 0.22x | 24,103.42 | 0.584 | 0.49x |
| KV read (99% L1) | 50,722.92 | 0.294 | 11,405.56 | 1.31 | 0.22x | 22,777.32 | 0.634 | 0.45x |
| KV read (95% L1) | 52,092.31 | 0.300 | 10,848.92 | 1.37 | 0.21x | 22,255.73 | 0.633 | 0.43x |
| KV read (90% L1) | 43,950.74 | 0.303 | 10,446.92 | 1.37 | 0.24x | 23,300.01 | 0.624 | 0.53x |
| Counter increment | 49,285.75 | 0.313 | 10,804.98 | 1.32 | 0.22x | 17,786.76 | 0.702 | 0.36x |
| Set add | 55,907.4 | 0.264 | 4,507.65 | 2.26 | 0.08x | 7,121.85 | 1.59 | 0.13x |
| Pub/Sub publish | 62,334.22 | 0.249 | 16,820.43 | 0.884 | 0.27x | 19,365.53 | 0.797 | 0.31x |

## Details

| Operation | Backend | Iterations | Concurrency | Duration ms | Ops/sec | Avg ms | p50 ms | p99 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV write | Node.js + Redis | 2000 | 16 | 56.16 | 35,613.76 | 0.442 | 0.374 | 1.42 |
| KV write (batch) | Node.js + Redis | 2000 | 16 | 13.64 | 146,597.06 | 1.57 | 1.48 | 3.54 |
| KV read | Node.js + Redis | 2000 | 16 | 54.38 | 36,780.06 | 0.433 | 0.357 | 1.24 |
| KV read (batch) | Node.js + Redis | 2000 | 16 | 6.57 | 304,354.61 | 0.786 | 0.613 | 2.16 |
| KV read (hot cache) | Node.js + Redis | 2000 | 16 | 41.04 | 48,732.82 | 0.326 | 0.308 | 0.696 |
| KV read (99% L1) | Node.js + Redis | 2000 | 16 | 39.43 | 50,722.92 | 0.313 | 0.294 | 0.443 |
| KV read (95% L1) | Node.js + Redis | 2000 | 16 | 38.39 | 52,092.31 | 0.306 | 0.300 | 0.466 |
| KV read (90% L1) | Node.js + Redis | 2000 | 16 | 45.51 | 43,950.74 | 0.363 | 0.303 | 1.98 |
| Counter increment | Node.js + Redis | 2000 | 16 | 40.58 | 49,285.75 | 0.321 | 0.313 | 0.533 |
| Set add | Node.js + Redis | 2000 | 16 | 35.77 | 55,907.4 | 0.284 | 0.264 | 0.551 |
| Pub/Sub publish | Node.js + Redis | 2000 | 16 | 32.09 | 62,334.22 | 0.255 | 0.249 | 0.354 |
| KV write | Node.js + PostgreSQL | 2000 | 16 | 295.75 | 6,762.46 | 2.36 | 1.86 | 6.05 |
| KV write (batch) | Node.js + PostgreSQL | 2000 | 16 | 43.99 | 45,463.61 | 5.36 | 4.80 | 11.52 |
| KV read | Node.js + PostgreSQL | 2000 | 16 | 221.33 | 9,036.11 | 1.77 | 1.57 | 4.45 |
| KV read (batch) | Node.js + PostgreSQL | 2000 | 16 | 19.28 | 103,744.76 | 2.38 | 2.21 | 5.37 |
| KV read (hot cache) | Node.js + PostgreSQL | 2000 | 16 | 190.73 | 10,485.93 | 1.52 | 1.36 | 3.79 |
| KV read (99% L1) | Node.js + PostgreSQL | 2000 | 16 | 175.35 | 11,405.56 | 1.40 | 1.31 | 3.32 |
| KV read (95% L1) | Node.js + PostgreSQL | 2000 | 16 | 184.35 | 10,848.92 | 1.47 | 1.37 | 3.45 |
| KV read (90% L1) | Node.js + PostgreSQL | 2000 | 16 | 191.44 | 10,446.92 | 1.53 | 1.37 | 4.19 |
| Counter increment | Node.js + PostgreSQL | 2000 | 16 | 185.1 | 10,804.98 | 1.48 | 1.32 | 4.17 |
| Set add | Node.js + PostgreSQL | 2000 | 16 | 443.69 | 4,507.65 | 3.54 | 2.26 | 35.61 |
| Pub/Sub publish | Node.js + PostgreSQL | 2000 | 16 | 118.9 | 16,820.43 | 0.948 | 0.884 | 2.21 |
| KV read (hot cache) | Node.js + PostgreSQL (L1) | 2000 | 16 | 1.47 | 1,360,150.05 | 0.011 | 0.010 | 0.034 |
| KV read (99% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 3.21 | 622,847.87 | 0.022 | 0.004 | 0.513 |
| KV read (95% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 8.36 | 239,343.41 | 0.064 | 0.001 | 1.94 |
| KV read (90% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 11.02 | 181,533.67 | 0.087 | 0.001 | 2.51 |
| KV write | Bun.js + PostgreSQL | 2000 | 16 | 129.23 | 15,475.93 | 1.03 | 0.853 | 4.16 |
| KV write (batch) | Bun.js + PostgreSQL | 2000 | 16 | 29.97 | 66,739.87 | 3.61 | 3.44 | 8.08 |
| KV read | Bun.js + PostgreSQL | 2000 | 16 | 91.8 | 21,786.28 | 0.731 | 0.613 | 2.41 |
| KV read (batch) | Bun.js + PostgreSQL | 2000 | 16 | 14.67 | 136,314.05 | 1.75 | 1.48 | 5.30 |
| KV read (hot cache) | Bun.js + PostgreSQL | 2000 | 16 | 82.98 | 24,103.42 | 0.660 | 0.584 | 1.84 |
| KV read (99% L1) | Bun.js + PostgreSQL | 2000 | 16 | 87.81 | 22,777.32 | 0.698 | 0.634 | 1.84 |
| KV read (95% L1) | Bun.js + PostgreSQL | 2000 | 16 | 89.86 | 22,255.73 | 0.717 | 0.633 | 2.36 |
| KV read (90% L1) | Bun.js + PostgreSQL | 2000 | 16 | 85.84 | 23,300.01 | 0.685 | 0.624 | 1.78 |
| Counter increment | Bun.js + PostgreSQL | 2000 | 16 | 112.44 | 17,786.76 | 0.893 | 0.702 | 3.30 |
| Set add | Bun.js + PostgreSQL | 2000 | 16 | 280.83 | 7,121.85 | 2.24 | 1.59 | 27.66 |
| Pub/Sub publish | Bun.js + PostgreSQL | 2000 | 16 | 103.28 | 19,365.53 | 0.822 | 0.797 | 1.93 |
| KV read (hot cache) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 3.47 | 576,143.57 | 0.027 | 0.024 | 0.069 |
| KV read (99% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 4.3 | 464,805.62 | 0.033 | 0.009 | 0.262 |
| KV read (95% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 6.86 | 291,490.5 | 0.052 | 0.001 | 1.57 |
| KV read (90% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 6.94 | 288,001.8 | 0.054 | 0.001 | 1.36 |

Notes:

- Redis tests use key prefixes and do not flush the whole database.
- PostgreSQL tests create temporary benchmark tables and drop them at the end.
- L1 applies only to KV reads. Counter, set, and pub/sub rows are functional replacement paths over PostgreSQL, not local-cache shortcuts.
- Numbers are intended for regression tracking, not universal database sizing.

References behind benchmark design:

- PostgreSQL `UNLOGGED` tables reduce WAL work for cache-like data, with crash-safety and replication trade-offs: https://www.postgresql.org/docs/current/sql-createtable.html
- `synchronous_commit=off` can improve throughput for noncritical transactions while risking loss of recent acknowledged commits after a crash: https://www.postgresql.org/docs/current/runtime-config-wal.html
- PostgreSQL pipeline mode reduces client/server round trips by sending multiple queries before reading prior results: https://www.postgresql.org/docs/current/libpq-pipeline-mode.html
- PostgreSQL bulk-loading guidance favors batching, transactions, prepared statements, and COPY over many independent INSERTs: https://www.postgresql.org/docs/current/populate.html
