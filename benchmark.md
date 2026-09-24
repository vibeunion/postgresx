# Benchmark

Generated at: 2026-09-24T09:14:25.378Z

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
| KV write | 23,799.3 | 0.558 | 5,063.79 | 2.55 | 0.21x | 9,494.54 | 1.48 | 0.4x |
| KV write (batch) | 112,398.06 | 1.83 | 34,212.08 | 6.82 | 0.3x | 54,731.9 | 3.73 | 0.49x |
| KV read | 32,381.43 | 0.443 | 6,595.94 | 2.22 | 0.2x | 13,178.77 | 1.05 | 0.41x |
| KV read (batch) | 255,324.54 | 0.892 | 74,189.44 | 2.86 | 0.29x | 107,145.16 | 2.00 | 0.42x |
| KV read (hot cache) L1 | 36,094.17 | 0.416 | 1,148,591.57 | 0.009 | 31.82x | 935,157.14 | 0.015 | 25.91x |
| KV read (99% L1) L1 | 42,624.47 | 0.344 | 494,498.82 | 0.003 | 11.6x | 710,987.49 | 0.003 | 16.68x |
| KV read (95% L1) L1 | 38,367.58 | 0.407 | 168,576.5 | 0.001 | 4.39x | 264,067.82 | 0.001 | 6.88x |
| KV read (90% L1) L1 | 34,651.95 | 0.366 | 129,615.52 | 0.001 | 3.74x | 265,687.34 | 0.001 | 7.67x |
| Counter increment | 38,746.09 | 0.391 | 7,114.09 | 1.87 | 0.18x | 12,217.21 | 1.06 | 0.32x |
| Set add | 35,666.87 | 0.412 | 3,999.96 | 3.15 | 0.11x | 6,284.44 | 1.64 | 0.18x |
| Pub/Sub publish | 41,988.26 | 0.382 | 10,149.65 | 1.40 | 0.24x | 14,989.51 | 1.02 | 0.36x |

## L1 Read Cache

These rows isolate pgredis local memory cache behavior. Mixed hit-rate rows include PostgreSQL misses and are closer to real cache-aside usage than the 100% hot-cache row.

| Operation | Redis | Redis p50 ms | Node PG L1 | Node PG L1 p50 ms | Node PG L1/Redis | Bun PG L1 | Bun PG L1 p50 ms | Bun PG L1/Redis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV read (hot cache) | 36,094.17 | 0.416 | 1,148,591.57 | 0.009 | 31.82x | 935,157.14 | 0.015 | 25.91x |
| KV read (99% L1) | 42,624.47 | 0.344 | 494,498.82 | 0.003 | 11.6x | 710,987.49 | 0.003 | 16.68x |
| KV read (95% L1) | 38,367.58 | 0.407 | 168,576.5 | 0.001 | 4.39x | 264,067.82 | 0.001 | 6.88x |
| KV read (90% L1) | 34,651.95 | 0.366 | 129,615.52 | 0.001 | 3.74x | 265,687.34 | 0.001 | 7.67x |

## L2 Backend Path

These rows disable pgredis L1 and measure direct PostgreSQL access. They are useful for fallback sizing and regression tracking, not as the main cache-hit comparison.

| Operation | Redis | Redis p50 ms | Node PG L2 | Node PG L2 p50 ms | Node PG L2/Redis | Bun PG L2 | Bun PG L2 p50 ms | Bun PG L2/Redis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV write | 23,799.3 | 0.558 | 5,063.79 | 2.55 | 0.21x | 9,494.54 | 1.48 | 0.4x |
| KV write (batch) | 112,398.06 | 1.83 | 34,212.08 | 6.82 | 0.3x | 54,731.9 | 3.73 | 0.49x |
| KV read | 32,381.43 | 0.443 | 6,595.94 | 2.22 | 0.2x | 13,178.77 | 1.05 | 0.41x |
| KV read (batch) | 255,324.54 | 0.892 | 74,189.44 | 2.86 | 0.29x | 107,145.16 | 2.00 | 0.42x |
| KV read (hot cache) | 36,094.17 | 0.416 | 6,993.76 | 2.16 | 0.19x | 12,893.57 | 1.10 | 0.36x |
| KV read (99% L1) | 42,624.47 | 0.344 | 6,580.83 | 2.08 | 0.15x | 14,205.6 | 0.964 | 0.33x |
| KV read (95% L1) | 38,367.58 | 0.407 | 7,263.7 | 2.02 | 0.19x | 14,500.26 | 0.994 | 0.38x |
| KV read (90% L1) | 34,651.95 | 0.366 | 6,965.81 | 2.03 | 0.2x | 19,802.28 | 0.743 | 0.57x |
| Counter increment | 38,746.09 | 0.391 | 7,114.09 | 1.87 | 0.18x | 12,217.21 | 1.06 | 0.32x |
| Set add | 35,666.87 | 0.412 | 3,999.96 | 3.15 | 0.11x | 6,284.44 | 1.64 | 0.18x |
| Pub/Sub publish | 41,988.26 | 0.382 | 10,149.65 | 1.40 | 0.24x | 14,989.51 | 1.02 | 0.36x |

## Details

