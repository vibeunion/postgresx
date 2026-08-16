# Benchmark

Generated at: 2026-08-16T04:08:19.807Z

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
| KV write | 35,816.21 | 0.374 | 6,887.07 | 1.86 | 0.19x | 15,969.74 | 0.810 | 0.45x |
| KV write (batch) | 152,870.21 | 1.37 | 41,957.1 | 5.36 | 0.27x | 66,356.96 | 3.45 | 0.43x |
| KV read | 48,457.87 | 0.314 | 9,065.49 | 1.56 | 0.19x | 20,190.36 | 0.663 | 0.42x |
| KV read (batch) | 295,441.18 | 0.616 | 100,561 | 2.17 | 0.34x | 128,282.8 | 1.44 | 0.43x |
| KV read (hot cache) L1 | 46,111.9 | 0.308 | 1,104,060.46 | 0.012 | 23.94x | 555,134.42 | 0.024 | 12.04x |
| KV read (99% L1) L1 | 53,275.15 | 0.276 | 555,304.28 | 0.004 | 10.42x | 458,229.94 | 0.009 | 8.6x |
| KV read (95% L1) L1 | 51,191.07 | 0.308 | 201,845.39 | 0.001 | 3.94x | 271,135.74 | 0.001 | 5.3x |
| KV read (90% L1) L1 | 42,898.21 | 0.290 | 161,056.09 | 0.001 | 3.75x | 297,447.57 | 0.001 | 6.93x |
| Counter increment | 49,573.74 | 0.302 | 10,049.01 | 1.42 | 0.2x | 12,654.51 | 1.02 | 0.26x |
| Set add | 56,031.2 | 0.258 | 4,501.64 | 2.43 | 0.08x | 6,929.84 | 1.60 | 0.12x |
| Pub/Sub publish | 60,288.32 | 0.261 | 15,629.18 | 0.893 | 0.26x | 19,117.93 | 0.794 | 0.32x |

## L1 Read Cache

These rows isolate pgredis local memory cache behavior. Mixed hit-rate rows include PostgreSQL misses and are closer to real cache-aside usage than the 100% hot-cache row.

| Operation | Redis | Redis p50 ms | Node PG L1 | Node PG L1 p50 ms | Node PG L1/Redis | Bun PG L1 | Bun PG L1 p50 ms | Bun PG L1/Redis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV read (hot cache) | 46,111.9 | 0.308 | 1,104,060.46 | 0.012 | 23.94x | 555,134.42 | 0.024 | 12.04x |
| KV read (99% L1) | 53,275.15 | 0.276 | 555,304.28 | 0.004 | 10.42x | 458,229.94 | 0.009 | 8.6x |
| KV read (95% L1) | 51,191.07 | 0.308 | 201,845.39 | 0.001 | 3.94x | 271,135.74 | 0.001 | 5.3x |
| KV read (90% L1) | 42,898.21 | 0.290 | 161,056.09 | 0.001 | 3.75x | 297,447.57 | 0.001 | 6.93x |

## L2 Backend Path

These rows disable pgredis L1 and measure direct PostgreSQL access. They are useful for fallback sizing and regression tracking, not as the main cache-hit comparison.

| Operation | Redis | Redis p50 ms | Node PG L2 | Node PG L2 p50 ms | Node PG L2/Redis | Bun PG L2 | Bun PG L2 p50 ms | Bun PG L2/Redis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV write | 35,816.21 | 0.374 | 6,887.07 | 1.86 | 0.19x | 15,969.74 | 0.810 | 0.45x |
| KV write (batch) | 152,870.21 | 1.37 | 41,957.1 | 5.36 | 0.27x | 66,356.96 | 3.45 | 0.43x |
| KV read | 48,457.87 | 0.314 | 9,065.49 | 1.56 | 0.19x | 20,190.36 | 0.663 | 0.42x |
| KV read (batch) | 295,441.18 | 0.616 | 100,561 | 2.17 | 0.34x | 128,282.8 | 1.44 | 0.43x |
| KV read (hot cache) | 46,111.9 | 0.308 | 10,218.55 | 1.41 | 0.22x | 24,469.32 | 0.575 | 0.53x |
| KV read (99% L1) | 53,275.15 | 0.276 | 10,179.84 | 1.44 | 0.19x | 23,045.53 | 0.604 | 0.43x |
| KV read (95% L1) | 51,191.07 | 0.308 | 10,524.22 | 1.37 | 0.21x | 22,708.49 | 0.616 | 0.44x |
| KV read (90% L1) | 42,898.21 | 0.290 | 9,536.51 | 1.49 | 0.22x | 22,653.82 | 0.631 | 0.53x |
| Counter increment | 49,573.74 | 0.302 | 10,049.01 | 1.42 | 0.2x | 12,654.51 | 1.02 | 0.26x |
| Set add | 56,031.2 | 0.258 | 4,501.64 | 2.43 | 0.08x | 6,929.84 | 1.60 | 0.12x |
| Pub/Sub publish | 60,288.32 | 0.261 | 15,629.18 | 0.893 | 0.26x | 19,117.93 | 0.794 | 0.32x |

## Details

