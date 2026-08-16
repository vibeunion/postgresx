# Benchmark

Generated at: 2026-08-16T04:09:13.749Z

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
| KV write | 26,108.69 | 0.521 | 5,984.25 | 2.16 | 0.23x | 12,984.68 | 1.03 | 0.5x |
| KV write (batch) | 118,553.02 | 1.68 | 41,295.57 | 5.75 | 0.35x | 58,788.74 | 4.14 | 0.5x |
| KV read | 36,552.04 | 0.426 | 7,710.41 | 1.81 | 0.21x | 16,380.79 | 0.861 | 0.45x |
| KV read (batch) | 236,237.01 | 0.865 | 87,983.22 | 2.38 | 0.37x | 108,311.95 | 1.76 | 0.46x |
| KV read (hot cache) L1 | 35,108.66 | 0.436 | 899,264.81 | 0.014 | 25.61x | 507,670.01 | 0.026 | 14.46x |
| KV read (99% L1) L1 | 37,951.06 | 0.395 | 427,280.4 | 0.007 | 11.26x | 363,157.39 | 0.008 | 9.57x |
| KV read (95% L1) L1 | 39,675.58 | 0.406 | 206,762.8 | 0.001 | 5.21x | 282,761.53 | 0.002 | 7.13x |
| KV read (90% L1) L1 | 33,560.32 | 0.416 | 167,286.55 | 0.001 | 4.98x | 206,378.63 | 0.001 | 6.15x |
| Counter increment | 39,975.55 | 0.388 | 9,172.61 | 1.60 | 0.23x | 11,434.08 | 1.12 | 0.29x |
| Set add | 42,806.01 | 0.341 | 3,982.97 | 2.65 | 0.09x | 6,243.61 | 1.77 | 0.15x |
| Pub/Sub publish | 47,293.85 | 0.332 | 12,118.38 | 1.19 | 0.26x | 15,822 | 0.936 | 0.33x |

## L1 Read Cache

These rows isolate pgredis local memory cache behavior. Mixed hit-rate rows include PostgreSQL misses and are closer to real cache-aside usage than the 100% hot-cache row.

| Operation | Redis | Redis p50 ms | Node PG L1 | Node PG L1 p50 ms | Node PG L1/Redis | Bun PG L1 | Bun PG L1 p50 ms | Bun PG L1/Redis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV read (hot cache) | 35,108.66 | 0.436 | 899,264.81 | 0.014 | 25.61x | 507,670.01 | 0.026 | 14.46x |
| KV read (99% L1) | 37,951.06 | 0.395 | 427,280.4 | 0.007 | 11.26x | 363,157.39 | 0.008 | 9.57x |
| KV read (95% L1) | 39,675.58 | 0.406 | 206,762.8 | 0.001 | 5.21x | 282,761.53 | 0.002 | 7.13x |
| KV read (90% L1) | 33,560.32 | 0.416 | 167,286.55 | 0.001 | 4.98x | 206,378.63 | 0.001 | 6.15x |

## L2 Backend Path

These rows disable pgredis L1 and measure direct PostgreSQL access. They are useful for fallback sizing and regression tracking, not as the main cache-hit comparison.

| Operation | Redis | Redis p50 ms | Node PG L2 | Node PG L2 p50 ms | Node PG L2/Redis | Bun PG L2 | Bun PG L2 p50 ms | Bun PG L2/Redis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV write | 26,108.69 | 0.521 | 5,984.25 | 2.16 | 0.23x | 12,984.68 | 1.03 | 0.5x |
| KV write (batch) | 118,553.02 | 1.68 | 41,295.57 | 5.75 | 0.35x | 58,788.74 | 4.14 | 0.5x |
| KV read | 36,552.04 | 0.426 | 7,710.41 | 1.81 | 0.21x | 16,380.79 | 0.861 | 0.45x |
| KV read (batch) | 236,237.01 | 0.865 | 87,983.22 | 2.38 | 0.37x | 108,311.95 | 1.76 | 0.46x |
| KV read (hot cache) | 35,108.66 | 0.436 | 8,860.86 | 1.61 | 0.25x | 18,849.21 | 0.750 | 0.54x |
| KV read (99% L1) | 37,951.06 | 0.395 | 9,066.5 | 1.59 | 0.24x | 18,269.65 | 0.814 | 0.48x |
| KV read (95% L1) | 39,675.58 | 0.406 | 8,938.9 | 1.59 | 0.23x | 17,896.94 | 0.804 | 0.45x |
| KV read (90% L1) | 33,560.32 | 0.416 | 8,408.36 | 1.68 | 0.25x | 17,835.09 | 0.813 | 0.53x |
| Counter increment | 39,975.55 | 0.388 | 9,172.61 | 1.60 | 0.23x | 11,434.08 | 1.12 | 0.29x |
| Set add | 42,806.01 | 0.341 | 3,982.97 | 2.65 | 0.09x | 6,243.61 | 1.77 | 0.15x |
| Pub/Sub publish | 47,293.85 | 0.332 | 12,118.38 | 1.19 | 0.26x | 15,822 | 0.936 | 0.33x |

## Details

