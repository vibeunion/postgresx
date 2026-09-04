# Benchmark

Generated at: 2026-09-04T15:18:03.398Z

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
| KV write | 27,138.5 | 0.495 | 5,665.77 | 2.25 | 0.21x | 12,924.82 | 1.06 | 0.48x |
| KV write (batch) | 134,240.09 | 1.48 | 40,975.55 | 5.43 | 0.31x | 60,510.43 | 3.95 | 0.45x |
| KV read | 37,175.94 | 0.414 | 7,565.78 | 1.82 | 0.2x | 16,538.01 | 0.850 | 0.44x |
| KV read (batch) | 237,172.1 | 0.856 | 84,415.96 | 2.74 | 0.36x | 146,886.34 | 1.34 | 0.62x |
| KV read (hot cache) L1 | 36,701.2 | 0.413 | 1,233,676.15 | 0.011 | 33.61x | 1,028,523.53 | 0.012 | 28.02x |
| KV read (99% L1) L1 | 39,828.22 | 0.377 | 562,596.45 | 0.004 | 14.13x | 687,779.2 | 0.004 | 17.27x |
| KV read (95% L1) L1 | 38,335.31 | 0.409 | 197,036.36 | 0.001 | 5.14x | 289,839.15 | 0.001 | 7.56x |
| KV read (90% L1) L1 | 35,222.06 | 0.384 | 156,390.9 | 0.001 | 4.44x | 304,147.03 | 0.001 | 8.64x |
| Counter increment | 38,603.91 | 0.401 | 9,420.44 | 1.57 | 0.24x | 12,096.95 | 1.09 | 0.31x |
| Set add | 43,419.39 | 0.333 | 3,957.63 | 2.64 | 0.09x | 6,483.13 | 1.82 | 0.15x |
| Pub/Sub publish | 47,438.49 | 0.328 | 12,731.42 | 1.16 | 0.27x | 15,125.35 | 0.933 | 0.32x |

## L1 Read Cache

These rows isolate pgredis local memory cache behavior. Mixed hit-rate rows include PostgreSQL misses and are closer to real cache-aside usage than the 100% hot-cache row.

| Operation | Redis | Redis p50 ms | Node PG L1 | Node PG L1 p50 ms | Node PG L1/Redis | Bun PG L1 | Bun PG L1 p50 ms | Bun PG L1/Redis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV read (hot cache) | 36,701.2 | 0.413 | 1,233,676.15 | 0.011 | 33.61x | 1,028,523.53 | 0.012 | 28.02x |
| KV read (99% L1) | 39,828.22 | 0.377 | 562,596.45 | 0.004 | 14.13x | 687,779.2 | 0.004 | 17.27x |
| KV read (95% L1) | 38,335.31 | 0.409 | 197,036.36 | 0.001 | 5.14x | 289,839.15 | 0.001 | 7.56x |
| KV read (90% L1) | 35,222.06 | 0.384 | 156,390.9 | 0.001 | 4.44x | 304,147.03 | 0.001 | 8.64x |

## L2 Backend Path

These rows disable pgredis L1 and measure direct PostgreSQL access. They are useful for fallback sizing and regression tracking, not as the main cache-hit comparison.

| Operation | Redis | Redis p50 ms | Node PG L2 | Node PG L2 p50 ms | Node PG L2/Redis | Bun PG L2 | Bun PG L2 p50 ms | Bun PG L2/Redis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV write | 27,138.5 | 0.495 | 5,665.77 | 2.25 | 0.21x | 12,924.82 | 1.06 | 0.48x |
| KV write (batch) | 134,240.09 | 1.48 | 40,975.55 | 5.43 | 0.31x | 60,510.43 | 3.95 | 0.45x |
| KV read | 37,175.94 | 0.414 | 7,565.78 | 1.82 | 0.2x | 16,538.01 | 0.850 | 0.44x |
| KV read (batch) | 237,172.1 | 0.856 | 84,415.96 | 2.74 | 0.36x | 146,886.34 | 1.34 | 0.62x |
| KV read (hot cache) | 36,701.2 | 0.413 | 8,402.82 | 1.69 | 0.23x | 19,739.55 | 0.729 | 0.54x |
| KV read (99% L1) | 39,828.22 | 0.377 | 8,976.79 | 1.60 | 0.23x | 21,120.33 | 0.652 | 0.53x |
| KV read (95% L1) | 38,335.31 | 0.409 | 9,021.64 | 1.60 | 0.24x | 20,461.31 | 0.689 | 0.53x |
| KV read (90% L1) | 35,222.06 | 0.384 | 8,385.92 | 1.70 | 0.24x | 19,292.2 | 0.746 | 0.55x |
| Counter increment | 38,603.91 | 0.401 | 9,420.44 | 1.57 | 0.24x | 12,096.95 | 1.09 | 0.31x |
| Set add | 43,419.39 | 0.333 | 3,957.63 | 2.64 | 0.09x | 6,483.13 | 1.82 | 0.15x |
| Pub/Sub publish | 47,438.49 | 0.328 | 12,731.42 | 1.16 | 0.27x | 15,125.35 | 0.933 | 0.32x |

## Details

