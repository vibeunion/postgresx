# Benchmark

Generated at: 2026-07-27T02:28:15.384Z

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
| KV write | 35,418.22 | 0.379 | 6,591.14 | 1.87 | 0.19x | 15,022.02 | 0.928 | 0.42x |
| KV write (batch) | 172,175.3 | 1.25 | 41,121.19 | 5.04 | 0.24x | 69,209.11 | 3.47 | 0.4x |
| KV read | 48,790.05 | 0.311 | 9,393.87 | 1.52 | 0.19x | 20,641.63 | 0.661 | 0.42x |
| KV read (batch) | 281,470.16 | 0.616 | 96,033.38 | 2.34 | 0.34x | 134,448.09 | 1.40 | 0.48x |
| KV read (hot cache) L1 | 47,305.37 | 0.313 | 1,196,961.16 | 0.012 | 25.3x | 586,706.58 | 0.024 | 12.4x |
| KV read (99% L1) L1 | 51,251.81 | 0.287 | 582,950.84 | 0.004 | 11.37x | 413,330.15 | 0.008 | 8.06x |
| KV read (95% L1) L1 | 54,961.36 | 0.283 | 214,900.74 | 0.001 | 3.91x | 345,043.77 | 0.001 | 6.28x |
| KV read (90% L1) L1 | 44,625.75 | 0.279 | 165,400.81 | 0.001 | 3.71x | 269,335.39 | 0.001 | 6.04x |
| Counter increment | 51,397.68 | 0.291 | 10,397.54 | 1.32 | 0.2x | 16,047.99 | 0.774 | 0.31x |
| Set add | 55,300.65 | 0.263 | 4,411.83 | 2.30 | 0.08x | 6,995.62 | 1.60 | 0.13x |
| Pub/Sub publish | 59,733.8 | 0.260 | 16,470.21 | 0.885 | 0.28x | 20,425.9 | 0.722 | 0.34x |

## L1 Read Cache

These rows isolate pgredis local memory cache behavior. Mixed hit-rate rows include PostgreSQL misses and are closer to real cache-aside usage than the 100% hot-cache row.

| Operation | Redis | Redis p50 ms | Node PG L1 | Node PG L1 p50 ms | Node PG L1/Redis | Bun PG L1 | Bun PG L1 p50 ms | Bun PG L1/Redis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV read (hot cache) | 47,305.37 | 0.313 | 1,196,961.16 | 0.012 | 25.3x | 586,706.58 | 0.024 | 12.4x |
| KV read (99% L1) | 51,251.81 | 0.287 | 582,950.84 | 0.004 | 11.37x | 413,330.15 | 0.008 | 8.06x |
| KV read (95% L1) | 54,961.36 | 0.283 | 214,900.74 | 0.001 | 3.91x | 345,043.77 | 0.001 | 6.28x |
| KV read (90% L1) | 44,625.75 | 0.279 | 165,400.81 | 0.001 | 3.71x | 269,335.39 | 0.001 | 6.04x |

## L2 Backend Path

These rows disable pgredis L1 and measure direct PostgreSQL access. They are useful for fallback sizing and regression tracking, not as the main cache-hit comparison.

| Operation | Redis | Redis p50 ms | Node PG L2 | Node PG L2 p50 ms | Node PG L2/Redis | Bun PG L2 | Bun PG L2 p50 ms | Bun PG L2/Redis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV write | 35,418.22 | 0.379 | 6,591.14 | 1.87 | 0.19x | 15,022.02 | 0.928 | 0.42x |
| KV write (batch) | 172,175.3 | 1.25 | 41,121.19 | 5.04 | 0.24x | 69,209.11 | 3.47 | 0.4x |
| KV read | 48,790.05 | 0.311 | 9,393.87 | 1.52 | 0.19x | 20,641.63 | 0.661 | 0.42x |
| KV read (batch) | 281,470.16 | 0.616 | 96,033.38 | 2.34 | 0.34x | 134,448.09 | 1.40 | 0.48x |
| KV read (hot cache) | 47,305.37 | 0.313 | 10,597.53 | 1.38 | 0.22x | 23,556.75 | 0.611 | 0.5x |
| KV read (99% L1) | 51,251.81 | 0.287 | 10,571.94 | 1.35 | 0.21x | 23,151.36 | 0.613 | 0.45x |
| KV read (95% L1) | 54,961.36 | 0.283 | 11,304.23 | 1.27 | 0.21x | 23,707.91 | 0.604 | 0.43x |
| KV read (90% L1) | 44,625.75 | 0.279 | 10,275.89 | 1.36 | 0.23x | 25,765.83 | 0.541 | 0.58x |
| Counter increment | 51,397.68 | 0.291 | 10,397.54 | 1.32 | 0.2x | 16,047.99 | 0.774 | 0.31x |
| Set add | 55,300.65 | 0.263 | 4,411.83 | 2.30 | 0.08x | 6,995.62 | 1.60 | 0.13x |
| Pub/Sub publish | 59,733.8 | 0.260 | 16,470.21 | 0.885 | 0.28x | 20,425.9 | 0.722 | 0.34x |

## Details

