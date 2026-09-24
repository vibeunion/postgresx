# Benchmark

Generated at: 2026-09-24T09:35:07.478Z

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
| KV write | 34,946.84 | 0.361 | 6,658.45 | 1.92 | 0.19x | 16,285.46 | 0.824 | 0.47x |
| KV write (batch) | 208,683.66 | 0.949 | 42,391.8 | 5.41 | 0.2x | 69,025.92 | 3.20 | 0.33x |
| KV read | 47,037.33 | 0.298 | 9,045.22 | 1.59 | 0.19x | 20,427.14 | 0.669 | 0.43x |
| KV read (batch) | 305,747.38 | 0.638 | 111,631.48 | 2.05 | 0.37x | 135,492.79 | 1.50 | 0.44x |
| KV read (hot cache) L1 | 48,213.38 | 0.301 | 1,234,217.44 | 0.011 | 25.6x | 1,096,018.33 | 0.009 | 22.73x |
| KV read (99% L1) L1 | 52,442.3 | 0.279 | 674,252.91 | 0.003 | 12.86x | 552,798.01 | 0.004 | 10.54x |
| KV read (95% L1) L1 | 48,380.59 | 0.309 | 237,840.41 | 0.001 | 4.92x | 381,149.05 | 0.001 | 7.88x |
| KV read (90% L1) L1 | 44,366.62 | 0.282 | 171,191.27 | 0.001 | 3.86x | 321,450.49 | 0.001 | 7.25x |
| Counter increment | 51,132.36 | 0.292 | 8,941.06 | 1.57 | 0.17x | 14,011.16 | 0.893 | 0.27x |
| Set add | 55,425.35 | 0.264 | 4,715.54 | 2.31 | 0.09x | 7,321.89 | 1.59 | 0.13x |
| Pub/Sub publish | 61,109.98 | 0.254 | 16,279.79 | 0.809 | 0.27x | 20,766.46 | 0.709 | 0.34x |

## L1 Read Cache

These rows isolate pgredis local memory cache behavior. Mixed hit-rate rows include PostgreSQL misses and are closer to real cache-aside usage than the 100% hot-cache row.

| Operation | Redis | Redis p50 ms | Node PG L1 | Node PG L1 p50 ms | Node PG L1/Redis | Bun PG L1 | Bun PG L1 p50 ms | Bun PG L1/Redis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV read (hot cache) | 48,213.38 | 0.301 | 1,234,217.44 | 0.011 | 25.6x | 1,096,018.33 | 0.009 | 22.73x |
| KV read (99% L1) | 52,442.3 | 0.279 | 674,252.91 | 0.003 | 12.86x | 552,798.01 | 0.004 | 10.54x |
| KV read (95% L1) | 48,380.59 | 0.309 | 237,840.41 | 0.001 | 4.92x | 381,149.05 | 0.001 | 7.88x |
| KV read (90% L1) | 44,366.62 | 0.282 | 171,191.27 | 0.001 | 3.86x | 321,450.49 | 0.001 | 7.25x |

## L2 Backend Path

These rows disable pgredis L1 and measure direct PostgreSQL access. They are useful for fallback sizing and regression tracking, not as the main cache-hit comparison.

| Operation | Redis | Redis p50 ms | Node PG L2 | Node PG L2 p50 ms | Node PG L2/Redis | Bun PG L2 | Bun PG L2 p50 ms | Bun PG L2/Redis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV write | 34,946.84 | 0.361 | 6,658.45 | 1.92 | 0.19x | 16,285.46 | 0.824 | 0.47x |
| KV write (batch) | 208,683.66 | 0.949 | 42,391.8 | 5.41 | 0.2x | 69,025.92 | 3.20 | 0.33x |
| KV read | 47,037.33 | 0.298 | 9,045.22 | 1.59 | 0.19x | 20,427.14 | 0.669 | 0.43x |
| KV read (batch) | 305,747.38 | 0.638 | 111,631.48 | 2.05 | 0.37x | 135,492.79 | 1.50 | 0.44x |
| KV read (hot cache) | 48,213.38 | 0.301 | 18,089.17 | 0.836 | 0.38x | 33,495.19 | 0.434 | 0.69x |
| KV read (99% L1) | 52,442.3 | 0.279 | 18,547.31 | 0.804 | 0.35x | 32,522.53 | 0.456 | 0.62x |
| KV read (95% L1) | 48,380.59 | 0.309 | 17,832.23 | 0.840 | 0.37x | 30,937.23 | 0.465 | 0.64x |
| KV read (90% L1) | 44,366.62 | 0.282 | 15,223.45 | 0.959 | 0.34x | 32,040.11 | 0.464 | 0.72x |
| Counter increment | 51,132.36 | 0.292 | 8,941.06 | 1.57 | 0.17x | 14,011.16 | 0.893 | 0.27x |
| Set add | 55,425.35 | 0.264 | 4,715.54 | 2.31 | 0.09x | 7,321.89 | 1.59 | 0.13x |
| Pub/Sub publish | 61,109.98 | 0.254 | 16,279.79 | 0.809 | 0.27x | 20,766.46 | 0.709 | 0.34x |

## Details