| Operation | Backend | Iterations | Concurrency | Duration ms | Ops/sec | Avg ms | p50 ms | p99 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV write | Node.js + Redis | 2000 | 16 | 73.7 | 27,138.5 | 0.581 | 0.495 | 1.97 |
| KV write (batch) | Node.js + Redis | 2000 | 16 | 14.9 | 134,240.09 | 1.73 | 1.48 | 3.76 |
| KV read | Node.js + Redis | 2000 | 16 | 53.8 | 37,175.94 | 0.427 | 0.414 | 0.818 |
| KV read (batch) | Node.js + Redis | 2000 | 16 | 8.43 | 237,172.1 | 1.01 | 0.856 | 2.66 |
| KV read (hot cache) | Node.js + Redis | 2000 | 16 | 54.49 | 36,701.2 | 0.434 | 0.413 | 0.807 |
| KV read (99% L1) | Node.js + Redis | 2000 | 16 | 50.22 | 39,828.22 | 0.399 | 0.377 | 0.947 |
| KV read (95% L1) | Node.js + Redis | 2000 | 16 | 52.17 | 38,335.31 | 0.415 | 0.409 | 0.598 |
| KV read (90% L1) | Node.js + Redis | 2000 | 16 | 56.78 | 35,222.06 | 0.452 | 0.384 | 2.31 |
| Counter increment | Node.js + Redis | 2000 | 16 | 51.81 | 38,603.91 | 0.409 | 0.401 | 0.674 |
| Set add | Node.js + Redis | 2000 | 16 | 46.06 | 43,419.39 | 0.366 | 0.333 | 0.590 |
| Pub/Sub publish | Node.js + Redis | 2000 | 16 | 42.16 | 47,438.49 | 0.334 | 0.328 | 0.511 |
| KV write | Node.js + PostgreSQL | 2000 | 16 | 353 | 5,665.77 | 2.82 | 2.25 | 8.46 |
| KV write (batch) | Node.js + PostgreSQL | 2000 | 16 | 48.81 | 40,975.55 | 6.06 | 5.43 | 14.21 |
| KV read | Node.js + PostgreSQL | 2000 | 16 | 264.35 | 7,565.78 | 2.11 | 1.82 | 5.17 |
| KV read (batch) | Node.js + PostgreSQL | 2000 | 16 | 23.69 | 84,415.96 | 2.94 | 2.74 | 6.40 |
| KV read (hot cache) | Node.js + PostgreSQL | 2000 | 16 | 238.02 | 8,402.82 | 1.90 | 1.69 | 4.55 |
| KV read (99% L1) | Node.js + PostgreSQL | 2000 | 16 | 222.8 | 8,976.79 | 1.78 | 1.60 | 3.73 |
| KV read (95% L1) | Node.js + PostgreSQL | 2000 | 16 | 221.69 | 9,021.64 | 1.77 | 1.60 | 3.74 |
| KV read (90% L1) | Node.js + PostgreSQL | 2000 | 16 | 238.49 | 8,385.92 | 1.90 | 1.70 | 5.30 |
| Counter increment | Node.js + PostgreSQL | 2000 | 16 | 212.3 | 9,420.44 | 1.69 | 1.57 | 4.25 |
| Set add | Node.js + PostgreSQL | 2000 | 16 | 505.35 | 3,957.63 | 4.03 | 2.64 | 38.47 |
| Pub/Sub publish | Node.js + PostgreSQL | 2000 | 16 | 157.09 | 12,731.42 | 1.25 | 1.16 | 2.62 |
| KV read (hot cache) | Node.js + PostgreSQL (L1) | 2000 | 16 | 1.62 | 1,233,676.15 | 0.012 | 0.011 | 0.039 |
| KV read (99% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 3.55 | 562,596.45 | 0.026 | 0.004 | 0.648 |
| KV read (95% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 10.15 | 197,036.36 | 0.079 | 0.001 | 2.25 |
| KV read (90% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 12.79 | 156,390.9 | 0.098 | 0.001 | 2.98 |
| KV write | Bun.js + PostgreSQL | 2000 | 16 | 154.74 | 12,924.82 | 1.23 | 1.06 | 3.83 |
| KV write (batch) | Bun.js + PostgreSQL | 2000 | 16 | 33.05 | 60,510.43 | 4.03 | 3.95 | 8.39 |
| KV read | Bun.js + PostgreSQL | 2000 | 16 | 120.93 | 16,538.01 | 0.964 | 0.850 | 2.60 |
| KV read (batch) | Bun.js + PostgreSQL | 2000 | 16 | 13.62 | 146,886.34 | 1.65 | 1.34 | 5.53 |
| KV read (hot cache) | Bun.js + PostgreSQL | 2000 | 16 | 101.32 | 19,739.55 | 0.807 | 0.729 | 2.05 |
| KV read (99% L1) | Bun.js + PostgreSQL | 2000 | 16 | 94.7 | 21,120.33 | 0.754 | 0.652 | 2.32 |
| KV read (95% L1) | Bun.js + PostgreSQL | 2000 | 16 | 97.75 | 20,461.31 | 0.780 | 0.689 | 2.28 |
| KV read (90% L1) | Bun.js + PostgreSQL | 2000 | 16 | 103.67 | 19,292.2 | 0.826 | 0.746 | 2.59 |
| Counter increment | Bun.js + PostgreSQL | 2000 | 16 | 165.33 | 12,096.95 | 1.32 | 1.09 | 4.38 |
| Set add | Bun.js + PostgreSQL | 2000 | 16 | 308.49 | 6,483.13 | 2.46 | 1.82 | 19.63 |
| Pub/Sub publish | Bun.js + PostgreSQL | 2000 | 16 | 132.23 | 15,125.35 | 1.05 | 0.933 | 2.39 |
| KV read (hot cache) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 1.94 | 1,028,523.53 | 0.015 | 0.012 | 0.051 |
| KV read (99% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 2.91 | 687,779.2 | 0.021 | 0.004 | 0.368 |
| KV read (95% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 6.9 | 289,839.15 | 0.052 | 0.001 | 1.59 |
| KV read (90% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 6.58 | 304,147.03 | 0.051 | 0.001 | 1.25 |

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
