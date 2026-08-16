# Benchmark

Generated at: 2026-08-16T04:45:16.197Z

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
| KV write | 27,208.39 | 0.503 | 5,834.14 | 2.20 | 0.21x | 12,968.46 | 1.03 | 0.48x |
| KV write (batch) | 141,849.96 | 1.81 | 40,496.52 | 5.61 | 0.29x | 59,275.76 | 4.09 | 0.42x |
| KV read | 37,461.71 | 0.416 | 7,693.21 | 1.80 | 0.21x | 17,725.48 | 0.788 | 0.47x |
| KV read (batch) | 255,499.53 | 0.771 | 88,998.63 | 2.38 | 0.35x | 133,540.97 | 1.48 | 0.52x |
| KV read (hot cache) L1 | 37,933.1 | 0.402 | 876,827.25 | 0.016 | 23.12x | 610,761.06 | 0.021 | 16.1x |
| KV read (99% L1) L1 | 38,617.47 | 0.386 | 467,023.47 | 0.005 | 12.09x | 478,795.58 | 0.008 | 12.4x |
| KV read (95% L1) L1 | 40,189.51 | 0.390 | 210,403.4 | 0.001 | 5.24x | 250,334.92 | 0.001 | 6.23x |
| KV read (90% L1) L1 | 35,701.79 | 0.386 | 185,869.74 | 0.001 | 5.21x | 269,145.24 | 0.002 | 7.54x |
| Counter increment | 39,722.06 | 0.382 | 9,525.73 | 1.50 | 0.24x | 11,093.1 | 1.19 | 0.28x |
| Set add | 46,173.52 | 0.319 | 4,098.49 | 2.58 | 0.09x | 5,900.11 | 1.74 | 0.13x |
| Pub/Sub publish | 46,653 | 0.335 | 12,520.65 | 1.17 | 0.27x | 16,187.26 | 0.911 | 0.35x |

## L1 Read Cache

These rows isolate pgredis local memory cache behavior. Mixed hit-rate rows include PostgreSQL misses and are closer to real cache-aside usage than the 100% hot-cache row.

| Operation | Redis | Redis p50 ms | Node PG L1 | Node PG L1 p50 ms | Node PG L1/Redis | Bun PG L1 | Bun PG L1 p50 ms | Bun PG L1/Redis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV read (hot cache) | 37,933.1 | 0.402 | 876,827.25 | 0.016 | 23.12x | 610,761.06 | 0.021 | 16.1x |
| KV read (99% L1) | 38,617.47 | 0.386 | 467,023.47 | 0.005 | 12.09x | 478,795.58 | 0.008 | 12.4x |
| KV read (95% L1) | 40,189.51 | 0.390 | 210,403.4 | 0.001 | 5.24x | 250,334.92 | 0.001 | 6.23x |
| KV read (90% L1) | 35,701.79 | 0.386 | 185,869.74 | 0.001 | 5.21x | 269,145.24 | 0.002 | 7.54x |

## L2 Backend Path

These rows disable pgredis L1 and measure direct PostgreSQL access. They are useful for fallback sizing and regression tracking, not as the main cache-hit comparison.

| Operation | Redis | Redis p50 ms | Node PG L2 | Node PG L2 p50 ms | Node PG L2/Redis | Bun PG L2 | Bun PG L2 p50 ms | Bun PG L2/Redis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV write | 27,208.39 | 0.503 | 5,834.14 | 2.20 | 0.21x | 12,968.46 | 1.03 | 0.48x |
| KV write (batch) | 141,849.96 | 1.81 | 40,496.52 | 5.61 | 0.29x | 59,275.76 | 4.09 | 0.42x |
| KV read | 37,461.71 | 0.416 | 7,693.21 | 1.80 | 0.21x | 17,725.48 | 0.788 | 0.47x |
| KV read (batch) | 255,499.53 | 0.771 | 88,998.63 | 2.38 | 0.35x | 133,540.97 | 1.48 | 0.52x |
| KV read (hot cache) | 37,933.1 | 0.402 | 8,969 | 1.62 | 0.24x | 21,778.48 | 0.656 | 0.57x |
| KV read (99% L1) | 38,617.47 | 0.386 | 9,043.13 | 1.61 | 0.23x | 19,290.41 | 0.747 | 0.5x |
| KV read (95% L1) | 40,189.51 | 0.390 | 9,327.26 | 1.57 | 0.23x | 20,684.23 | 0.691 | 0.51x |
| KV read (90% L1) | 35,701.79 | 0.386 | 8,818.94 | 1.60 | 0.25x | 19,328.51 | 0.748 | 0.54x |
| Counter increment | 39,722.06 | 0.382 | 9,525.73 | 1.50 | 0.24x | 11,093.1 | 1.19 | 0.28x |
| Set add | 46,173.52 | 0.319 | 4,098.49 | 2.58 | 0.09x | 5,900.11 | 1.74 | 0.13x |
| Pub/Sub publish | 46,653 | 0.335 | 12,520.65 | 1.17 | 0.27x | 16,187.26 | 0.911 | 0.35x |

## Details

