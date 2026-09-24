# Benchmark

Generated at: 2026-09-24T07:48:26.336Z

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
| KV write | 58,146.79 | 0.213 | 9,971.96 | 1.23 | 0.17x | 26,057.91 | 0.461 | 0.45x |
| KV write (batch) | 180,198.75 | 1.61 | 57,534.87 | 3.55 | 0.32x | 80,357.57 | 2.96 | 0.45x |
| KV read | 82,328.81 | 0.170 | 15,360.49 | 0.916 | 0.19x | 31,115.74 | 0.394 | 0.38x |
| KV read (batch) | 444,953.27 | 0.524 | 152,519 | 1.36 | 0.34x | 170,448.94 | 1.27 | 0.38x |
| KV read (hot cache) L1 | 81,323 | 0.172 | 1,227,283.74 | 0.011 | 15.09x | 1,155,667.89 | 0.012 | 14.21x |
| KV read (99% L1) L1 | 99,817.11 | 0.141 | 731,587.23 | 0.004 | 7.33x | 723,528.27 | 0.003 | 7.25x |
| KV read (95% L1) L1 | 97,520.5 | 0.154 | 316,188.44 | 0.001 | 3.24x | 466,440.75 | 0.001 | 4.78x |
| KV read (90% L1) L1 | 71,214.32 | 0.149 | 306,400.15 | 0.001 | 4.3x | 462,184.42 | 0.001 | 6.49x |
| Counter increment | 90,507.24 | 0.160 | 12,568.82 | 0.943 | 0.14x | 26,808.35 | 0.457 | 0.3x |
| Set add | 101,157.98 | 0.135 | 5,933.04 | 1.60 | 0.06x | 9,798.65 | 1.06 | 0.1x |
| Pub/Sub publish | 113,352.36 | 0.136 | 25,269.8 | 0.429 | 0.22x | 36,255.03 | 0.394 | 0.32x |

## L1 Read Cache

These rows isolate pgredis local memory cache behavior. Mixed hit-rate rows include PostgreSQL misses and are closer to real cache-aside usage than the 100% hot-cache row.

| Operation | Redis | Redis p50 ms | Node PG L1 | Node PG L1 p50 ms | Node PG L1/Redis | Bun PG L1 | Bun PG L1 p50 ms | Bun PG L1/Redis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV read (hot cache) | 81,323 | 0.172 | 1,227,283.74 | 0.011 | 15.09x | 1,155,667.89 | 0.012 | 14.21x |
| KV read (99% L1) | 99,817.11 | 0.141 | 731,587.23 | 0.004 | 7.33x | 723,528.27 | 0.003 | 7.25x |
| KV read (95% L1) | 97,520.5 | 0.154 | 316,188.44 | 0.001 | 3.24x | 466,440.75 | 0.001 | 4.78x |
| KV read (90% L1) | 71,214.32 | 0.149 | 306,400.15 | 0.001 | 4.3x | 462,184.42 | 0.001 | 6.49x |

## L2 Backend Path

These rows disable pgredis L1 and measure direct PostgreSQL access. They are useful for fallback sizing and regression tracking, not as the main cache-hit comparison.

| Operation | Redis | Redis p50 ms | Node PG L2 | Node PG L2 p50 ms | Node PG L2/Redis | Bun PG L2 | Bun PG L2 p50 ms | Bun PG L2/Redis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV write | 58,146.79 | 0.213 | 9,971.96 | 1.23 | 0.17x | 26,057.91 | 0.461 | 0.45x |
| KV write (batch) | 180,198.75 | 1.61 | 57,534.87 | 3.55 | 0.32x | 80,357.57 | 2.96 | 0.45x |
| KV read | 82,328.81 | 0.170 | 15,360.49 | 0.916 | 0.19x | 31,115.74 | 0.394 | 0.38x |
| KV read (batch) | 444,953.27 | 0.524 | 152,519 | 1.36 | 0.34x | 170,448.94 | 1.27 | 0.38x |
| KV read (hot cache) | 81,323 | 0.172 | 18,955.01 | 0.749 | 0.23x | 32,925.09 | 0.438 | 0.4x |
| KV read (99% L1) | 99,817.11 | 0.141 | 18,444.95 | 0.773 | 0.18x | 38,971.07 | 0.376 | 0.39x |
| KV read (95% L1) | 97,520.5 | 0.154 | 14,506.22 | 0.881 | 0.15x | 35,625.72 | 0.401 | 0.37x |
| KV read (90% L1) | 71,214.32 | 0.149 | 15,931.21 | 0.820 | 0.22x | 37,281.74 | 0.375 | 0.52x |
| Counter increment | 90,507.24 | 0.160 | 12,568.82 | 0.943 | 0.14x | 26,808.35 | 0.457 | 0.3x |
| Set add | 101,157.98 | 0.135 | 5,933.04 | 1.60 | 0.06x | 9,798.65 | 1.06 | 0.1x |
| Pub/Sub publish | 113,352.36 | 0.136 | 25,269.8 | 0.429 | 0.22x | 36,255.03 | 0.394 | 0.32x |

## Details