| Operation | Backend | Iterations | Concurrency | Duration ms | Ops/sec | Avg ms | p50 ms | p99 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV write | Node.js + Redis | 2000 | 16 | 76.6 | 26,108.69 | 0.604 | 0.521 | 2.27 |
| KV write (batch) | Node.js + Redis | 2000 | 16 | 16.87 | 118,553.02 | 1.99 | 1.68 | 4.75 |
| KV read | Node.js + Redis | 2000 | 16 | 54.72 | 36,552.04 | 0.434 | 0.426 | 0.736 |
| KV read (batch) | Node.js + Redis | 2000 | 16 | 8.47 | 236,237.01 | 1.01 | 0.865 | 2.44 |
| KV read (hot cache) | Node.js + Redis | 2000 | 16 | 56.97 | 35,108.66 | 0.453 | 0.436 | 0.882 |
| KV read (99% L1) | Node.js + Redis | 2000 | 16 | 52.7 | 37,951.06 | 0.418 | 0.395 | 0.585 |
| KV read (95% L1) | Node.js + Redis | 2000 | 16 | 50.41 | 39,675.58 | 0.401 | 0.406 | 0.562 |
| KV read (90% L1) | Node.js + Redis | 2000 | 16 | 59.59 | 33,560.32 | 0.474 | 0.416 | 1.63 |
| Counter increment | Node.js + Redis | 2000 | 16 | 50.03 | 39,975.55 | 0.394 | 0.388 | 0.652 |
| Set add | Node.js + Redis | 2000 | 16 | 46.72 | 42,806.01 | 0.371 | 0.341 | 0.996 |
| Pub/Sub publish | Node.js + Redis | 2000 | 16 | 42.29 | 47,293.85 | 0.335 | 0.332 | 0.475 |
| KV write | Node.js + PostgreSQL | 2000 | 16 | 334.21 | 5,984.25 | 2.67 | 2.16 | 7.51 |
| KV write (batch) | Node.js + PostgreSQL | 2000 | 16 | 48.43 | 41,295.57 | 5.85 | 5.75 | 12.84 |
| KV read | Node.js + PostgreSQL | 2000 | 16 | 259.39 | 7,710.41 | 2.07 | 1.81 | 5.57 |
| KV read (batch) | Node.js + PostgreSQL | 2000 | 16 | 22.73 | 87,983.22 | 2.69 | 2.38 | 6.43 |
| KV read (hot cache) | Node.js + PostgreSQL | 2000 | 16 | 225.71 | 8,860.86 | 1.80 | 1.61 | 4.07 |
| KV read (99% L1) | Node.js + PostgreSQL | 2000 | 16 | 220.59 | 9,066.5 | 1.76 | 1.59 | 4.07 |
| KV read (95% L1) | Node.js + PostgreSQL | 2000 | 16 | 223.74 | 8,938.9 | 1.79 | 1.59 | 3.75 |
| KV read (90% L1) | Node.js + PostgreSQL | 2000 | 16 | 237.86 | 8,408.36 | 1.90 | 1.68 | 5.72 |
| Counter increment | Node.js + PostgreSQL | 2000 | 16 | 218.04 | 9,172.61 | 1.74 | 1.60 | 4.51 |
| Set add | Node.js + PostgreSQL | 2000 | 16 | 502.14 | 3,982.97 | 4.00 | 2.65 | 35.41 |
| Pub/Sub publish | Node.js + PostgreSQL | 2000 | 16 | 165.04 | 12,118.38 | 1.32 | 1.19 | 2.81 |
| KV read (hot cache) | Node.js + PostgreSQL (L1) | 2000 | 16 | 2.22 | 899,264.81 | 0.017 | 0.014 | 0.055 |
| KV read (99% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 4.68 | 427,280.4 | 0.036 | 0.007 | 0.489 |
| KV read (95% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 9.67 | 206,762.8 | 0.073 | 0.001 | 1.94 |
| KV read (90% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 11.96 | 167,286.55 | 0.094 | 0.001 | 2.79 |
| KV write | Bun.js + PostgreSQL | 2000 | 16 | 154.03 | 12,984.68 | 1.22 | 1.03 | 4.02 |
| KV write (batch) | Bun.js + PostgreSQL | 2000 | 16 | 34.02 | 58,788.74 | 4.11 | 4.14 | 9.05 |
| KV read | Bun.js + PostgreSQL | 2000 | 16 | 122.09 | 16,380.79 | 0.972 | 0.861 | 2.79 |
| KV read (batch) | Bun.js + PostgreSQL | 2000 | 16 | 18.47 | 108,311.95 | 2.20 | 1.76 | 7.29 |
| KV read (hot cache) | Bun.js + PostgreSQL | 2000 | 16 | 106.11 | 18,849.21 | 0.845 | 0.750 | 2.40 |
| KV read (99% L1) | Bun.js + PostgreSQL | 2000 | 16 | 109.47 | 18,269.65 | 0.870 | 0.814 | 2.27 |
| KV read (95% L1) | Bun.js + PostgreSQL | 2000 | 16 | 111.75 | 17,896.94 | 0.892 | 0.804 | 2.18 |
| KV read (90% L1) | Bun.js + PostgreSQL | 2000 | 16 | 112.14 | 17,835.09 | 0.895 | 0.813 | 2.24 |
| Counter increment | Bun.js + PostgreSQL | 2000 | 16 | 174.92 | 11,434.08 | 1.39 | 1.12 | 4.43 |
| Set add | Bun.js + PostgreSQL | 2000 | 16 | 320.33 | 6,243.61 | 2.55 | 1.77 | 26.18 |
| Pub/Sub publish | Bun.js + PostgreSQL | 2000 | 16 | 126.41 | 15,822 | 1.01 | 0.936 | 2.40 |
| KV read (hot cache) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 3.94 | 507,670.01 | 0.030 | 0.026 | 0.103 |
| KV read (99% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 5.51 | 363,157.39 | 0.042 | 0.008 | 0.307 |
| KV read (95% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 7.07 | 282,761.53 | 0.054 | 0.002 | 1.67 |
| KV read (90% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 9.69 | 206,378.63 | 0.076 | 0.001 | 1.97 |

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
