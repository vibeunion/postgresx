# Benchmark

Generated at: 2026-09-04T15:31:52.323Z

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
| KV write | 24,403.09 | 0.557 | 4,725.11 | 2.63 | 0.19x | 12,858.37 | 1.04 | 0.53x |
| KV write (batch) | 136,965.5 | 1.39 | 37,738.48 | 5.83 | 0.28x | 63,188.78 | 3.85 | 0.46x |
| KV read | 31,351.28 | 0.445 | 6,146.03 | 2.29 | 0.2x | 17,414.76 | 0.799 | 0.56x |
| KV read (batch) | 177,461.01 | 0.958 | 77,045.66 | 2.93 | 0.43x | 126,014.2 | 1.60 | 0.71x |
| KV read (hot cache) L1 | 36,494.4 | 0.386 | 1,376,057.16 | 0.010 | 37.71x | 884,374.26 | 0.009 | 24.23x |
| KV read (99% L1) L1 | 41,939.41 | 0.332 | 599,004.87 | 0.003 | 14.28x | 686,808 | 0.003 | 16.38x |
| KV read (95% L1) L1 | 36,520.8 | 0.434 | 222,071.88 | 0.001 | 6.08x | 286,481.03 | 0.001 | 7.84x |
| KV read (90% L1) L1 | 29,128.78 | 0.424 | 183,214.31 | 0.001 | 6.29x | 302,209.62 | 0.001 | 10.37x |
| Counter increment | 34,316.11 | 0.454 | 9,215.37 | 1.57 | 0.27x | 10,962.38 | 1.17 | 0.32x |
| Set add | 42,723.94 | 0.332 | 3,839.46 | 2.58 | 0.09x | 6,302.17 | 1.76 | 0.15x |
| Pub/Sub publish | 43,335 | 0.363 | 12,449.88 | 1.20 | 0.29x | 15,499.5 | 0.981 | 0.36x |

## L1 Read Cache

These rows isolate pgredis local memory cache behavior. Mixed hit-rate rows include PostgreSQL misses and are closer to real cache-aside usage than the 100% hot-cache row.

| Operation | Redis | Redis p50 ms | Node PG L1 | Node PG L1 p50 ms | Node PG L1/Redis | Bun PG L1 | Bun PG L1 p50 ms | Bun PG L1/Redis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV read (hot cache) | 36,494.4 | 0.386 | 1,376,057.16 | 0.010 | 37.71x | 884,374.26 | 0.009 | 24.23x |
| KV read (99% L1) | 41,939.41 | 0.332 | 599,004.87 | 0.003 | 14.28x | 686,808 | 0.003 | 16.38x |
| KV read (95% L1) | 36,520.8 | 0.434 | 222,071.88 | 0.001 | 6.08x | 286,481.03 | 0.001 | 7.84x |
| KV read (90% L1) | 29,128.78 | 0.424 | 183,214.31 | 0.001 | 6.29x | 302,209.62 | 0.001 | 10.37x |

## L2 Backend Path

These rows disable pgredis L1 and measure direct PostgreSQL access. They are useful for fallback sizing and regression tracking, not as the main cache-hit comparison.

| Operation | Redis | Redis p50 ms | Node PG L2 | Node PG L2 p50 ms | Node PG L2/Redis | Bun PG L2 | Bun PG L2 p50 ms | Bun PG L2/Redis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV write | 24,403.09 | 0.557 | 4,725.11 | 2.63 | 0.19x | 12,858.37 | 1.04 | 0.53x |
| KV write (batch) | 136,965.5 | 1.39 | 37,738.48 | 5.83 | 0.28x | 63,188.78 | 3.85 | 0.46x |
| KV read | 31,351.28 | 0.445 | 6,146.03 | 2.29 | 0.2x | 17,414.76 | 0.799 | 0.56x |
| KV read (batch) | 177,461.01 | 0.958 | 77,045.66 | 2.93 | 0.43x | 126,014.2 | 1.60 | 0.71x |
| KV read (hot cache) | 36,494.4 | 0.386 | 7,322.37 | 1.93 | 0.2x | 18,396.31 | 0.784 | 0.5x |
| KV read (99% L1) | 41,939.41 | 0.332 | 8,173.52 | 1.71 | 0.19x | 19,339.33 | 0.758 | 0.46x |
| KV read (95% L1) | 36,520.8 | 0.434 | 9,334.12 | 1.57 | 0.26x | 19,593.93 | 0.758 | 0.54x |
| KV read (90% L1) | 29,128.78 | 0.424 | 9,005.97 | 1.58 | 0.31x | 19,377.25 | 0.739 | 0.67x |
| Counter increment | 34,316.11 | 0.454 | 9,215.37 | 1.57 | 0.27x | 10,962.38 | 1.17 | 0.32x |
| Set add | 42,723.94 | 0.332 | 3,839.46 | 2.58 | 0.09x | 6,302.17 | 1.76 | 0.15x |
| Pub/Sub publish | 43,335 | 0.363 | 12,449.88 | 1.20 | 0.29x | 15,499.5 | 0.981 | 0.36x |

## Details

