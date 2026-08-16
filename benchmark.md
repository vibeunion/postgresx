# Benchmark

Generated at: 2026-08-16T01:57:41.900Z

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
| KV write | 33,855.21 | 0.392 | 6,952.5 | 1.83 | 0.21x | 14,963.65 | 0.894 | 0.44x |
| KV write (batch) | 164,577.57 | 1.33 | 43,906.83 | 4.64 | 0.27x | 69,599.01 | 3.35 | 0.42x |
| KV read | 48,805.89 | 0.305 | 9,738.3 | 1.49 | 0.2x | 20,409.81 | 0.685 | 0.42x |
| KV read (batch) | 304,156.14 | 0.603 | 94,391.82 | 2.04 | 0.31x | 133,878.24 | 1.39 | 0.44x |
| KV read (hot cache) L1 | 48,845.42 | 0.309 | 780,626.41 | 0.017 | 15.98x | 559,585.82 | 0.024 | 11.46x |
| KV read (99% L1) L1 | 52,937.41 | 0.277 | 392,490.33 | 0.008 | 7.41x | 444,286.28 | 0.009 | 8.39x |
| KV read (95% L1) L1 | 50,878.81 | 0.297 | 231,826.14 | 0.001 | 4.56x | 270,636.4 | 0.001 | 5.32x |
| KV read (90% L1) L1 | 47,163.64 | 0.265 | 205,318.45 | 0.001 | 4.35x | 270,509.52 | 0.001 | 5.74x |
| Counter increment | 51,878.6 | 0.292 | 10,180.58 | 1.39 | 0.2x | 16,076.31 | 0.776 | 0.31x |
| Set add | 55,549.54 | 0.267 | 4,486.45 | 2.10 | 0.08x | 7,110.94 | 1.56 | 0.13x |
| Pub/Sub publish | 66,818.31 | 0.231 | 15,494.37 | 0.961 | 0.23x | 19,079.93 | 0.796 | 0.29x |

## L1 Read Cache

These rows isolate pgredis local memory cache behavior. Mixed hit-rate rows include PostgreSQL misses and are closer to real cache-aside usage than the 100% hot-cache row.

| Operation | Redis | Redis p50 ms | Node PG L1 | Node PG L1 p50 ms | Node PG L1/Redis | Bun PG L1 | Bun PG L1 p50 ms | Bun PG L1/Redis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV read (hot cache) | 48,845.42 | 0.309 | 780,626.41 | 0.017 | 15.98x | 559,585.82 | 0.024 | 11.46x |
| KV read (99% L1) | 52,937.41 | 0.277 | 392,490.33 | 0.008 | 7.41x | 444,286.28 | 0.009 | 8.39x |
| KV read (95% L1) | 50,878.81 | 0.297 | 231,826.14 | 0.001 | 4.56x | 270,636.4 | 0.001 | 5.32x |
| KV read (90% L1) | 47,163.64 | 0.265 | 205,318.45 | 0.001 | 4.35x | 270,509.52 | 0.001 | 5.74x |

## L2 Backend Path

These rows disable pgredis L1 and measure direct PostgreSQL access. They are useful for fallback sizing and regression tracking, not as the main cache-hit comparison.

| Operation | Redis | Redis p50 ms | Node PG L2 | Node PG L2 p50 ms | Node PG L2/Redis | Bun PG L2 | Bun PG L2 p50 ms | Bun PG L2/Redis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV write | 33,855.21 | 0.392 | 6,952.5 | 1.83 | 0.21x | 14,963.65 | 0.894 | 0.44x |
| KV write (batch) | 164,577.57 | 1.33 | 43,906.83 | 4.64 | 0.27x | 69,599.01 | 3.35 | 0.42x |
| KV read | 48,805.89 | 0.305 | 9,738.3 | 1.49 | 0.2x | 20,409.81 | 0.685 | 0.42x |
| KV read (batch) | 304,156.14 | 0.603 | 94,391.82 | 2.04 | 0.31x | 133,878.24 | 1.39 | 0.44x |
| KV read (hot cache) | 48,845.42 | 0.309 | 10,603.97 | 1.37 | 0.22x | 23,560.27 | 0.616 | 0.48x |
| KV read (99% L1) | 52,937.41 | 0.277 | 10,865.6 | 1.34 | 0.21x | 24,058.44 | 0.613 | 0.45x |
| KV read (95% L1) | 50,878.81 | 0.297 | 11,430.03 | 1.29 | 0.22x | 24,382.13 | 0.578 | 0.48x |
| KV read (90% L1) | 47,163.64 | 0.265 | 10,199.93 | 1.37 | 0.22x | 25,102.58 | 0.570 | 0.53x |
| Counter increment | 51,878.6 | 0.292 | 10,180.58 | 1.39 | 0.2x | 16,076.31 | 0.776 | 0.31x |
| Set add | 55,549.54 | 0.267 | 4,486.45 | 2.10 | 0.08x | 7,110.94 | 1.56 | 0.13x |
| Pub/Sub publish | 66,818.31 | 0.231 | 15,494.37 | 0.961 | 0.23x | 19,079.93 | 0.796 | 0.29x |

## Details

