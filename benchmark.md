# Benchmark

Generated at: 2026-08-18T08:42:26.908Z

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
| KV write | 33,564.57 | 0.382 | 6,251.97 | 2.06 | 0.19x | 14,492.59 | 0.925 | 0.43x |
| KV write (batch) | 159,443.36 | 1.60 | 37,706.84 | 5.76 | 0.24x | 64,831.82 | 3.55 | 0.41x |
| KV read | 49,662.63 | 0.309 | 8,846.19 | 1.59 | 0.18x | 19,721.11 | 0.667 | 0.4x |
| KV read (batch) | 302,166.47 | 0.615 | 92,998.92 | 2.25 | 0.31x | 139,489.51 | 1.39 | 0.46x |
| KV read (hot cache) L1 | 47,182.48 | 0.318 | 1,017,231.39 | 0.012 | 21.56x | 616,290.28 | 0.023 | 13.06x |
| KV read (99% L1) L1 | 50,900.4 | 0.285 | 502,464.34 | 0.004 | 9.87x | 472,310.89 | 0.008 | 9.28x |
| KV read (95% L1) L1 | 49,051.97 | 0.315 | 229,171.73 | 0.001 | 4.67x | 238,958.62 | 0.001 | 4.87x |
| KV read (90% L1) L1 | 42,963.05 | 0.301 | 170,776.14 | 0.001 | 3.97x | 265,216.32 | 0.001 | 6.17x |
| Counter increment | 49,429.56 | 0.303 | 10,406.47 | 1.34 | 0.21x | 15,966.81 | 0.776 | 0.32x |
| Set add | 55,338.05 | 0.260 | 4,560.94 | 2.34 | 0.08x | 6,649.74 | 1.69 | 0.12x |
| Pub/Sub publish | 64,318.23 | 0.241 | 14,930.58 | 0.856 | 0.23x | 21,633.66 | 0.660 | 0.34x |

## L1 Read Cache

These rows isolate pgredis local memory cache behavior. Mixed hit-rate rows include PostgreSQL misses and are closer to real cache-aside usage than the 100% hot-cache row.

| Operation | Redis | Redis p50 ms | Node PG L1 | Node PG L1 p50 ms | Node PG L1/Redis | Bun PG L1 | Bun PG L1 p50 ms | Bun PG L1/Redis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV read (hot cache) | 47,182.48 | 0.318 | 1,017,231.39 | 0.012 | 21.56x | 616,290.28 | 0.023 | 13.06x |
| KV read (99% L1) | 50,900.4 | 0.285 | 502,464.34 | 0.004 | 9.87x | 472,310.89 | 0.008 | 9.28x |
| KV read (95% L1) | 49,051.97 | 0.315 | 229,171.73 | 0.001 | 4.67x | 238,958.62 | 0.001 | 4.87x |
| KV read (90% L1) | 42,963.05 | 0.301 | 170,776.14 | 0.001 | 3.97x | 265,216.32 | 0.001 | 6.17x |

## L2 Backend Path

These rows disable pgredis L1 and measure direct PostgreSQL access. They are useful for fallback sizing and regression tracking, not as the main cache-hit comparison.

| Operation | Redis | Redis p50 ms | Node PG L2 | Node PG L2 p50 ms | Node PG L2/Redis | Bun PG L2 | Bun PG L2 p50 ms | Bun PG L2/Redis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV write | 33,564.57 | 0.382 | 6,251.97 | 2.06 | 0.19x | 14,492.59 | 0.925 | 0.43x |
| KV write (batch) | 159,443.36 | 1.60 | 37,706.84 | 5.76 | 0.24x | 64,831.82 | 3.55 | 0.41x |
| KV read | 49,662.63 | 0.309 | 8,846.19 | 1.59 | 0.18x | 19,721.11 | 0.667 | 0.4x |
| KV read (batch) | 302,166.47 | 0.615 | 92,998.92 | 2.25 | 0.31x | 139,489.51 | 1.39 | 0.46x |
| KV read (hot cache) | 47,182.48 | 0.318 | 10,373.1 | 1.41 | 0.22x | 24,766.71 | 0.579 | 0.52x |
| KV read (99% L1) | 50,900.4 | 0.285 | 10,499.63 | 1.39 | 0.21x | 23,391.98 | 0.593 | 0.46x |
| KV read (95% L1) | 49,051.97 | 0.315 | 11,058.43 | 1.37 | 0.23x | 22,449.21 | 0.649 | 0.46x |
| KV read (90% L1) | 42,963.05 | 0.301 | 10,554.71 | 1.32 | 0.25x | 24,321.6 | 0.567 | 0.57x |
| Counter increment | 49,429.56 | 0.303 | 10,406.47 | 1.34 | 0.21x | 15,966.81 | 0.776 | 0.32x |
| Set add | 55,338.05 | 0.260 | 4,560.94 | 2.34 | 0.08x | 6,649.74 | 1.69 | 0.12x |
| Pub/Sub publish | 64,318.23 | 0.241 | 14,930.58 | 0.856 | 0.23x | 21,633.66 | 0.660 | 0.34x |

## Details

