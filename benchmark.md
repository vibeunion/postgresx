# Benchmark

Generated at: 2026-09-24T09:24:48.983Z

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
| KV write | 27,859.95 | 0.414 | 4,902.28 | 2.62 | 0.18x | 13,014.37 | 1.02 | 0.47x |
| KV write (batch) | 127,472.13 | 1.79 | 35,617.72 | 6.91 | 0.28x | 65,247.43 | 3.55 | 0.51x |
| KV read | 37,421.67 | 0.389 | 6,283.2 | 2.37 | 0.17x | 15,485.84 | 0.861 | 0.41x |
| KV read (batch) | 214,257.16 | 0.718 | 78,930.06 | 2.62 | 0.37x | 146,906.53 | 1.48 | 0.69x |
| KV read (hot cache) L1 | 43,192.65 | 0.322 | 1,312,640.86 | 0.011 | 30.39x | 1,203,236.22 | 0.011 | 27.86x |
| KV read (99% L1) L1 | 47,412.04 | 0.302 | 559,698.41 | 0.003 | 11.8x | 750,350.79 | 0.004 | 15.83x |
| KV read (95% L1) L1 | 45,130.42 | 0.333 | 184,772.65 | 0.001 | 4.09x | 407,083.91 | 0.001 | 9.02x |
| KV read (90% L1) L1 | 38,847.42 | 0.300 | 164,677.78 | 0.001 | 4.24x | 305,601.99 | 0.001 | 7.87x |
| Counter increment | 45,503.88 | 0.306 | 6,948.62 | 2.02 | 0.15x | 13,901.98 | 0.930 | 0.31x |
| Set add | 51,081.21 | 0.272 | 4,272.58 | 3.06 | 0.08x | 7,169.44 | 1.62 | 0.14x |
| Pub/Sub publish | 54,374.51 | 0.280 | 11,835.62 | 1.26 | 0.22x | 22,078.46 | 0.668 | 0.41x |

## L1 Read Cache

These rows isolate pgredis local memory cache behavior. Mixed hit-rate rows include PostgreSQL misses and are closer to real cache-aside usage than the 100% hot-cache row.

| Operation | Redis | Redis p50 ms | Node PG L1 | Node PG L1 p50 ms | Node PG L1/Redis | Bun PG L1 | Bun PG L1 p50 ms | Bun PG L1/Redis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV read (hot cache) | 43,192.65 | 0.322 | 1,312,640.86 | 0.011 | 30.39x | 1,203,236.22 | 0.011 | 27.86x |
| KV read (99% L1) | 47,412.04 | 0.302 | 559,698.41 | 0.003 | 11.8x | 750,350.79 | 0.004 | 15.83x |
| KV read (95% L1) | 45,130.42 | 0.333 | 184,772.65 | 0.001 | 4.09x | 407,083.91 | 0.001 | 9.02x |
| KV read (90% L1) | 38,847.42 | 0.300 | 164,677.78 | 0.001 | 4.24x | 305,601.99 | 0.001 | 7.87x |

## L2 Backend Path

These rows disable pgredis L1 and measure direct PostgreSQL access. They are useful for fallback sizing and regression tracking, not as the main cache-hit comparison.

| Operation | Redis | Redis p50 ms | Node PG L2 | Node PG L2 p50 ms | Node PG L2/Redis | Bun PG L2 | Bun PG L2 p50 ms | Bun PG L2/Redis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV write | 27,859.95 | 0.414 | 4,902.28 | 2.62 | 0.18x | 13,014.37 | 1.02 | 0.47x |
| KV write (batch) | 127,472.13 | 1.79 | 35,617.72 | 6.91 | 0.28x | 65,247.43 | 3.55 | 0.51x |
| KV read | 37,421.67 | 0.389 | 6,283.2 | 2.37 | 0.17x | 15,485.84 | 0.861 | 0.41x |
| KV read (batch) | 214,257.16 | 0.718 | 78,930.06 | 2.62 | 0.37x | 146,906.53 | 1.48 | 0.69x |
| KV read (hot cache) | 43,192.65 | 0.322 | 13,587.15 | 1.03 | 0.31x | 33,524.69 | 0.440 | 0.78x |
| KV read (99% L1) | 47,412.04 | 0.302 | 14,402.96 | 1.05 | 0.3x | 33,955.88 | 0.436 | 0.72x |
| KV read (95% L1) | 45,130.42 | 0.333 | 10,697.3 | 1.42 | 0.24x | 32,027.11 | 0.464 | 0.71x |
| KV read (90% L1) | 38,847.42 | 0.300 | 10,678.25 | 1.35 | 0.27x | 29,772.62 | 0.496 | 0.77x |
| Counter increment | 45,503.88 | 0.306 | 6,948.62 | 2.02 | 0.15x | 13,901.98 | 0.930 | 0.31x |
| Set add | 51,081.21 | 0.272 | 4,272.58 | 3.06 | 0.08x | 7,169.44 | 1.62 | 0.14x |
| Pub/Sub publish | 54,374.51 | 0.280 | 11,835.62 | 1.26 | 0.22x | 22,078.46 | 0.668 | 0.41x |

## Details