| Operation | Backend | Iterations | Concurrency | Duration ms | Ops/sec | Avg ms | p50 ms | p99 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV write | Node.js + Redis | 2000 | 16 | 34.4 | 58,146.79 | 0.271 | 0.213 | 1.72 |
| KV write (batch) | Node.js + Redis | 2000 | 16 | 11.1 | 180,198.75 | 1.24 | 1.61 | 2.27 |
| KV read | Node.js + Redis | 2000 | 16 | 24.29 | 82,328.81 | 0.193 | 0.170 | 0.944 |
| KV read (batch) | Node.js + Redis | 2000 | 16 | 4.49 | 444,953.27 | 0.533 | 0.524 | 0.831 |
| KV read (hot cache) | Node.js + Redis | 2000 | 16 | 24.59 | 81,323 | 0.195 | 0.172 | 0.484 |
| KV read (99% L1) | Node.js + Redis | 2000 | 16 | 20.04 | 99,817.11 | 0.159 | 0.141 | 0.301 |
| KV read (95% L1) | Node.js + Redis | 2000 | 16 | 20.51 | 97,520.5 | 0.163 | 0.154 | 0.467 |
| KV read (90% L1) | Node.js + Redis | 2000 | 16 | 28.08 | 71,214.32 | 0.223 | 0.149 | 2.24 |
| Counter increment | Node.js + Redis | 2000 | 16 | 22.1 | 90,507.24 | 0.173 | 0.160 | 0.458 |
| Set add | Node.js + Redis | 2000 | 16 | 19.77 | 101,157.98 | 0.156 | 0.135 | 0.268 |
| Pub/Sub publish | Node.js + Redis | 2000 | 16 | 17.64 | 113,352.36 | 0.140 | 0.136 | 0.214 |
| KV write | Node.js + PostgreSQL | 2000 | 16 | 200.56 | 9,971.96 | 1.60 | 1.23 | 5.09 |
| KV write (batch) | Node.js + PostgreSQL | 2000 | 16 | 34.76 | 57,534.87 | 4.35 | 3.55 | 15.79 |
| KV read | Node.js + PostgreSQL | 2000 | 16 | 130.2 | 15,360.49 | 1.04 | 0.916 | 3.38 |
| KV read (batch) | Node.js + PostgreSQL | 2000 | 16 | 13.11 | 152,519 | 1.59 | 1.36 | 3.73 |
| KV read (hot cache) | Node.js + PostgreSQL | 2000 | 16 | 105.51 | 18,955.01 | 0.841 | 0.749 | 2.45 |
| KV read (99% L1) | Node.js + PostgreSQL | 2000 | 16 | 108.43 | 18,444.95 | 0.864 | 0.773 | 2.29 |
| KV read (95% L1) | Node.js + PostgreSQL | 2000 | 16 | 137.87 | 14,506.22 | 1.10 | 0.881 | 4.64 |
| KV read (90% L1) | Node.js + PostgreSQL | 2000 | 16 | 125.54 | 15,931.21 | 1.00 | 0.820 | 3.35 |
| Counter increment | Node.js + PostgreSQL | 2000 | 16 | 159.12 | 12,568.82 | 1.27 | 0.943 | 6.38 |
| Set add | Node.js + PostgreSQL | 2000 | 16 | 337.1 | 5,933.04 | 2.69 | 1.60 | 37.40 |
| Pub/Sub publish | Node.js + PostgreSQL | 2000 | 16 | 79.15 | 25,269.8 | 0.630 | 0.429 | 1.96 |
| KV read (hot cache) | Node.js + PostgreSQL (L1) | 2000 | 16 | 1.63 | 1,227,283.74 | 0.012 | 0.011 | 0.036 |
| KV read (99% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 2.73 | 731,587.23 | 0.021 | 0.004 | 0.278 |
| KV read (95% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 6.33 | 316,188.44 | 0.049 | 0.001 | 1.45 |
| KV read (90% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 6.53 | 306,400.15 | 0.050 | 0.001 | 1.40 |
| KV write | Bun.js + PostgreSQL | 2000 | 16 | 76.75 | 26,057.91 | 0.610 | 0.461 | 2.64 |
| KV write (batch) | Bun.js + PostgreSQL | 2000 | 16 | 24.89 | 80,357.57 | 2.99 | 2.96 | 7.24 |
| KV read | Bun.js + PostgreSQL | 2000 | 16 | 64.28 | 31,115.74 | 0.511 | 0.394 | 2.04 |
| KV read (batch) | Bun.js + PostgreSQL | 2000 | 16 | 11.73 | 170,448.94 | 1.38 | 1.27 | 3.60 |
| KV read (hot cache) | Bun.js + PostgreSQL | 2000 | 16 | 60.74 | 32,925.09 | 0.484 | 0.438 | 1.45 |
| KV read (99% L1) | Bun.js + PostgreSQL | 2000 | 16 | 51.32 | 38,971.07 | 0.408 | 0.376 | 1.16 |
| KV read (95% L1) | Bun.js + PostgreSQL | 2000 | 16 | 56.14 | 35,625.72 | 0.448 | 0.401 | 1.27 |
| KV read (90% L1) | Bun.js + PostgreSQL | 2000 | 16 | 53.65 | 37,281.74 | 0.428 | 0.375 | 1.50 |
| Counter increment | Bun.js + PostgreSQL | 2000 | 16 | 74.6 | 26,808.35 | 0.593 | 0.457 | 2.33 |
| Set add | Bun.js + PostgreSQL | 2000 | 16 | 204.11 | 9,798.65 | 1.63 | 1.06 | 10.04 |
| Pub/Sub publish | Bun.js + PostgreSQL | 2000 | 16 | 55.16 | 36,255.03 | 0.439 | 0.394 | 1.52 |
| KV read (hot cache) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 1.73 | 1,155,667.89 | 0.013 | 0.012 | 0.067 |
| KV read (99% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 2.76 | 723,528.27 | 0.021 | 0.003 | 0.292 |
| KV read (95% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 4.29 | 466,440.75 | 0.031 | 0.001 | 0.879 |
| KV read (90% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 4.33 | 462,184.42 | 0.034 | 0.001 | 0.842 |

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