| Operation | Backend | Iterations | Concurrency | Duration ms | Ops/sec | Avg ms | p50 ms | p99 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV write | Node.js + Redis | 2000 | 16 | 73.51 | 27,208.39 | 0.580 | 0.503 | 2.02 |
| KV write (batch) | Node.js + Redis | 2000 | 16 | 14.1 | 141,849.96 | 1.67 | 1.81 | 2.68 |
| KV read | Node.js + Redis | 2000 | 16 | 53.39 | 37,461.71 | 0.424 | 0.416 | 0.607 |
| KV read (batch) | Node.js + Redis | 2000 | 16 | 7.83 | 255,499.53 | 0.920 | 0.771 | 2.36 |
| KV read (hot cache) | Node.js + Redis | 2000 | 16 | 52.72 | 37,933.1 | 0.418 | 0.402 | 0.720 |
| KV read (99% L1) | Node.js + Redis | 2000 | 16 | 51.79 | 38,617.47 | 0.412 | 0.386 | 1.14 |
| KV read (95% L1) | Node.js + Redis | 2000 | 16 | 49.76 | 40,189.51 | 0.395 | 0.390 | 0.564 |
| KV read (90% L1) | Node.js + Redis | 2000 | 16 | 56.02 | 35,701.79 | 0.446 | 0.386 | 2.26 |
| Counter increment | Node.js + Redis | 2000 | 16 | 50.35 | 39,722.06 | 0.398 | 0.382 | 1.07 |
| Set add | Node.js + Redis | 2000 | 16 | 43.31 | 46,173.52 | 0.344 | 0.319 | 0.603 |
| Pub/Sub publish | Node.js + Redis | 2000 | 16 | 42.87 | 46,653 | 0.340 | 0.335 | 0.566 |
| KV write | Node.js + PostgreSQL | 2000 | 16 | 342.81 | 5,834.14 | 2.74 | 2.20 | 10.50 |
| KV write (batch) | Node.js + PostgreSQL | 2000 | 16 | 49.39 | 40,496.52 | 6.06 | 5.61 | 13.81 |
| KV read | Node.js + PostgreSQL | 2000 | 16 | 259.97 | 7,693.21 | 2.07 | 1.80 | 5.24 |
| KV read (batch) | Node.js + PostgreSQL | 2000 | 16 | 22.47 | 88,998.63 | 2.80 | 2.38 | 5.58 |
| KV read (hot cache) | Node.js + PostgreSQL | 2000 | 16 | 222.99 | 8,969 | 1.78 | 1.62 | 4.08 |
| KV read (99% L1) | Node.js + PostgreSQL | 2000 | 16 | 221.16 | 9,043.13 | 1.76 | 1.61 | 4.04 |
| KV read (95% L1) | Node.js + PostgreSQL | 2000 | 16 | 214.43 | 9,327.26 | 1.71 | 1.57 | 3.72 |
| KV read (90% L1) | Node.js + PostgreSQL | 2000 | 16 | 226.78 | 8,818.94 | 1.81 | 1.60 | 5.05 |
| Counter increment | Node.js + PostgreSQL | 2000 | 16 | 209.96 | 9,525.73 | 1.68 | 1.50 | 5.35 |
| Set add | Node.js + PostgreSQL | 2000 | 16 | 487.98 | 4,098.49 | 3.89 | 2.58 | 36.05 |
| Pub/Sub publish | Node.js + PostgreSQL | 2000 | 16 | 159.74 | 12,520.65 | 1.28 | 1.17 | 2.53 |
| KV read (hot cache) | Node.js + PostgreSQL (L1) | 2000 | 16 | 2.28 | 876,827.25 | 0.018 | 0.016 | 0.049 |
| KV read (99% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 4.28 | 467,023.47 | 0.031 | 0.005 | 0.431 |
| KV read (95% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 9.51 | 210,403.4 | 0.072 | 0.001 | 2.12 |
| KV read (90% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 10.76 | 185,869.74 | 0.083 | 0.001 | 2.27 |
| KV write | Bun.js + PostgreSQL | 2000 | 16 | 154.22 | 12,968.46 | 1.23 | 1.03 | 3.80 |
| KV write (batch) | Bun.js + PostgreSQL | 2000 | 16 | 33.74 | 59,275.76 | 4.06 | 4.09 | 8.39 |
| KV read | Bun.js + PostgreSQL | 2000 | 16 | 112.83 | 17,725.48 | 0.898 | 0.788 | 2.55 |
| KV read (batch) | Bun.js + PostgreSQL | 2000 | 16 | 14.98 | 133,540.97 | 1.78 | 1.48 | 4.37 |
| KV read (hot cache) | Bun.js + PostgreSQL | 2000 | 16 | 91.83 | 21,778.48 | 0.732 | 0.656 | 1.95 |
| KV read (99% L1) | Bun.js + PostgreSQL | 2000 | 16 | 103.68 | 19,290.41 | 0.824 | 0.747 | 2.09 |
| KV read (95% L1) | Bun.js + PostgreSQL | 2000 | 16 | 96.69 | 20,684.23 | 0.771 | 0.691 | 2.35 |
| KV read (90% L1) | Bun.js + PostgreSQL | 2000 | 16 | 103.47 | 19,328.51 | 0.826 | 0.748 | 2.16 |
| Counter increment | Bun.js + PostgreSQL | 2000 | 16 | 180.29 | 11,093.1 | 1.44 | 1.19 | 4.88 |
| Set add | Bun.js + PostgreSQL | 2000 | 16 | 338.98 | 5,900.11 | 2.70 | 1.74 | 28.31 |
| Pub/Sub publish | Bun.js + PostgreSQL | 2000 | 16 | 123.55 | 16,187.26 | 0.984 | 0.911 | 2.34 |
| KV read (hot cache) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 3.27 | 610,761.06 | 0.025 | 0.021 | 0.074 |
| KV read (99% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 4.18 | 478,795.58 | 0.032 | 0.008 | 0.266 |
| KV read (95% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 7.99 | 250,334.92 | 0.060 | 0.001 | 1.72 |
| KV read (90% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 7.43 | 269,145.24 | 0.058 | 0.002 | 1.55 |

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