| Operation | Backend | Iterations | Concurrency | Duration ms | Ops/sec | Avg ms | p50 ms | p99 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV write | Node.js + Redis | 2000 | 16 | 57.23 | 34,946.84 | 0.451 | 0.361 | 2.07 |
| KV write (batch) | Node.js + Redis | 2000 | 16 | 9.58 | 208,683.66 | 1.12 | 0.949 | 2.55 |
| KV read | Node.js + Redis | 2000 | 16 | 42.52 | 47,037.33 | 0.337 | 0.298 | 1.15 |
| KV read (batch) | Node.js + Redis | 2000 | 16 | 6.54 | 305,747.38 | 0.789 | 0.638 | 2.05 |
| KV read (hot cache) | Node.js + Redis | 2000 | 16 | 41.48 | 48,213.38 | 0.329 | 0.301 | 1.12 |
| KV read (99% L1) | Node.js + Redis | 2000 | 16 | 38.14 | 52,442.3 | 0.302 | 0.279 | 0.513 |
| KV read (95% L1) | Node.js + Redis | 2000 | 16 | 41.34 | 48,380.59 | 0.328 | 0.309 | 0.484 |
| KV read (90% L1) | Node.js + Redis | 2000 | 16 | 45.08 | 44,366.62 | 0.359 | 0.282 | 1.56 |
| Counter increment | Node.js + Redis | 2000 | 16 | 39.11 | 51,132.36 | 0.309 | 0.292 | 0.540 |
| Set add | Node.js + Redis | 2000 | 16 | 36.08 | 55,425.35 | 0.286 | 0.264 | 0.406 |
| Pub/Sub publish | Node.js + Redis | 2000 | 16 | 32.73 | 61,109.98 | 0.259 | 0.254 | 0.384 |
| KV write | Node.js + PostgreSQL | 2000 | 16 | 300.37 | 6,658.45 | 2.40 | 1.92 | 5.76 |
| KV write (batch) | Node.js + PostgreSQL | 2000 | 16 | 47.18 | 42,391.8 | 5.84 | 5.41 | 16.38 |
| KV read | Node.js + PostgreSQL | 2000 | 16 | 221.11 | 9,045.22 | 1.76 | 1.59 | 4.85 |
| KV read (batch) | Node.js + PostgreSQL | 2000 | 16 | 17.92 | 111,631.48 | 2.20 | 2.05 | 5.06 |
| KV read (hot cache) | Node.js + PostgreSQL | 2000 | 16 | 110.56 | 18,089.17 | 0.882 | 0.836 | 2.92 |
| KV read (99% L1) | Node.js + PostgreSQL | 2000 | 16 | 107.83 | 18,547.31 | 0.860 | 0.804 | 2.56 |
| KV read (95% L1) | Node.js + PostgreSQL | 2000 | 16 | 112.16 | 17,832.23 | 0.892 | 0.840 | 2.84 |
| KV read (90% L1) | Node.js + PostgreSQL | 2000 | 16 | 131.38 | 15,223.45 | 1.05 | 0.959 | 3.46 |
| Counter increment | Node.js + PostgreSQL | 2000 | 16 | 223.69 | 8,941.06 | 1.78 | 1.57 | 5.48 |
| Set add | Node.js + PostgreSQL | 2000 | 16 | 424.13 | 4,715.54 | 3.39 | 2.31 | 33.20 |
| Pub/Sub publish | Node.js + PostgreSQL | 2000 | 16 | 122.85 | 16,279.79 | 0.980 | 0.809 | 2.13 |
| KV read (hot cache) | Node.js + PostgreSQL (L1) | 2000 | 16 | 1.62 | 1,234,217.44 | 0.012 | 0.011 | 0.038 |
| KV read (99% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 2.97 | 674,252.91 | 0.022 | 0.003 | 0.473 |
| KV read (95% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 8.41 | 237,840.41 | 0.066 | 0.001 | 1.92 |
| KV read (90% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 11.68 | 171,191.27 | 0.089 | 0.001 | 2.52 |
| KV write | Bun.js + PostgreSQL | 2000 | 16 | 122.81 | 16,285.46 | 0.976 | 0.824 | 3.88 |
| KV write (batch) | Bun.js + PostgreSQL | 2000 | 16 | 28.97 | 69,025.92 | 3.47 | 3.20 | 8.58 |
| KV read | Bun.js + PostgreSQL | 2000 | 16 | 97.91 | 20,427.14 | 0.779 | 0.669 | 2.42 |
| KV read (batch) | Bun.js + PostgreSQL | 2000 | 16 | 14.76 | 135,492.79 | 1.76 | 1.50 | 5.55 |
| KV read (hot cache) | Bun.js + PostgreSQL | 2000 | 16 | 59.71 | 33,495.19 | 0.475 | 0.434 | 1.61 |
| KV read (99% L1) | Bun.js + PostgreSQL | 2000 | 16 | 61.5 | 32,522.53 | 0.489 | 0.456 | 1.52 |
| KV read (95% L1) | Bun.js + PostgreSQL | 2000 | 16 | 64.65 | 30,937.23 | 0.515 | 0.465 | 1.65 |
| KV read (90% L1) | Bun.js + PostgreSQL | 2000 | 16 | 62.42 | 32,040.11 | 0.497 | 0.464 | 1.41 |
| Counter increment | Bun.js + PostgreSQL | 2000 | 16 | 142.74 | 14,011.16 | 1.14 | 0.893 | 4.13 |
| Set add | Bun.js + PostgreSQL | 2000 | 16 | 273.15 | 7,321.89 | 2.18 | 1.59 | 18.61 |
| Pub/Sub publish | Bun.js + PostgreSQL | 2000 | 16 | 96.31 | 20,766.46 | 0.767 | 0.709 | 2.04 |
| KV read (hot cache) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 1.82 | 1,096,018.33 | 0.013 | 0.009 | 0.057 |
| KV read (99% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 3.62 | 552,798.01 | 0.028 | 0.004 | 0.745 |
| KV read (95% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 5.25 | 381,149.05 | 0.040 | 0.001 | 1.22 |
| KV read (90% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 6.22 | 321,450.49 | 0.049 | 0.001 | 1.13 |

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