| Operation | Backend | Iterations | Concurrency | Duration ms | Ops/sec | Avg ms | p50 ms | p99 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV write | Node.js + Redis | 2000 | 16 | 59.59 | 33,564.57 | 0.469 | 0.382 | 1.48 |
| KV write (batch) | Node.js + Redis | 2000 | 16 | 12.54 | 159,443.36 | 1.47 | 1.60 | 2.55 |
| KV read | Node.js + Redis | 2000 | 16 | 40.27 | 49,662.63 | 0.320 | 0.309 | 0.706 |
| KV read (batch) | Node.js + Redis | 2000 | 16 | 6.62 | 302,166.47 | 0.775 | 0.615 | 2.26 |
| KV read (hot cache) | Node.js + Redis | 2000 | 16 | 42.39 | 47,182.48 | 0.337 | 0.318 | 0.761 |
| KV read (99% L1) | Node.js + Redis | 2000 | 16 | 39.29 | 50,900.4 | 0.312 | 0.285 | 0.691 |
| KV read (95% L1) | Node.js + Redis | 2000 | 16 | 40.77 | 49,051.97 | 0.324 | 0.315 | 0.478 |
| KV read (90% L1) | Node.js + Redis | 2000 | 16 | 46.55 | 42,963.05 | 0.370 | 0.301 | 2.62 |
| Counter increment | Node.js + Redis | 2000 | 16 | 40.46 | 49,429.56 | 0.320 | 0.303 | 0.565 |
| Set add | Node.js + Redis | 2000 | 16 | 36.14 | 55,338.05 | 0.287 | 0.260 | 0.519 |
| Pub/Sub publish | Node.js + Redis | 2000 | 16 | 31.1 | 64,318.23 | 0.246 | 0.241 | 0.329 |
| KV write | Node.js + PostgreSQL | 2000 | 16 | 319.9 | 6,251.97 | 2.55 | 2.06 | 7.10 |
| KV write (batch) | Node.js + PostgreSQL | 2000 | 16 | 53.04 | 37,706.84 | 6.30 | 5.76 | 14.49 |
| KV read | Node.js + PostgreSQL | 2000 | 16 | 226.09 | 8,846.19 | 1.80 | 1.59 | 4.50 |
| KV read (batch) | Node.js + PostgreSQL | 2000 | 16 | 21.51 | 92,998.92 | 2.67 | 2.25 | 7.12 |
| KV read (hot cache) | Node.js + PostgreSQL | 2000 | 16 | 192.81 | 10,373.1 | 1.54 | 1.41 | 3.80 |
| KV read (99% L1) | Node.js + PostgreSQL | 2000 | 16 | 190.48 | 10,499.63 | 1.52 | 1.39 | 3.60 |
| KV read (95% L1) | Node.js + PostgreSQL | 2000 | 16 | 180.86 | 11,058.43 | 1.44 | 1.37 | 3.06 |
| KV read (90% L1) | Node.js + PostgreSQL | 2000 | 16 | 189.49 | 10,554.71 | 1.51 | 1.32 | 5.08 |
| Counter increment | Node.js + PostgreSQL | 2000 | 16 | 192.19 | 10,406.47 | 1.53 | 1.34 | 4.75 |
| Set add | Node.js + PostgreSQL | 2000 | 16 | 438.51 | 4,560.94 | 3.50 | 2.34 | 35.53 |
| Pub/Sub publish | Node.js + PostgreSQL | 2000 | 16 | 133.95 | 14,930.58 | 1.07 | 0.856 | 3.45 |
| KV read (hot cache) | Node.js + PostgreSQL (L1) | 2000 | 16 | 1.97 | 1,017,231.39 | 0.015 | 0.012 | 0.057 |
| KV read (99% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 3.98 | 502,464.34 | 0.026 | 0.004 | 0.881 |
| KV read (95% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 8.73 | 229,171.73 | 0.068 | 0.001 | 2.14 |
| KV read (90% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 11.71 | 170,776.14 | 0.086 | 0.001 | 2.05 |
| KV write | Bun.js + PostgreSQL | 2000 | 16 | 138 | 14,492.59 | 1.10 | 0.925 | 3.79 |
| KV write (batch) | Bun.js + PostgreSQL | 2000 | 16 | 30.85 | 64,831.82 | 3.72 | 3.55 | 9.71 |
| KV read | Bun.js + PostgreSQL | 2000 | 16 | 101.41 | 19,721.11 | 0.807 | 0.667 | 2.88 |
| KV read (batch) | Bun.js + PostgreSQL | 2000 | 16 | 14.34 | 139,489.51 | 1.70 | 1.39 | 5.11 |
| KV read (hot cache) | Bun.js + PostgreSQL | 2000 | 16 | 80.75 | 24,766.71 | 0.641 | 0.579 | 1.60 |
| KV read (99% L1) | Bun.js + PostgreSQL | 2000 | 16 | 85.5 | 23,391.98 | 0.675 | 0.593 | 1.79 |
| KV read (95% L1) | Bun.js + PostgreSQL | 2000 | 16 | 89.09 | 22,449.21 | 0.711 | 0.649 | 1.85 |
| KV read (90% L1) | Bun.js + PostgreSQL | 2000 | 16 | 82.23 | 24,321.6 | 0.657 | 0.567 | 1.83 |
| Counter increment | Bun.js + PostgreSQL | 2000 | 16 | 125.26 | 15,966.81 | 0.995 | 0.776 | 3.91 |
| Set add | Bun.js + PostgreSQL | 2000 | 16 | 300.76 | 6,649.74 | 2.28 | 1.69 | 22.17 |
| Pub/Sub publish | Bun.js + PostgreSQL | 2000 | 16 | 92.45 | 21,633.66 | 0.735 | 0.660 | 2.05 |
| KV read (hot cache) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 3.25 | 616,290.28 | 0.025 | 0.023 | 0.076 |
| KV read (99% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 4.23 | 472,310.89 | 0.033 | 0.008 | 0.232 |
| KV read (95% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 8.37 | 238,958.62 | 0.066 | 0.001 | 1.68 |
| KV read (90% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 7.54 | 265,216.32 | 0.058 | 0.001 | 1.52 |

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
