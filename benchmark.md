# Benchmark

Generated at: 2026-09-24T07:52:38.303Z

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
| KV write | 59,454.94 | 0.228 | 11,267.99 | 0.976 | 0.19x | 29,899.49 | 0.436 | 0.5x |
| KV write (batch) | 215,081.93 | 0.865 | 66,391.23 | 3.22 | 0.31x | 117,423.82 | 1.95 | 0.55x |
| KV read | 76,142.52 | 0.191 | 18,238.03 | 0.756 | 0.24x | 36,277.53 | 0.364 | 0.48x |
| KV read (batch) | 493,733.66 | 0.414 | 162,499.75 | 1.28 | 0.33x | 235,568.82 | 0.770 | 0.48x |
| KV read (hot cache) L1 | 70,439.23 | 0.195 | 1,969,927.09 | 0.007 | 27.97x | 1,411,099 | 0.010 | 20.03x |
| KV read (99% L1) L1 | 79,291.64 | 0.181 | 899,622.79 | 0.002 | 11.35x | 1,132,799.18 | 0.002 | 14.29x |
| KV read (95% L1) L1 | 83,121.72 | 0.184 | 512,304.66 | 0.000 | 6.16x | 434,610.37 | 0.000 | 5.23x |
| KV read (90% L1) L1 | 64,556.99 | 0.190 | 439,866.22 | 0.000 | 6.81x | 478,429.98 | 0.001 | 7.41x |
| Counter increment | 75,528.96 | 0.185 | 21,455.69 | 0.636 | 0.28x | 27,783.17 | 0.461 | 0.37x |
| Set add | 83,652.15 | 0.170 | 9,369.82 | 1.15 | 0.11x | 14,547.83 | 0.820 | 0.17x |
| Pub/Sub publish | 90,101.99 | 0.179 | 24,138.77 | 0.497 | 0.27x | 30,520.04 | 0.371 | 0.34x |

## L1 Read Cache

These rows isolate pgredis local memory cache behavior. Mixed hit-rate rows include PostgreSQL misses and are closer to real cache-aside usage than the 100% hot-cache row.

| Operation | Redis | Redis p50 ms | Node PG L1 | Node PG L1 p50 ms | Node PG L1/Redis | Bun PG L1 | Bun PG L1 p50 ms | Bun PG L1/Redis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV read (hot cache) | 70,439.23 | 0.195 | 1,969,927.09 | 0.007 | 27.97x | 1,411,099 | 0.010 | 20.03x |
| KV read (99% L1) | 79,291.64 | 0.181 | 899,622.79 | 0.002 | 11.35x | 1,132,799.18 | 0.002 | 14.29x |
| KV read (95% L1) | 83,121.72 | 0.184 | 512,304.66 | 0.000 | 6.16x | 434,610.37 | 0.000 | 5.23x |
| KV read (90% L1) | 64,556.99 | 0.190 | 439,866.22 | 0.000 | 6.81x | 478,429.98 | 0.001 | 7.41x |

## L2 Backend Path

These rows disable pgredis L1 and measure direct PostgreSQL access. They are useful for fallback sizing and regression tracking, not as the main cache-hit comparison.

| Operation | Redis | Redis p50 ms | Node PG L2 | Node PG L2 p50 ms | Node PG L2/Redis | Bun PG L2 | Bun PG L2 p50 ms | Bun PG L2/Redis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV write | 59,454.94 | 0.228 | 11,267.99 | 0.976 | 0.19x | 29,899.49 | 0.436 | 0.5x |
| KV write (batch) | 215,081.93 | 0.865 | 66,391.23 | 3.22 | 0.31x | 117,423.82 | 1.95 | 0.55x |
| KV read | 76,142.52 | 0.191 | 18,238.03 | 0.756 | 0.24x | 36,277.53 | 0.364 | 0.48x |
| KV read (batch) | 493,733.66 | 0.414 | 162,499.75 | 1.28 | 0.33x | 235,568.82 | 0.770 | 0.48x |
| KV read (hot cache) | 70,439.23 | 0.195 | 25,203.89 | 0.564 | 0.36x | 44,404.43 | 0.316 | 0.63x |
| KV read (99% L1) | 79,291.64 | 0.181 | 24,622.66 | 0.602 | 0.31x | 44,469.69 | 0.317 | 0.56x |
| KV read (95% L1) | 83,121.72 | 0.184 | 26,163.33 | 0.542 | 0.31x | 40,141.71 | 0.359 | 0.48x |
| KV read (90% L1) | 64,556.99 | 0.190 | 18,297.6 | 0.727 | 0.28x | 28,958.19 | 0.443 | 0.45x |
| Counter increment | 75,528.96 | 0.185 | 21,455.69 | 0.636 | 0.28x | 27,783.17 | 0.461 | 0.37x |
| Set add | 83,652.15 | 0.170 | 9,369.82 | 1.15 | 0.11x | 14,547.83 | 0.820 | 0.17x |
| Pub/Sub publish | 90,101.99 | 0.179 | 24,138.77 | 0.497 | 0.27x | 30,520.04 | 0.371 | 0.34x |

## Details