| Operation | Backend | Iterations | Concurrency | Duration ms | Ops/sec | Avg ms | p50 ms | p99 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV write | Node.js + Redis | 2000 | 16 | 56.47 | 35,418.22 | 0.445 | 0.379 | 1.42 |
| KV write (batch) | Node.js + Redis | 2000 | 16 | 11.62 | 172,175.3 | 1.36 | 1.25 | 2.36 |
| KV read | Node.js + Redis | 2000 | 16 | 40.99 | 48,790.05 | 0.326 | 0.311 | 0.713 |
| KV read (batch) | Node.js + Redis | 2000 | 16 | 7.11 | 281,470.16 | 0.839 | 0.616 | 2.60 |
| KV read (hot cache) | Node.js + Redis | 2000 | 16 | 42.28 | 47,305.37 | 0.336 | 0.313 | 1.18 |
| KV read (99% L1) | Node.js + Redis | 2000 | 16 | 39.02 | 51,251.81 | 0.310 | 0.287 | 0.516 |
| KV read (95% L1) | Node.js + Redis | 2000 | 16 | 36.39 | 54,961.36 | 0.289 | 0.283 | 0.551 |
| KV read (90% L1) | Node.js + Redis | 2000 | 16 | 44.82 | 44,625.75 | 0.357 | 0.279 | 1.41 |
| Counter increment | Node.js + Redis | 2000 | 16 | 38.91 | 51,397.68 | 0.307 | 0.291 | 0.626 |
| Set add | Node.js + Redis | 2000 | 16 | 36.17 | 55,300.65 | 0.287 | 0.263 | 0.479 |
| Pub/Sub publish | Node.js + Redis | 2000 | 16 | 33.48 | 59,733.8 | 0.265 | 0.260 | 0.376 |
| KV write | Node.js + PostgreSQL | 2000 | 16 | 303.44 | 6,591.14 | 2.42 | 1.87 | 6.95 |
| KV write (batch) | Node.js + PostgreSQL | 2000 | 16 | 48.64 | 41,121.19 | 5.86 | 5.04 | 18.79 |
| KV read | Node.js + PostgreSQL | 2000 | 16 | 212.9 | 9,393.87 | 1.70 | 1.52 | 4.64 |
| KV read (batch) | Node.js + PostgreSQL | 2000 | 16 | 20.83 | 96,033.38 | 2.59 | 2.34 | 5.51 |
| KV read (hot cache) | Node.js + PostgreSQL | 2000 | 16 | 188.72 | 10,597.53 | 1.51 | 1.38 | 3.44 |
| KV read (99% L1) | Node.js + PostgreSQL | 2000 | 16 | 189.18 | 10,571.94 | 1.51 | 1.35 | 3.51 |
| KV read (95% L1) | Node.js + PostgreSQL | 2000 | 16 | 176.92 | 11,304.23 | 1.41 | 1.27 | 3.41 |
| KV read (90% L1) | Node.js + PostgreSQL | 2000 | 16 | 194.63 | 10,275.89 | 1.55 | 1.36 | 4.77 |
| Counter increment | Node.js + PostgreSQL | 2000 | 16 | 192.35 | 10,397.54 | 1.53 | 1.32 | 4.49 |
| Set add | Node.js + PostgreSQL | 2000 | 16 | 453.33 | 4,411.83 | 3.62 | 2.30 | 36.19 |
| Pub/Sub publish | Node.js + PostgreSQL | 2000 | 16 | 121.43 | 16,470.21 | 0.967 | 0.885 | 2.13 |
| KV read (hot cache) | Node.js + PostgreSQL (L1) | 2000 | 16 | 1.67 | 1,196,961.16 | 0.013 | 0.012 | 0.040 |
| KV read (99% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 3.43 | 582,950.84 | 0.024 | 0.004 | 0.346 |
| KV read (95% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 9.31 | 214,900.74 | 0.071 | 0.001 | 2.06 |
| KV read (90% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 12.09 | 165,400.81 | 0.090 | 0.001 | 2.48 |
| KV write | Bun.js + PostgreSQL | 2000 | 16 | 133.14 | 15,022.02 | 1.06 | 0.928 | 3.21 |
| KV write (batch) | Bun.js + PostgreSQL | 2000 | 16 | 28.9 | 69,209.11 | 3.44 | 3.47 | 8.00 |
| KV read | Bun.js + PostgreSQL | 2000 | 16 | 96.89 | 20,641.63 | 0.769 | 0.661 | 2.36 |
| KV read (batch) | Bun.js + PostgreSQL | 2000 | 16 | 14.88 | 134,448.09 | 1.77 | 1.40 | 5.74 |
| KV read (hot cache) | Bun.js + PostgreSQL | 2000 | 16 | 84.9 | 23,556.75 | 0.677 | 0.611 | 1.64 |
| KV read (99% L1) | Bun.js + PostgreSQL | 2000 | 16 | 86.39 | 23,151.36 | 0.687 | 0.613 | 1.77 |
| KV read (95% L1) | Bun.js + PostgreSQL | 2000 | 16 | 84.36 | 23,707.91 | 0.673 | 0.604 | 1.81 |
| KV read (90% L1) | Bun.js + PostgreSQL | 2000 | 16 | 77.62 | 25,765.83 | 0.619 | 0.541 | 1.80 |
| Counter increment | Bun.js + PostgreSQL | 2000 | 16 | 124.63 | 16,047.99 | 0.991 | 0.774 | 3.85 |
| Set add | Bun.js + PostgreSQL | 2000 | 16 | 285.89 | 6,995.62 | 2.27 | 1.60 | 26.85 |
| Pub/Sub publish | Bun.js + PostgreSQL | 2000 | 16 | 97.91 | 20,425.9 | 0.779 | 0.722 | 1.94 |
| KV read (hot cache) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 3.41 | 586,706.58 | 0.026 | 0.024 | 0.092 |
| KV read (99% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 4.84 | 413,330.15 | 0.037 | 0.008 | 0.213 |
| KV read (95% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 5.8 | 345,043.77 | 0.045 | 0.001 | 1.34 |
| KV read (90% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 7.43 | 269,335.39 | 0.058 | 0.001 | 1.50 |

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
