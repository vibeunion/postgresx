# Benchmark

Generated at: 2026-08-16T04:42:23.914Z

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
| KV write | 26,892.1 | 0.497 | 6,064.36 | 2.10 | 0.23x | 10,148.38 | 1.41 | 0.38x |
| KV write (batch) | 139,255.65 | 1.52 | 41,139.06 | 4.94 | 0.3x | 52,149.45 | 4.38 | 0.37x |
| KV read | 38,754.54 | 0.394 | 8,189.38 | 1.74 | 0.21x | 12,775.86 | 1.11 | 0.33x |
| KV read (batch) | 274,135.92 | 0.748 | 92,288.58 | 2.21 | 0.34x | 99,310.95 | 2.13 | 0.36x |
| KV read (hot cache) L1 | 37,903.24 | 0.408 | 921,033.36 | 0.015 | 24.3x | 501,764.2 | 0.028 | 13.24x |
| KV read (99% L1) L1 | 40,748.92 | 0.374 | 417,702.31 | 0.007 | 10.25x | 345,259.16 | 0.011 | 8.47x |
| KV read (95% L1) L1 | 39,365.82 | 0.405 | 176,322.25 | 0.001 | 4.48x | 203,684.22 | 0.001 | 5.17x |
| KV read (90% L1) L1 | 36,301.36 | 0.385 | 149,610.7 | 0.001 | 4.12x | 188,238.16 | 0.001 | 5.19x |
| Counter increment | 41,809.73 | 0.366 | 8,648.59 | 1.65 | 0.21x | 9,038.3 | 1.54 | 0.22x |
| Set add | 46,031.84 | 0.319 | 3,908.36 | 2.63 | 0.08x | 5,652.53 | 2.23 | 0.12x |
| Pub/Sub publish | 50,090.15 | 0.309 | 11,195.27 | 1.32 | 0.22x | 13,329.61 | 1.12 | 0.27x |

## L1 Read Cache

These rows isolate pgredis local memory cache behavior. Mixed hit-rate rows include PostgreSQL misses and are closer to real cache-aside usage than the 100% hot-cache row.

| Operation | Redis | Redis p50 ms | Node PG L1 | Node PG L1 p50 ms | Node PG L1/Redis | Bun PG L1 | Bun PG L1 p50 ms | Bun PG L1/Redis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV read (hot cache) | 37,903.24 | 0.408 | 921,033.36 | 0.015 | 24.3x | 501,764.2 | 0.028 | 13.24x |
| KV read (99% L1) | 40,748.92 | 0.374 | 417,702.31 | 0.007 | 10.25x | 345,259.16 | 0.011 | 8.47x |
| KV read (95% L1) | 39,365.82 | 0.405 | 176,322.25 | 0.001 | 4.48x | 203,684.22 | 0.001 | 5.17x |
| KV read (90% L1) | 36,301.36 | 0.385 | 149,610.7 | 0.001 | 4.12x | 188,238.16 | 0.001 | 5.19x |

## L2 Backend Path

These rows disable pgredis L1 and measure direct PostgreSQL access. They are useful for fallback sizing and regression tracking, not as the main cache-hit comparison.

| Operation | Redis | Redis p50 ms | Node PG L2 | Node PG L2 p50 ms | Node PG L2/Redis | Bun PG L2 | Bun PG L2 p50 ms | Bun PG L2/Redis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV write | 26,892.1 | 0.497 | 6,064.36 | 2.10 | 0.23x | 10,148.38 | 1.41 | 0.38x |
| KV write (batch) | 139,255.65 | 1.52 | 41,139.06 | 4.94 | 0.3x | 52,149.45 | 4.38 | 0.37x |
| KV read | 38,754.54 | 0.394 | 8,189.38 | 1.74 | 0.21x | 12,775.86 | 1.11 | 0.33x |
| KV read (batch) | 274,135.92 | 0.748 | 92,288.58 | 2.21 | 0.34x | 99,310.95 | 2.13 | 0.36x |
| KV read (hot cache) | 37,903.24 | 0.408 | 8,652.76 | 1.60 | 0.23x | 15,418.16 | 0.955 | 0.41x |
| KV read (99% L1) | 40,748.92 | 0.374 | 8,329.21 | 1.77 | 0.2x | 11,755.2 | 1.26 | 0.29x |
| KV read (95% L1) | 39,365.82 | 0.405 | 9,139.95 | 1.60 | 0.23x | 12,896.59 | 1.16 | 0.33x |
| KV read (90% L1) | 36,301.36 | 0.385 | 8,280.62 | 1.72 | 0.23x | 14,123.03 | 0.990 | 0.39x |
| Counter increment | 41,809.73 | 0.366 | 8,648.59 | 1.65 | 0.21x | 9,038.3 | 1.54 | 0.22x |
| Set add | 46,031.84 | 0.319 | 3,908.36 | 2.63 | 0.08x | 5,652.53 | 2.23 | 0.12x |
| Pub/Sub publish | 50,090.15 | 0.309 | 11,195.27 | 1.32 | 0.22x | 13,329.61 | 1.12 | 0.27x |

## Details