| Operation | Backend | Iterations | Concurrency | Duration ms | Ops/sec | Avg ms | p50 ms | p99 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV write | Node.js + Redis | 2000 | 16 | 33.64 | 59,454.94 | 0.265 | 0.228 | 1.04 |
| KV write (batch) | Node.js + Redis | 2000 | 16 | 9.3 | 215,081.93 | 1.12 | 0.865 | 3.14 |
| KV read | Node.js + Redis | 2000 | 16 | 26.27 | 76,142.52 | 0.208 | 0.191 | 0.682 |
| KV read (batch) | Node.js + Redis | 2000 | 16 | 4.05 | 493,733.66 | 0.470 | 0.414 | 0.754 |
| KV read (hot cache) | Node.js + Redis | 2000 | 16 | 28.39 | 70,439.23 | 0.225 | 0.195 | 1.09 |
| KV read (99% L1) | Node.js + Redis | 2000 | 16 | 25.22 | 79,291.64 | 0.200 | 0.181 | 0.509 |
| KV read (95% L1) | Node.js + Redis | 2000 | 16 | 24.06 | 83,121.72 | 0.191 | 0.184 | 0.347 |
| KV read (90% L1) | Node.js + Redis | 2000 | 16 | 30.98 | 64,556.99 | 0.247 | 0.190 | 0.966 |
| Counter increment | Node.js + Redis | 2000 | 16 | 26.48 | 75,528.96 | 0.208 | 0.185 | 0.425 |
| Set add | Node.js + Redis | 2000 | 16 | 23.91 | 83,652.15 | 0.190 | 0.170 | 0.752 |
| Pub/Sub publish | Node.js + Redis | 2000 | 16 | 22.2 | 90,101.99 | 0.176 | 0.179 | 0.213 |
| KV write | Node.js + PostgreSQL | 2000 | 16 | 177.49 | 11,267.99 | 1.42 | 0.976 | 4.40 |
| KV write (batch) | Node.js + PostgreSQL | 2000 | 16 | 30.12 | 66,391.23 | 3.66 | 3.22 | 12.66 |
| KV read | Node.js + PostgreSQL | 2000 | 16 | 109.66 | 18,238.03 | 0.874 | 0.756 | 2.99 |
| KV read (batch) | Node.js + PostgreSQL | 2000 | 16 | 12.31 | 162,499.75 | 1.51 | 1.28 | 4.39 |
| KV read (hot cache) | Node.js + PostgreSQL | 2000 | 16 | 79.35 | 25,203.89 | 0.632 | 0.564 | 1.72 |
| KV read (99% L1) | Node.js + PostgreSQL | 2000 | 16 | 81.23 | 24,622.66 | 0.646 | 0.602 | 1.73 |
| KV read (95% L1) | Node.js + PostgreSQL | 2000 | 16 | 76.44 | 26,163.33 | 0.607 | 0.542 | 1.78 |
| KV read (90% L1) | Node.js + PostgreSQL | 2000 | 16 | 109.3 | 18,297.6 | 0.874 | 0.727 | 3.18 |
| Counter increment | Node.js + PostgreSQL | 2000 | 16 | 93.22 | 21,455.69 | 0.743 | 0.636 | 2.31 |
| Set add | Node.js + PostgreSQL | 2000 | 16 | 213.45 | 9,369.82 | 1.70 | 1.15 | 13.88 |
| Pub/Sub publish | Node.js + PostgreSQL | 2000 | 16 | 82.85 | 24,138.77 | 0.661 | 0.497 | 1.54 |
| KV read (hot cache) | Node.js + PostgreSQL (L1) | 2000 | 16 | 1.02 | 1,969,927.09 | 0.008 | 0.007 | 0.029 |
| KV read (99% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 2.22 | 899,622.79 | 0.015 | 0.002 | 0.214 |
| KV read (95% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 3.9 | 512,304.66 | 0.030 | 0.000 | 0.872 |
| KV read (90% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 4.55 | 439,866.22 | 0.035 | 0.000 | 0.955 |
| KV write | Bun.js + PostgreSQL | 2000 | 16 | 66.89 | 29,899.49 | 0.532 | 0.436 | 2.75 |
| KV write (batch) | Bun.js + PostgreSQL | 2000 | 16 | 17.03 | 117,423.82 | 2.04 | 1.95 | 4.75 |
| KV read | Bun.js + PostgreSQL | 2000 | 16 | 55.13 | 36,277.53 | 0.438 | 0.364 | 2.11 |
| KV read (batch) | Bun.js + PostgreSQL | 2000 | 16 | 8.49 | 235,568.82 | 0.994 | 0.770 | 3.41 |
| KV read (hot cache) | Bun.js + PostgreSQL | 2000 | 16 | 45.04 | 44,404.43 | 0.358 | 0.316 | 1.04 |
| KV read (99% L1) | Bun.js + PostgreSQL | 2000 | 16 | 44.97 | 44,469.69 | 0.358 | 0.317 | 0.991 |
| KV read (95% L1) | Bun.js + PostgreSQL | 2000 | 16 | 49.82 | 40,141.71 | 0.398 | 0.359 | 0.942 |
| KV read (90% L1) | Bun.js + PostgreSQL | 2000 | 16 | 69.07 | 28,958.19 | 0.552 | 0.443 | 1.81 |
| Counter increment | Bun.js + PostgreSQL | 2000 | 16 | 71.99 | 27,783.17 | 0.572 | 0.461 | 2.37 |
| Set add | Bun.js + PostgreSQL | 2000 | 16 | 137.48 | 14,547.83 | 1.09 | 0.820 | 5.95 |
| Pub/Sub publish | Bun.js + PostgreSQL | 2000 | 16 | 65.53 | 30,520.04 | 0.521 | 0.371 | 1.96 |
| KV read (hot cache) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 1.42 | 1,411,099 | 0.011 | 0.010 | 0.041 |
| KV read (99% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 1.77 | 1,132,799.18 | 0.013 | 0.002 | 0.155 |
| KV read (95% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 4.6 | 434,610.37 | 0.035 | 0.000 | 0.890 |
| KV read (90% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 4.18 | 478,429.98 | 0.033 | 0.001 | 0.775 |

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