| Operation | Backend | Iterations | Concurrency | Duration ms | Ops/sec | Avg ms | p50 ms | p99 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV write | Node.js + Redis | 2000 | 16 | 71.79 | 27,859.95 | 0.568 | 0.414 | 1.85 |
| KV write (batch) | Node.js + Redis | 2000 | 16 | 15.69 | 127,472.13 | 1.87 | 1.79 | 3.69 |
| KV read | Node.js + Redis | 2000 | 16 | 53.44 | 37,421.67 | 0.425 | 0.389 | 0.859 |
| KV read (batch) | Node.js + Redis | 2000 | 16 | 9.33 | 214,257.16 | 1.10 | 0.718 | 3.15 |
| KV read (hot cache) | Node.js + Redis | 2000 | 16 | 46.3 | 43,192.65 | 0.368 | 0.322 | 0.882 |
| KV read (99% L1) | Node.js + Redis | 2000 | 16 | 42.18 | 47,412.04 | 0.335 | 0.302 | 0.926 |
| KV read (95% L1) | Node.js + Redis | 2000 | 16 | 44.32 | 45,130.42 | 0.352 | 0.333 | 0.804 |
| KV read (90% L1) | Node.js + Redis | 2000 | 16 | 51.48 | 38,847.42 | 0.409 | 0.300 | 2.42 |
| Counter increment | Node.js + Redis | 2000 | 16 | 43.95 | 45,503.88 | 0.347 | 0.306 | 1.08 |
| Set add | Node.js + Redis | 2000 | 16 | 39.15 | 51,081.21 | 0.311 | 0.272 | 0.845 |
| Pub/Sub publish | Node.js + Redis | 2000 | 16 | 36.78 | 54,374.51 | 0.292 | 0.280 | 0.496 |
| KV write | Node.js + PostgreSQL | 2000 | 16 | 407.97 | 4,902.28 | 3.26 | 2.62 | 8.73 |
| KV write (batch) | Node.js + PostgreSQL | 2000 | 16 | 56.15 | 35,617.72 | 7.11 | 6.91 | 14.17 |
| KV read | Node.js + PostgreSQL | 2000 | 16 | 318.31 | 6,283.2 | 2.54 | 2.37 | 6.15 |
| KV read (batch) | Node.js + PostgreSQL | 2000 | 16 | 25.34 | 78,930.06 | 3.15 | 2.62 | 6.71 |
| KV read (hot cache) | Node.js + PostgreSQL | 2000 | 16 | 147.2 | 13,587.15 | 1.18 | 1.03 | 4.58 |
| KV read (99% L1) | Node.js + PostgreSQL | 2000 | 16 | 138.86 | 14,402.96 | 1.11 | 1.05 | 3.33 |
| KV read (95% L1) | Node.js + PostgreSQL | 2000 | 16 | 186.96 | 10,697.3 | 1.49 | 1.42 | 3.71 |
| KV read (90% L1) | Node.js + PostgreSQL | 2000 | 16 | 187.3 | 10,678.25 | 1.49 | 1.35 | 4.84 |
| Counter increment | Node.js + PostgreSQL | 2000 | 16 | 287.83 | 6,948.62 | 2.30 | 2.02 | 6.48 |
| Set add | Node.js + PostgreSQL | 2000 | 16 | 468.1 | 4,272.58 | 3.70 | 3.06 | 14.26 |
| Pub/Sub publish | Node.js + PostgreSQL | 2000 | 16 | 168.98 | 11,835.62 | 1.35 | 1.26 | 3.26 |
| KV read (hot cache) | Node.js + PostgreSQL (L1) | 2000 | 16 | 1.52 | 1,312,640.86 | 0.011 | 0.011 | 0.037 |
| KV read (99% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 3.57 | 559,698.41 | 0.024 | 0.003 | 0.688 |
| KV read (95% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 10.82 | 184,772.65 | 0.083 | 0.001 | 2.93 |
| KV read (90% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 12.14 | 164,677.78 | 0.092 | 0.001 | 2.52 |
| KV write | Bun.js + PostgreSQL | 2000 | 16 | 153.68 | 13,014.37 | 1.22 | 1.02 | 4.07 |
| KV write (batch) | Bun.js + PostgreSQL | 2000 | 16 | 30.65 | 65,247.43 | 3.68 | 3.55 | 8.33 |
| KV read | Bun.js + PostgreSQL | 2000 | 16 | 129.15 | 15,485.84 | 1.03 | 0.861 | 3.12 |
| KV read (batch) | Bun.js + PostgreSQL | 2000 | 16 | 13.61 | 146,906.53 | 1.63 | 1.48 | 4.94 |
| KV read (hot cache) | Bun.js + PostgreSQL | 2000 | 16 | 59.66 | 33,524.69 | 0.475 | 0.440 | 1.40 |
| KV read (99% L1) | Bun.js + PostgreSQL | 2000 | 16 | 58.9 | 33,955.88 | 0.468 | 0.436 | 1.40 |
| KV read (95% L1) | Bun.js + PostgreSQL | 2000 | 16 | 62.45 | 32,027.11 | 0.497 | 0.464 | 1.39 |
| KV read (90% L1) | Bun.js + PostgreSQL | 2000 | 16 | 67.18 | 29,772.62 | 0.536 | 0.496 | 1.68 |
| Counter increment | Bun.js + PostgreSQL | 2000 | 16 | 143.86 | 13,901.98 | 1.14 | 0.930 | 4.37 |
| Set add | Bun.js + PostgreSQL | 2000 | 16 | 278.96 | 7,169.44 | 2.22 | 1.62 | 20.48 |
| Pub/Sub publish | Bun.js + PostgreSQL | 2000 | 16 | 90.59 | 22,078.46 | 0.722 | 0.668 | 2.06 |
| KV read (hot cache) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 1.66 | 1,203,236.22 | 0.012 | 0.011 | 0.034 |
| KV read (99% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 2.67 | 750,350.79 | 0.018 | 0.004 | 0.351 |
| KV read (95% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 4.91 | 407,083.91 | 0.036 | 0.001 | 1.02 |
| KV read (90% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 6.54 | 305,601.99 | 0.051 | 0.001 | 1.34 |

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
