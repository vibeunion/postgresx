# Benchmark

Generated at: 2026-09-24T09:52:50.409Z

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
| KV write | 25,775.93 | 0.498 | 4,931.37 | 2.51 | 0.19x | 9,900.07 | 1.42 | 0.38x |
| KV write (batch) | 110,566.05 | 2.04 | 33,449.15 | 6.97 | 0.3x | 55,212.83 | 3.90 | 0.5x |
| KV read | 28,917.82 | 0.491 | 6,175.09 | 2.31 | 0.21x | 14,960.22 | 0.919 | 0.52x |
| KV read (batch) | 203,834.85 | 0.937 | 74,164.33 | 2.74 | 0.36x | 133,222.86 | 1.38 | 0.65x |
| KV read (hot cache) L1 | 33,102.41 | 0.454 | 1,001,247.05 | 0.011 | 30.25x | 1,306,947.8 | 0.010 | 39.48x |
| KV read (99% L1) L1 | 38,951.47 | 0.370 | 392,343.8 | 0.007 | 10.07x | 758,740.31 | 0.003 | 19.48x |
| KV read (95% L1) L1 | 41,425.02 | 0.357 | 170,373.42 | 0.001 | 4.11x | 328,520.99 | 0.001 | 7.93x |
| KV read (90% L1) L1 | 29,710.17 | 0.427 | 130,755.32 | 0.001 | 4.4x | 246,363.22 | 0.001 | 8.29x |
| Counter increment | 40,825.84 | 0.370 | 6,252.14 | 2.08 | 0.15x | 11,356.02 | 1.12 | 0.28x |
| Set add | 43,896.91 | 0.326 | 4,004.41 | 3.26 | 0.09x | 6,235.01 | 1.87 | 0.14x |
| Pub/Sub publish | 45,688.52 | 0.335 | 10,427.45 | 1.39 | 0.23x | 16,162.21 | 0.946 | 0.35x |

## L1 Read Cache

These rows isolate pgredis local memory cache behavior. Mixed hit-rate rows include PostgreSQL misses and are closer to real cache-aside usage than the 100% hot-cache row.

| Operation | Redis | Redis p50 ms | Node PG L1 | Node PG L1 p50 ms | Node PG L1/Redis | Bun PG L1 | Bun PG L1 p50 ms | Bun PG L1/Redis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV read (hot cache) | 33,102.41 | 0.454 | 1,001,247.05 | 0.011 | 30.25x | 1,306,947.8 | 0.010 | 39.48x |
| KV read (99% L1) | 38,951.47 | 0.370 | 392,343.8 | 0.007 | 10.07x | 758,740.31 | 0.003 | 19.48x |
| KV read (95% L1) | 41,425.02 | 0.357 | 170,373.42 | 0.001 | 4.11x | 328,520.99 | 0.001 | 7.93x |
| KV read (90% L1) | 29,710.17 | 0.427 | 130,755.32 | 0.001 | 4.4x | 246,363.22 | 0.001 | 8.29x |

## L2 Backend Path

These rows disable pgredis L1 and measure direct PostgreSQL access. They are useful for fallback sizing and regression tracking, not as the main cache-hit comparison.

| Operation | Redis | Redis p50 ms | Node PG L2 | Node PG L2 p50 ms | Node PG L2/Redis | Bun PG L2 | Bun PG L2 p50 ms | Bun PG L2/Redis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV write | 25,775.93 | 0.498 | 4,931.37 | 2.51 | 0.19x | 9,900.07 | 1.42 | 0.38x |
| KV write (batch) | 110,566.05 | 2.04 | 33,449.15 | 6.97 | 0.3x | 55,212.83 | 3.90 | 0.5x |
| KV read | 28,917.82 | 0.491 | 6,175.09 | 2.31 | 0.21x | 14,960.22 | 0.919 | 0.52x |
| KV read (batch) | 203,834.85 | 0.937 | 74,164.33 | 2.74 | 0.36x | 133,222.86 | 1.38 | 0.65x |
| KV read (hot cache) | 33,102.41 | 0.454 | 11,674.4 | 1.26 | 0.35x | 27,653.19 | 0.558 | 0.84x |
| KV read (99% L1) | 38,951.47 | 0.370 | 10,793.63 | 1.35 | 0.28x | 26,510.11 | 0.566 | 0.68x |
| KV read (95% L1) | 41,425.02 | 0.357 | 9,213.71 | 1.69 | 0.22x | 25,034.96 | 0.607 | 0.6x |
| KV read (90% L1) | 29,710.17 | 0.427 | 8,994.2 | 1.71 | 0.3x | 21,527.32 | 0.686 | 0.72x |
| Counter increment | 40,825.84 | 0.370 | 6,252.14 | 2.08 | 0.15x | 11,356.02 | 1.12 | 0.28x |
| Set add | 43,896.91 | 0.326 | 4,004.41 | 3.26 | 0.09x | 6,235.01 | 1.87 | 0.14x |
| Pub/Sub publish | 45,688.52 | 0.335 | 10,427.45 | 1.39 | 0.23x | 16,162.21 | 0.946 | 0.35x |

## Details