| Operation | Backend | Iterations | Concurrency | Duration ms | Ops/sec | Avg ms | p50 ms | p99 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV write | Node.js + Redis | 2000 | 16 | 55.84 | 35,816.21 | 0.440 | 0.374 | 1.75 |
| KV write (batch) | Node.js + Redis | 2000 | 16 | 13.08 | 152,870.21 | 1.55 | 1.37 | 2.84 |
| KV read | Node.js + Redis | 2000 | 16 | 41.27 | 48,457.87 | 0.328 | 0.314 | 0.617 |
| KV read (batch) | Node.js + Redis | 2000 | 16 | 6.77 | 295,441.18 | 0.801 | 0.616 | 2.42 |
| KV read (hot cache) | Node.js + Redis | 2000 | 16 | 43.37 | 46,111.9 | 0.345 | 0.308 | 1.25 |
| KV read (99% L1) | Node.js + Redis | 2000 | 16 | 37.54 | 53,275.15 | 0.298 | 0.276 | 0.458 |
| KV read (95% L1) | Node.js + Redis | 2000 | 16 | 39.07 | 51,191.07 | 0.311 | 0.308 | 0.426 |
| KV read (90% L1) | Node.js + Redis | 2000 | 16 | 46.62 | 42,898.21 | 0.371 | 0.290 | 2.42 |
| Counter increment | Node.js + Redis | 2000 | 16 | 40.34 | 49,573.74 | 0.319 | 0.302 | 0.627 |
| Set add | Node.js + Redis | 2000 | 16 | 35.69 | 56,031.2 | 0.283 | 0.258 | 0.503 |
| Pub/Sub publish | Node.js + Redis | 2000 | 16 | 33.17 | 60,288.32 | 0.263 | 0.261 | 0.360 |
| KV write | Node.js + PostgreSQL | 2000 | 16 | 290.4 | 6,887.07 | 2.32 | 1.86 | 6.74 |
| KV write (batch) | Node.js + PostgreSQL | 2000 | 16 | 47.67 | 41,957.1 | 5.95 | 5.36 | 15.09 |
| KV read | Node.js + PostgreSQL | 2000 | 16 | 220.62 | 9,065.49 | 1.76 | 1.56 | 4.90 |
| KV read (batch) | Node.js + PostgreSQL | 2000 | 16 | 19.89 | 100,561 | 2.42 | 2.17 | 5.54 |
| KV read (hot cache) | Node.js + PostgreSQL | 2000 | 16 | 195.72 | 10,218.55 | 1.56 | 1.41 | 3.70 |
| KV read (99% L1) | Node.js + PostgreSQL | 2000 | 16 | 196.47 | 10,179.84 | 1.57 | 1.44 | 3.67 |
| KV read (95% L1) | Node.js + PostgreSQL | 2000 | 16 | 190.04 | 10,524.22 | 1.52 | 1.37 | 3.56 |
| KV read (90% L1) | Node.js + PostgreSQL | 2000 | 16 | 209.72 | 9,536.51 | 1.68 | 1.49 | 5.09 |
| Counter increment | Node.js + PostgreSQL | 2000 | 16 | 199.02 | 10,049.01 | 1.58 | 1.42 | 4.38 |
| Set add | Node.js + PostgreSQL | 2000 | 16 | 444.28 | 4,501.64 | 3.54 | 2.43 | 34.54 |
| Pub/Sub publish | Node.js + PostgreSQL | 2000 | 16 | 127.97 | 15,629.18 | 1.02 | 0.893 | 3.04 |
| KV read (hot cache) | Node.js + PostgreSQL (L1) | 2000 | 16 | 1.81 | 1,104,060.46 | 0.014 | 0.012 | 0.043 |
| KV read (99% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 3.6 | 555,304.28 | 0.025 | 0.004 | 0.549 |
| KV read (95% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 9.91 | 201,845.39 | 0.078 | 0.001 | 2.58 |
| KV read (90% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 12.42 | 161,056.09 | 0.092 | 0.001 | 2.48 |
| KV write | Bun.js + PostgreSQL | 2000 | 16 | 125.24 | 15,969.74 | 0.996 | 0.810 | 3.60 |
| KV write (batch) | Bun.js + PostgreSQL | 2000 | 16 | 30.14 | 66,356.96 | 3.61 | 3.45 | 8.81 |
| KV read | Bun.js + PostgreSQL | 2000 | 16 | 99.06 | 20,190.36 | 0.788 | 0.663 | 2.47 |
| KV read (batch) | Bun.js + PostgreSQL | 2000 | 16 | 15.59 | 128,282.8 | 1.85 | 1.44 | 6.18 |
| KV read (hot cache) | Bun.js + PostgreSQL | 2000 | 16 | 81.74 | 24,469.32 | 0.650 | 0.575 | 1.73 |
| KV read (99% L1) | Bun.js + PostgreSQL | 2000 | 16 | 86.78 | 23,045.53 | 0.687 | 0.604 | 1.77 |
| KV read (95% L1) | Bun.js + PostgreSQL | 2000 | 16 | 88.07 | 22,708.49 | 0.702 | 0.616 | 1.99 |
| KV read (90% L1) | Bun.js + PostgreSQL | 2000 | 16 | 88.29 | 22,653.82 | 0.705 | 0.631 | 2.05 |
| Counter increment | Bun.js + PostgreSQL | 2000 | 16 | 158.05 | 12,654.51 | 1.26 | 1.02 | 4.00 |
| Set add | Bun.js + PostgreSQL | 2000 | 16 | 288.61 | 6,929.84 | 2.30 | 1.60 | 25.79 |
| Pub/Sub publish | Bun.js + PostgreSQL | 2000 | 16 | 104.61 | 19,117.93 | 0.833 | 0.794 | 1.95 |
| KV read (hot cache) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 3.6 | 555,134.42 | 0.028 | 0.024 | 0.082 |
| KV read (99% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 4.36 | 458,229.94 | 0.034 | 0.009 | 0.229 |
| KV read (95% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 7.38 | 271,135.74 | 0.058 | 0.001 | 1.79 |
| KV read (90% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 6.72 | 297,447.57 | 0.053 | 0.001 | 1.41 |

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