| Operation | Backend | Iterations | Concurrency | Duration ms | Ops/sec | Avg ms | p50 ms | p99 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV write | Node.js + Redis | 2000 | 16 | 74.37 | 26,892.1 | 0.587 | 0.497 | 2.02 |
| KV write (batch) | Node.js + Redis | 2000 | 16 | 14.36 | 139,255.65 | 1.70 | 1.52 | 3.00 |
| KV read | Node.js + Redis | 2000 | 16 | 51.61 | 38,754.54 | 0.410 | 0.394 | 0.761 |
| KV read (batch) | Node.js + Redis | 2000 | 16 | 7.3 | 274,135.92 | 0.864 | 0.748 | 2.22 |
| KV read (hot cache) | Node.js + Redis | 2000 | 16 | 52.77 | 37,903.24 | 0.420 | 0.408 | 0.775 |
| KV read (99% L1) | Node.js + Redis | 2000 | 16 | 49.08 | 40,748.92 | 0.390 | 0.374 | 0.571 |
| KV read (95% L1) | Node.js + Redis | 2000 | 16 | 50.81 | 39,365.82 | 0.404 | 0.405 | 0.673 |
| KV read (90% L1) | Node.js + Redis | 2000 | 16 | 55.09 | 36,301.36 | 0.438 | 0.385 | 2.37 |
| Counter increment | Node.js + Redis | 2000 | 16 | 47.84 | 41,809.73 | 0.377 | 0.366 | 0.599 |
| Set add | Node.js + Redis | 2000 | 16 | 43.45 | 46,031.84 | 0.345 | 0.319 | 0.689 |
| Pub/Sub publish | Node.js + Redis | 2000 | 16 | 39.93 | 50,090.15 | 0.317 | 0.309 | 0.488 |
| KV write | Node.js + PostgreSQL | 2000 | 16 | 329.8 | 6,064.36 | 2.64 | 2.10 | 7.76 |
| KV write (batch) | Node.js + PostgreSQL | 2000 | 16 | 48.62 | 41,139.06 | 6.02 | 4.94 | 14.20 |
| KV read | Node.js + PostgreSQL | 2000 | 16 | 244.22 | 8,189.38 | 1.95 | 1.74 | 4.86 |
| KV read (batch) | Node.js + PostgreSQL | 2000 | 16 | 21.67 | 92,288.58 | 2.53 | 2.21 | 5.23 |
| KV read (hot cache) | Node.js + PostgreSQL | 2000 | 16 | 231.14 | 8,652.76 | 1.84 | 1.60 | 4.03 |
| KV read (99% L1) | Node.js + PostgreSQL | 2000 | 16 | 240.12 | 8,329.21 | 1.92 | 1.77 | 4.29 |
| KV read (95% L1) | Node.js + PostgreSQL | 2000 | 16 | 218.82 | 9,139.95 | 1.75 | 1.60 | 3.62 |
| KV read (90% L1) | Node.js + PostgreSQL | 2000 | 16 | 241.53 | 8,280.62 | 1.93 | 1.72 | 5.77 |
| Counter increment | Node.js + PostgreSQL | 2000 | 16 | 231.25 | 8,648.59 | 1.85 | 1.65 | 4.40 |
| Set add | Node.js + PostgreSQL | 2000 | 16 | 511.72 | 3,908.36 | 3.86 | 2.63 | 33.89 |
| Pub/Sub publish | Node.js + PostgreSQL | 2000 | 16 | 178.65 | 11,195.27 | 1.43 | 1.32 | 2.85 |
| KV read (hot cache) | Node.js + PostgreSQL (L1) | 2000 | 16 | 2.17 | 921,033.36 | 0.017 | 0.015 | 0.046 |
| KV read (99% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 4.79 | 417,702.31 | 0.037 | 0.007 | 0.501 |
| KV read (95% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 11.34 | 176,322.25 | 0.090 | 0.001 | 2.78 |
| KV read (90% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 13.37 | 149,610.7 | 0.105 | 0.001 | 3.05 |
| KV write | Bun.js + PostgreSQL | 2000 | 16 | 197.08 | 10,148.38 | 1.57 | 1.41 | 4.54 |
| KV write (batch) | Bun.js + PostgreSQL | 2000 | 16 | 38.35 | 52,149.45 | 4.60 | 4.38 | 9.59 |
| KV read | Bun.js + PostgreSQL | 2000 | 16 | 156.55 | 12,775.86 | 1.25 | 1.11 | 3.52 |
| KV read (batch) | Bun.js + PostgreSQL | 2000 | 16 | 20.14 | 99,310.95 | 2.43 | 2.13 | 6.11 |
| KV read (hot cache) | Bun.js + PostgreSQL | 2000 | 16 | 129.72 | 15,418.16 | 1.03 | 0.955 | 2.45 |
| KV read (99% L1) | Bun.js + PostgreSQL | 2000 | 16 | 170.14 | 11,755.2 | 1.36 | 1.26 | 3.05 |
| KV read (95% L1) | Bun.js + PostgreSQL | 2000 | 16 | 155.08 | 12,896.59 | 1.24 | 1.16 | 3.06 |
| KV read (90% L1) | Bun.js + PostgreSQL | 2000 | 16 | 141.61 | 14,123.03 | 1.13 | 0.990 | 2.79 |
| Counter increment | Bun.js + PostgreSQL | 2000 | 16 | 221.28 | 9,038.3 | 1.76 | 1.54 | 5.79 |
| Set add | Bun.js + PostgreSQL | 2000 | 16 | 353.82 | 5,652.53 | 2.81 | 2.23 | 10.01 |
| Pub/Sub publish | Bun.js + PostgreSQL | 2000 | 16 | 150.04 | 13,329.61 | 1.20 | 1.12 | 2.82 |
| KV read (hot cache) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 3.99 | 501,764.2 | 0.030 | 0.028 | 0.093 |
| KV read (99% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 5.79 | 345,259.16 | 0.044 | 0.011 | 0.367 |
| KV read (95% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 9.82 | 203,684.22 | 0.077 | 0.001 | 2.20 |
| KV read (90% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 10.62 | 188,238.16 | 0.082 | 0.001 | 2.21 |

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