| Operation | Backend | Iterations | Concurrency | Duration ms | Ops/sec | Avg ms | p50 ms | p99 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV write | Node.js + Redis | 2000 | 16 | 81.96 | 24,403.09 | 0.647 | 0.557 | 2.15 |
| KV write (batch) | Node.js + Redis | 2000 | 16 | 14.6 | 136,965.5 | 1.77 | 1.39 | 3.29 |
| KV read | Node.js + Redis | 2000 | 16 | 63.79 | 31,351.28 | 0.507 | 0.445 | 1.16 |
| KV read (batch) | Node.js + Redis | 2000 | 16 | 11.27 | 177,461.01 | 1.36 | 0.958 | 4.95 |
| KV read (hot cache) | Node.js + Redis | 2000 | 16 | 54.8 | 36,494.4 | 0.436 | 0.386 | 1.39 |
| KV read (99% L1) | Node.js + Redis | 2000 | 16 | 47.69 | 41,939.41 | 0.378 | 0.332 | 0.946 |
| KV read (95% L1) | Node.js + Redis | 2000 | 16 | 54.76 | 36,520.8 | 0.436 | 0.434 | 0.638 |
| KV read (90% L1) | Node.js + Redis | 2000 | 16 | 68.66 | 29,128.78 | 0.547 | 0.424 | 2.18 |
| Counter increment | Node.js + Redis | 2000 | 16 | 58.28 | 34,316.11 | 0.462 | 0.454 | 0.926 |
| Set add | Node.js + Redis | 2000 | 16 | 46.81 | 42,723.94 | 0.371 | 0.332 | 0.703 |
| Pub/Sub publish | Node.js + Redis | 2000 | 16 | 46.15 | 43,335 | 0.367 | 0.363 | 0.551 |
| KV write | Node.js + PostgreSQL | 2000 | 16 | 423.27 | 4,725.11 | 3.38 | 2.63 | 10.95 |
| KV write (batch) | Node.js + PostgreSQL | 2000 | 16 | 53 | 37,738.48 | 6.52 | 5.83 | 15.82 |
| KV read | Node.js + PostgreSQL | 2000 | 16 | 325.41 | 6,146.03 | 2.60 | 2.29 | 5.67 |
| KV read (batch) | Node.js + PostgreSQL | 2000 | 16 | 25.96 | 77,045.66 | 3.24 | 2.93 | 7.72 |
| KV read (hot cache) | Node.js + PostgreSQL | 2000 | 16 | 273.14 | 7,322.37 | 2.18 | 1.93 | 5.07 |
| KV read (99% L1) | Node.js + PostgreSQL | 2000 | 16 | 244.69 | 8,173.52 | 1.95 | 1.71 | 5.09 |
| KV read (95% L1) | Node.js + PostgreSQL | 2000 | 16 | 214.27 | 9,334.12 | 1.71 | 1.57 | 3.76 |
| KV read (90% L1) | Node.js + PostgreSQL | 2000 | 16 | 222.07 | 9,005.97 | 1.77 | 1.58 | 4.38 |
| Counter increment | Node.js + PostgreSQL | 2000 | 16 | 217.03 | 9,215.37 | 1.73 | 1.57 | 4.76 |
| Set add | Node.js + PostgreSQL | 2000 | 16 | 520.91 | 3,839.46 | 4.12 | 2.58 | 37.13 |
| Pub/Sub publish | Node.js + PostgreSQL | 2000 | 16 | 160.64 | 12,449.88 | 1.28 | 1.20 | 2.53 |
| KV read (hot cache) | Node.js + PostgreSQL (L1) | 2000 | 16 | 1.45 | 1,376,057.16 | 0.011 | 0.010 | 0.034 |
| KV read (99% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 3.34 | 599,004.87 | 0.023 | 0.003 | 0.420 |
| KV read (95% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 9.01 | 222,071.88 | 0.071 | 0.001 | 2.20 |
| KV read (90% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 10.92 | 183,214.31 | 0.086 | 0.001 | 2.33 |
| KV write | Bun.js + PostgreSQL | 2000 | 16 | 155.54 | 12,858.37 | 1.24 | 1.04 | 4.63 |
| KV write (batch) | Bun.js + PostgreSQL | 2000 | 16 | 31.65 | 63,188.78 | 3.80 | 3.85 | 8.80 |
| KV read | Bun.js + PostgreSQL | 2000 | 16 | 114.85 | 17,414.76 | 0.915 | 0.799 | 2.51 |
| KV read (batch) | Bun.js + PostgreSQL | 2000 | 16 | 15.87 | 126,014.2 | 1.91 | 1.60 | 4.43 |
| KV read (hot cache) | Bun.js + PostgreSQL | 2000 | 16 | 108.72 | 18,396.31 | 0.866 | 0.784 | 1.98 |
| KV read (99% L1) | Bun.js + PostgreSQL | 2000 | 16 | 103.42 | 19,339.33 | 0.823 | 0.758 | 1.86 |
| KV read (95% L1) | Bun.js + PostgreSQL | 2000 | 16 | 102.07 | 19,593.93 | 0.814 | 0.758 | 1.95 |
| KV read (90% L1) | Bun.js + PostgreSQL | 2000 | 16 | 103.21 | 19,377.25 | 0.824 | 0.739 | 2.18 |
| Counter increment | Bun.js + PostgreSQL | 2000 | 16 | 182.44 | 10,962.38 | 1.45 | 1.17 | 5.07 |
| Set add | Bun.js + PostgreSQL | 2000 | 16 | 317.35 | 6,302.17 | 2.53 | 1.76 | 22.61 |
| Pub/Sub publish | Bun.js + PostgreSQL | 2000 | 16 | 129.04 | 15,499.5 | 1.03 | 0.981 | 2.46 |
| KV read (hot cache) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 2.26 | 884,374.26 | 0.017 | 0.009 | 0.059 |
| KV read (99% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 2.91 | 686,808 | 0.022 | 0.003 | 0.325 |
| KV read (95% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 6.98 | 286,481.03 | 0.053 | 0.001 | 1.61 |
| KV read (90% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 6.62 | 302,209.62 | 0.052 | 0.001 | 1.49 |

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