| Operation | Backend | Iterations | Concurrency | Duration ms | Ops/sec | Avg ms | p50 ms | p99 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV write | Node.js + Redis | 2000 | 16 | 77.59 | 25,775.93 | 0.613 | 0.498 | 2.09 |
| KV write (batch) | Node.js + Redis | 2000 | 16 | 18.09 | 110,566.05 | 2.13 | 2.04 | 4.39 |
| KV read | Node.js + Redis | 2000 | 16 | 69.16 | 28,917.82 | 0.550 | 0.491 | 1.10 |
| KV read (batch) | Node.js + Redis | 2000 | 16 | 9.81 | 203,834.85 | 1.15 | 0.937 | 2.98 |
| KV read (hot cache) | Node.js + Redis | 2000 | 16 | 60.42 | 33,102.41 | 0.480 | 0.454 | 1.53 |
| KV read (99% L1) | Node.js + Redis | 2000 | 16 | 51.35 | 38,951.47 | 0.408 | 0.370 | 1.09 |
| KV read (95% L1) | Node.js + Redis | 2000 | 16 | 48.28 | 41,425.02 | 0.382 | 0.357 | 0.685 |
| KV read (90% L1) | Node.js + Redis | 2000 | 16 | 67.32 | 29,710.17 | 0.536 | 0.427 | 2.86 |
| Counter increment | Node.js + Redis | 2000 | 16 | 48.99 | 40,825.84 | 0.387 | 0.370 | 0.822 |
| Set add | Node.js + Redis | 2000 | 16 | 45.56 | 43,896.91 | 0.362 | 0.326 | 0.944 |
| Pub/Sub publish | Node.js + Redis | 2000 | 16 | 43.77 | 45,688.52 | 0.348 | 0.335 | 0.519 |
| KV write | Node.js + PostgreSQL | 2000 | 16 | 405.57 | 4,931.37 | 3.24 | 2.51 | 10.30 |
| KV write (batch) | Node.js + PostgreSQL | 2000 | 16 | 59.79 | 33,449.15 | 7.38 | 6.97 | 20.44 |
| KV read | Node.js + PostgreSQL | 2000 | 16 | 323.88 | 6,175.09 | 2.59 | 2.31 | 6.62 |
| KV read (batch) | Node.js + PostgreSQL | 2000 | 16 | 26.97 | 74,164.33 | 3.28 | 2.74 | 7.28 |
| KV read (hot cache) | Node.js + PostgreSQL | 2000 | 16 | 171.32 | 11,674.4 | 1.37 | 1.26 | 4.44 |
| KV read (99% L1) | Node.js + PostgreSQL | 2000 | 16 | 185.29 | 10,793.63 | 1.48 | 1.35 | 4.93 |
| KV read (95% L1) | Node.js + PostgreSQL | 2000 | 16 | 217.07 | 9,213.71 | 1.73 | 1.69 | 4.94 |
| KV read (90% L1) | Node.js + PostgreSQL | 2000 | 16 | 222.37 | 8,994.2 | 1.78 | 1.71 | 4.39 |
| Counter increment | Node.js + PostgreSQL | 2000 | 16 | 319.89 | 6,252.14 | 2.55 | 2.08 | 6.68 |
| Set add | Node.js + PostgreSQL | 2000 | 16 | 499.45 | 4,004.41 | 3.98 | 3.26 | 17.43 |
| Pub/Sub publish | Node.js + PostgreSQL | 2000 | 16 | 191.8 | 10,427.45 | 1.53 | 1.39 | 3.29 |
| KV read (hot cache) | Node.js + PostgreSQL (L1) | 2000 | 16 | 2 | 1,001,247.05 | 0.015 | 0.011 | 0.054 |
| KV read (99% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 5.1 | 392,343.8 | 0.039 | 0.007 | 0.535 |
| KV read (95% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 11.74 | 170,373.42 | 0.092 | 0.001 | 2.97 |
| KV read (90% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 15.3 | 130,755.32 | 0.121 | 0.001 | 3.37 |
| KV write | Bun.js + PostgreSQL | 2000 | 16 | 202.02 | 9,900.07 | 1.61 | 1.42 | 4.99 |
| KV write (batch) | Bun.js + PostgreSQL | 2000 | 16 | 36.22 | 55,212.83 | 4.35 | 3.90 | 12.50 |
| KV read | Bun.js + PostgreSQL | 2000 | 16 | 133.69 | 14,960.22 | 1.07 | 0.919 | 3.08 |
| KV read (batch) | Bun.js + PostgreSQL | 2000 | 16 | 15.01 | 133,222.86 | 1.79 | 1.38 | 6.03 |
| KV read (hot cache) | Bun.js + PostgreSQL | 2000 | 16 | 72.32 | 27,653.19 | 0.576 | 0.558 | 1.56 |
| KV read (99% L1) | Bun.js + PostgreSQL | 2000 | 16 | 75.44 | 26,510.11 | 0.601 | 0.566 | 1.72 |
| KV read (95% L1) | Bun.js + PostgreSQL | 2000 | 16 | 79.89 | 25,034.96 | 0.635 | 0.607 | 1.93 |
| KV read (90% L1) | Bun.js + PostgreSQL | 2000 | 16 | 92.91 | 21,527.32 | 0.742 | 0.686 | 2.30 |
| Counter increment | Bun.js + PostgreSQL | 2000 | 16 | 176.12 | 11,356.02 | 1.40 | 1.12 | 4.70 |
| Set add | Bun.js + PostgreSQL | 2000 | 16 | 320.77 | 6,235.01 | 2.56 | 1.87 | 21.07 |
| Pub/Sub publish | Bun.js + PostgreSQL | 2000 | 16 | 123.75 | 16,162.21 | 0.986 | 0.946 | 2.02 |
| KV read (hot cache) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 1.53 | 1,306,947.8 | 0.011 | 0.010 | 0.036 |
| KV read (99% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 2.64 | 758,740.31 | 0.020 | 0.003 | 0.316 |
| KV read (95% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 6.09 | 328,520.99 | 0.047 | 0.001 | 1.46 |
| KV read (90% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 8.12 | 246,363.22 | 0.062 | 0.001 | 1.51 |

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