| Operation | Backend | Iterations | Concurrency | Duration ms | Ops/sec | Avg ms | p50 ms | p99 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV write | Node.js + Redis | 2000 | 16 | 84.04 | 23,799.3 | 0.661 | 0.558 | 2.33 |
| KV write (batch) | Node.js + Redis | 2000 | 16 | 17.79 | 112,398.06 | 2.09 | 1.83 | 5.15 |
| KV read | Node.js + Redis | 2000 | 16 | 61.76 | 32,381.43 | 0.490 | 0.443 | 1.07 |
| KV read (batch) | Node.js + Redis | 2000 | 16 | 7.83 | 255,324.54 | 0.951 | 0.892 | 1.51 |
| KV read (hot cache) | Node.js + Redis | 2000 | 16 | 55.41 | 36,094.17 | 0.440 | 0.416 | 0.889 |
| KV read (99% L1) | Node.js + Redis | 2000 | 16 | 46.92 | 42,624.47 | 0.373 | 0.344 | 1.03 |
| KV read (95% L1) | Node.js + Redis | 2000 | 16 | 52.13 | 38,367.58 | 0.415 | 0.407 | 0.795 |
| KV read (90% L1) | Node.js + Redis | 2000 | 16 | 57.72 | 34,651.95 | 0.460 | 0.366 | 4.49 |
| Counter increment | Node.js + Redis | 2000 | 16 | 51.62 | 38,746.09 | 0.409 | 0.391 | 0.925 |
| Set add | Node.js + Redis | 2000 | 16 | 56.07 | 35,666.87 | 0.446 | 0.412 | 0.756 |
| Pub/Sub publish | Node.js + Redis | 2000 | 16 | 47.63 | 41,988.26 | 0.378 | 0.382 | 0.570 |
| KV write | Node.js + PostgreSQL | 2000 | 16 | 394.96 | 5,063.79 | 3.16 | 2.55 | 7.80 |
| KV write (batch) | Node.js + PostgreSQL | 2000 | 16 | 58.46 | 34,212.08 | 7.23 | 6.82 | 16.35 |
| KV read | Node.js + PostgreSQL | 2000 | 16 | 303.22 | 6,595.94 | 2.42 | 2.22 | 5.87 |
| KV read (batch) | Node.js + PostgreSQL | 2000 | 16 | 26.96 | 74,189.44 | 3.34 | 2.86 | 8.23 |
| KV read (hot cache) | Node.js + PostgreSQL | 2000 | 16 | 285.97 | 6,993.76 | 2.28 | 2.16 | 5.00 |
| KV read (99% L1) | Node.js + PostgreSQL | 2000 | 16 | 303.91 | 6,580.83 | 2.43 | 2.08 | 5.27 |
| KV read (95% L1) | Node.js + PostgreSQL | 2000 | 16 | 275.34 | 7,263.7 | 2.20 | 2.02 | 4.91 |
| KV read (90% L1) | Node.js + PostgreSQL | 2000 | 16 | 287.12 | 6,965.81 | 2.29 | 2.03 | 5.60 |
| Counter increment | Node.js + PostgreSQL | 2000 | 16 | 281.13 | 7,114.09 | 2.24 | 1.87 | 5.60 |
| Set add | Node.js + PostgreSQL | 2000 | 16 | 500.01 | 3,999.96 | 3.98 | 3.15 | 17.93 |
| Pub/Sub publish | Node.js + PostgreSQL | 2000 | 16 | 197.05 | 10,149.65 | 1.57 | 1.40 | 3.36 |
| KV read (hot cache) | Node.js + PostgreSQL (L1) | 2000 | 16 | 1.74 | 1,148,591.57 | 0.013 | 0.009 | 0.069 |
| KV read (99% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 4.04 | 494,498.82 | 0.029 | 0.003 | 0.541 |
| KV read (95% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 11.86 | 168,576.5 | 0.092 | 0.001 | 2.95 |
| KV read (90% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 15.43 | 129,615.52 | 0.120 | 0.001 | 3.33 |
| KV write | Bun.js + PostgreSQL | 2000 | 16 | 210.65 | 9,494.54 | 1.68 | 1.48 | 4.98 |
| KV write (batch) | Bun.js + PostgreSQL | 2000 | 16 | 36.54 | 54,731.9 | 4.40 | 3.73 | 12.17 |
| KV read | Bun.js + PostgreSQL | 2000 | 16 | 151.76 | 13,178.77 | 1.21 | 1.05 | 3.27 |
| KV read (batch) | Bun.js + PostgreSQL | 2000 | 16 | 18.67 | 107,145.16 | 2.30 | 2.00 | 8.76 |
| KV read (hot cache) | Bun.js + PostgreSQL | 2000 | 16 | 155.12 | 12,893.57 | 1.23 | 1.10 | 3.87 |
| KV read (99% L1) | Bun.js + PostgreSQL | 2000 | 16 | 140.79 | 14,205.6 | 1.12 | 0.964 | 2.97 |
| KV read (95% L1) | Bun.js + PostgreSQL | 2000 | 16 | 137.93 | 14,500.26 | 1.10 | 0.994 | 3.00 |
| KV read (90% L1) | Bun.js + PostgreSQL | 2000 | 16 | 101 | 19,802.28 | 0.805 | 0.743 | 1.98 |
| Counter increment | Bun.js + PostgreSQL | 2000 | 16 | 163.7 | 12,217.21 | 1.30 | 1.06 | 4.46 |
| Set add | Bun.js + PostgreSQL | 2000 | 16 | 318.25 | 6,284.44 | 2.53 | 1.64 | 26.57 |
| Pub/Sub publish | Bun.js + PostgreSQL | 2000 | 16 | 133.43 | 14,989.51 | 1.06 | 1.02 | 2.15 |
| KV read (hot cache) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 2.14 | 935,157.14 | 0.016 | 0.015 | 0.063 |
| KV read (99% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 2.81 | 710,987.49 | 0.021 | 0.003 | 0.440 |
| KV read (95% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 7.57 | 264,067.82 | 0.056 | 0.001 | 1.59 |
| KV read (90% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 7.53 | 265,687.34 | 0.058 | 0.001 | 1.69 |

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