| Operation | Backend | Iterations | Concurrency | Duration ms | Ops/sec | Avg ms | p50 ms | p99 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV write | Node.js + Redis | 2000 | 16 | 59.08 | 33,855.21 | 0.466 | 0.392 | 1.40 |
| KV write (batch) | Node.js + Redis | 2000 | 16 | 12.15 | 164,577.57 | 1.45 | 1.33 | 2.61 |
| KV read | Node.js + Redis | 2000 | 16 | 40.98 | 48,805.89 | 0.326 | 0.305 | 0.819 |
| KV read (batch) | Node.js + Redis | 2000 | 16 | 6.58 | 304,156.14 | 0.776 | 0.603 | 1.71 |
| KV read (hot cache) | Node.js + Redis | 2000 | 16 | 40.95 | 48,845.42 | 0.325 | 0.309 | 0.638 |
| KV read (99% L1) | Node.js + Redis | 2000 | 16 | 37.78 | 52,937.41 | 0.300 | 0.277 | 0.435 |
| KV read (95% L1) | Node.js + Redis | 2000 | 16 | 39.31 | 50,878.81 | 0.312 | 0.297 | 0.659 |
| KV read (90% L1) | Node.js + Redis | 2000 | 16 | 42.41 | 47,163.64 | 0.338 | 0.265 | 2.35 |
| Counter increment | Node.js + Redis | 2000 | 16 | 38.55 | 51,878.6 | 0.304 | 0.292 | 0.507 |
| Set add | Node.js + Redis | 2000 | 16 | 36 | 55,549.54 | 0.286 | 0.267 | 0.373 |
| Pub/Sub publish | Node.js + Redis | 2000 | 16 | 29.93 | 66,818.31 | 0.237 | 0.231 | 0.341 |
| KV write | Node.js + PostgreSQL | 2000 | 16 | 287.67 | 6,952.5 | 2.30 | 1.83 | 6.95 |
| KV write (batch) | Node.js + PostgreSQL | 2000 | 16 | 45.55 | 43,906.83 | 5.57 | 4.64 | 16.23 |
| KV read | Node.js + PostgreSQL | 2000 | 16 | 205.37 | 9,738.3 | 1.64 | 1.49 | 4.20 |
| KV read (batch) | Node.js + PostgreSQL | 2000 | 16 | 21.19 | 94,391.82 | 2.43 | 2.04 | 5.87 |
| KV read (hot cache) | Node.js + PostgreSQL | 2000 | 16 | 188.61 | 10,603.97 | 1.50 | 1.37 | 3.41 |
| KV read (99% L1) | Node.js + PostgreSQL | 2000 | 16 | 184.07 | 10,865.6 | 1.47 | 1.34 | 3.59 |
| KV read (95% L1) | Node.js + PostgreSQL | 2000 | 16 | 174.98 | 11,430.03 | 1.40 | 1.29 | 3.13 |
| KV read (90% L1) | Node.js + PostgreSQL | 2000 | 16 | 196.08 | 10,199.93 | 1.57 | 1.37 | 4.03 |
| Counter increment | Node.js + PostgreSQL | 2000 | 16 | 196.45 | 10,180.58 | 1.57 | 1.39 | 4.70 |
| Set add | Node.js + PostgreSQL | 2000 | 16 | 445.79 | 4,486.45 | 3.56 | 2.10 | 36.72 |
| Pub/Sub publish | Node.js + PostgreSQL | 2000 | 16 | 129.08 | 15,494.37 | 1.03 | 0.961 | 2.37 |
| KV read (hot cache) | Node.js + PostgreSQL (L1) | 2000 | 16 | 2.56 | 780,626.41 | 0.020 | 0.017 | 0.049 |
| KV read (99% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 5.1 | 392,490.33 | 0.039 | 0.008 | 0.680 |
| KV read (95% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 8.63 | 231,826.14 | 0.068 | 0.001 | 2.31 |
| KV read (90% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 9.74 | 205,318.45 | 0.076 | 0.001 | 2.18 |
| KV write | Bun.js + PostgreSQL | 2000 | 16 | 133.66 | 14,963.65 | 1.06 | 0.894 | 3.46 |
| KV write (batch) | Bun.js + PostgreSQL | 2000 | 16 | 28.74 | 69,599.01 | 3.45 | 3.35 | 8.87 |
| KV read | Bun.js + PostgreSQL | 2000 | 16 | 97.99 | 20,409.81 | 0.779 | 0.685 | 2.57 |
| KV read (batch) | Bun.js + PostgreSQL | 2000 | 16 | 14.94 | 133,878.24 | 1.78 | 1.39 | 4.49 |
| KV read (hot cache) | Bun.js + PostgreSQL | 2000 | 16 | 84.89 | 23,560.27 | 0.677 | 0.616 | 1.77 |
| KV read (99% L1) | Bun.js + PostgreSQL | 2000 | 16 | 83.13 | 24,058.44 | 0.661 | 0.613 | 1.49 |
| KV read (95% L1) | Bun.js + PostgreSQL | 2000 | 16 | 82.03 | 24,382.13 | 0.655 | 0.578 | 1.74 |
| KV read (90% L1) | Bun.js + PostgreSQL | 2000 | 16 | 79.67 | 25,102.58 | 0.636 | 0.570 | 1.81 |
| Counter increment | Bun.js + PostgreSQL | 2000 | 16 | 124.41 | 16,076.31 | 0.990 | 0.776 | 3.57 |
| Set add | Bun.js + PostgreSQL | 2000 | 16 | 281.26 | 7,110.94 | 2.24 | 1.56 | 24.37 |
| Pub/Sub publish | Bun.js + PostgreSQL | 2000 | 16 | 104.82 | 19,079.93 | 0.834 | 0.796 | 1.82 |
| KV read (hot cache) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 3.57 | 559,585.82 | 0.027 | 0.024 | 0.084 |
| KV read (99% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 4.5 | 444,286.28 | 0.035 | 0.009 | 0.215 |
| KV read (95% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 7.39 | 270,636.4 | 0.056 | 0.001 | 1.62 |
| KV read (90% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 7.39 | 270,509.52 | 0.056 | 0.001 | 1.54 |

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
