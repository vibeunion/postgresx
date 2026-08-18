# Benchmark

Generated at: 2026-08-18T09:03:11.817Z

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
| KV write | 52,266.33 | 0.218 | 7,983.92 | 1.42 | 0.15x | 18,422.96 | 0.676 | 0.35x |
| KV write (batch) | 173,742.9 | 1.02 | 36,505.24 | 5.74 | 0.21x | 73,622.45 | 2.93 | 0.42x |
| KV read | 70,724.69 | 0.177 | 11,389.57 | 1.16 | 0.16x | 22,680.44 | 0.603 | 0.32x |
| KV read (batch) | 299,705.7 | 0.642 | 85,058.2 | 2.42 | 0.28x | 161,624.73 | 1.18 | 0.54x |
| KV read (hot cache) L1 | 59,948.09 | 0.212 | 865,233.03 | 0.017 | 14.43x | 781,135.58 | 0.016 | 13.03x |
| KV read (99% L1) L1 | 71,733.98 | 0.176 | 515,545.63 | 0.006 | 7.19x | 495,067.52 | 0.006 | 6.9x |
| KV read (95% L1) L1 | 79,202.17 | 0.173 | 247,906.52 | 0.001 | 3.13x | 394,433.75 | 0.001 | 4.98x |
| KV read (90% L1) L1 | 64,830.99 | 0.177 | 216,664 | 0.001 | 3.34x | 444,134.04 | 0.001 | 6.85x |
| Counter increment | 78,374.89 | 0.186 | 11,969.77 | 1.12 | 0.15x | 22,967.48 | 0.566 | 0.29x |
| Set add | 80,081.27 | 0.164 | 5,566.01 | 2.21 | 0.07x | 8,409.51 | 1.01 | 0.11x |
| Pub/Sub publish | 100,721.5 | 0.152 | 18,081.69 | 0.762 | 0.18x | 32,036.12 | 0.434 | 0.32x |

## L1 Read Cache

These rows isolate pgredis local memory cache behavior. Mixed hit-rate rows include PostgreSQL misses and are closer to real cache-aside usage than the 100% hot-cache row.

| Operation | Redis | Redis p50 ms | Node PG L1 | Node PG L1 p50 ms | Node PG L1/Redis | Bun PG L1 | Bun PG L1 p50 ms | Bun PG L1/Redis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV read (hot cache) | 59,948.09 | 0.212 | 865,233.03 | 0.017 | 14.43x | 781,135.58 | 0.016 | 13.03x |
| KV read (99% L1) | 71,733.98 | 0.176 | 515,545.63 | 0.006 | 7.19x | 495,067.52 | 0.006 | 6.9x |
| KV read (95% L1) | 79,202.17 | 0.173 | 247,906.52 | 0.001 | 3.13x | 394,433.75 | 0.001 | 4.98x |
| KV read (90% L1) | 64,830.99 | 0.177 | 216,664 | 0.001 | 3.34x | 444,134.04 | 0.001 | 6.85x |

## L2 Backend Path

These rows disable pgredis L1 and measure direct PostgreSQL access. They are useful for fallback sizing and regression tracking, not as the main cache-hit comparison.

| Operation | Redis | Redis p50 ms | Node PG L2 | Node PG L2 p50 ms | Node PG L2/Redis | Bun PG L2 | Bun PG L2 p50 ms | Bun PG L2/Redis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV write | 52,266.33 | 0.218 | 7,983.92 | 1.42 | 0.15x | 18,422.96 | 0.676 | 0.35x |
| KV write (batch) | 173,742.9 | 1.02 | 36,505.24 | 5.74 | 0.21x | 73,622.45 | 2.93 | 0.42x |
| KV read | 70,724.69 | 0.177 | 11,389.57 | 1.16 | 0.16x | 22,680.44 | 0.603 | 0.32x |
| KV read (batch) | 299,705.7 | 0.642 | 85,058.2 | 2.42 | 0.28x | 161,624.73 | 1.18 | 0.54x |
| KV read (hot cache) | 59,948.09 | 0.212 | 12,319.07 | 1.17 | 0.21x | 29,298.57 | 0.472 | 0.49x |
| KV read (99% L1) | 71,733.98 | 0.176 | 11,456.47 | 1.27 | 0.16x | 25,360.93 | 0.579 | 0.35x |
| KV read (95% L1) | 79,202.17 | 0.173 | 12,488.28 | 1.10 | 0.16x | 29,749.08 | 0.465 | 0.38x |
| KV read (90% L1) | 64,830.99 | 0.177 | 11,843 | 1.12 | 0.18x | 30,408.33 | 0.442 | 0.47x |
| Counter increment | 78,374.89 | 0.186 | 11,969.77 | 1.12 | 0.15x | 22,967.48 | 0.566 | 0.29x |
| Set add | 80,081.27 | 0.164 | 5,566.01 | 2.21 | 0.07x | 8,409.51 | 1.01 | 0.11x |
| Pub/Sub publish | 100,721.5 | 0.152 | 18,081.69 | 0.762 | 0.18x | 32,036.12 | 0.434 | 0.32x |

## Details

| Operation | Backend | Iterations | Concurrency | Duration ms | Ops/sec | Avg ms | p50 ms | p99 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| KV write | Node.js + Redis | 2000 | 16 | 38.27 | 52,266.33 | 0.300 | 0.218 | 2.06 |
| KV write (batch) | Node.js + Redis | 2000 | 16 | 11.51 | 173,742.9 | 1.38 | 1.02 | 2.53 |
| KV read | Node.js + Redis | 2000 | 16 | 28.28 | 70,724.69 | 0.225 | 0.177 | 0.809 |
| KV read (batch) | Node.js + Redis | 2000 | 16 | 6.67 | 299,705.7 | 0.799 | 0.642 | 1.90 |
| KV read (hot cache) | Node.js + Redis | 2000 | 16 | 33.36 | 59,948.09 | 0.263 | 0.212 | 0.616 |
| KV read (99% L1) | Node.js + Redis | 2000 | 16 | 27.88 | 71,733.98 | 0.222 | 0.176 | 0.357 |
| KV read (95% L1) | Node.js + Redis | 2000 | 16 | 25.25 | 79,202.17 | 0.201 | 0.173 | 0.600 |
| KV read (90% L1) | Node.js + Redis | 2000 | 16 | 30.85 | 64,830.99 | 0.246 | 0.177 | 2.32 |
| Counter increment | Node.js + Redis | 2000 | 16 | 25.52 | 78,374.89 | 0.202 | 0.186 | 0.603 |
| Set add | Node.js + Redis | 2000 | 16 | 24.97 | 80,081.27 | 0.198 | 0.164 | 0.493 |
| Pub/Sub publish | Node.js + Redis | 2000 | 16 | 19.86 | 100,721.5 | 0.157 | 0.152 | 0.274 |
| KV write | Node.js + PostgreSQL | 2000 | 16 | 250.5 | 7,983.92 | 2.00 | 1.42 | 7.10 |
| KV write (batch) | Node.js + PostgreSQL | 2000 | 16 | 54.79 | 36,505.24 | 6.85 | 5.74 | 19.51 |
| KV read | Node.js + PostgreSQL | 2000 | 16 | 175.6 | 11,389.57 | 1.40 | 1.16 | 4.86 |
| KV read (batch) | Node.js + PostgreSQL | 2000 | 16 | 23.51 | 85,058.2 | 2.92 | 2.42 | 7.39 |
| KV read (hot cache) | Node.js + PostgreSQL | 2000 | 16 | 162.35 | 12,319.07 | 1.30 | 1.17 | 3.76 |
| KV read (99% L1) | Node.js + PostgreSQL | 2000 | 16 | 174.57 | 11,456.47 | 1.39 | 1.27 | 3.30 |
| KV read (95% L1) | Node.js + PostgreSQL | 2000 | 16 | 160.15 | 12,488.28 | 1.28 | 1.10 | 3.15 |
| KV read (90% L1) | Node.js + PostgreSQL | 2000 | 16 | 168.88 | 11,843 | 1.35 | 1.12 | 4.20 |
| Counter increment | Node.js + PostgreSQL | 2000 | 16 | 167.09 | 11,969.77 | 1.33 | 1.12 | 4.44 |
| Set add | Node.js + PostgreSQL | 2000 | 16 | 359.32 | 5,566.01 | 2.87 | 2.21 | 16.85 |
| Pub/Sub publish | Node.js + PostgreSQL | 2000 | 16 | 110.61 | 18,081.69 | 0.882 | 0.762 | 2.12 |
| KV read (hot cache) | Node.js + PostgreSQL (L1) | 2000 | 16 | 2.31 | 865,233.03 | 0.018 | 0.017 | 0.040 |
| KV read (99% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 3.88 | 515,545.63 | 0.027 | 0.006 | 0.257 |
| KV read (95% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 8.07 | 247,906.52 | 0.063 | 0.001 | 1.95 |
| KV read (90% L1) | Node.js + PostgreSQL (L1) | 2000 | 16 | 9.23 | 216,664 | 0.073 | 0.001 | 2.11 |
| KV write | Bun.js + PostgreSQL | 2000 | 16 | 108.56 | 18,422.96 | 0.863 | 0.676 | 2.90 |
| KV write (batch) | Bun.js + PostgreSQL | 2000 | 16 | 27.17 | 73,622.45 | 3.23 | 2.93 | 9.53 |
| KV read | Bun.js + PostgreSQL | 2000 | 16 | 88.18 | 22,680.44 | 0.702 | 0.603 | 2.22 |
| KV read (batch) | Bun.js + PostgreSQL | 2000 | 16 | 12.37 | 161,624.73 | 1.47 | 1.18 | 5.11 |
| KV read (hot cache) | Bun.js + PostgreSQL | 2000 | 16 | 68.26 | 29,298.57 | 0.544 | 0.472 | 1.55 |
| KV read (99% L1) | Bun.js + PostgreSQL | 2000 | 16 | 78.86 | 25,360.93 | 0.629 | 0.579 | 1.71 |
| KV read (95% L1) | Bun.js + PostgreSQL | 2000 | 16 | 67.23 | 29,749.08 | 0.537 | 0.465 | 1.51 |
| KV read (90% L1) | Bun.js + PostgreSQL | 2000 | 16 | 65.77 | 30,408.33 | 0.525 | 0.442 | 1.77 |
| Counter increment | Bun.js + PostgreSQL | 2000 | 16 | 87.08 | 22,967.48 | 0.692 | 0.566 | 3.14 |
| Set add | Bun.js + PostgreSQL | 2000 | 16 | 237.83 | 8,409.51 | 1.70 | 1.01 | 26.42 |
| Pub/Sub publish | Bun.js + PostgreSQL | 2000 | 16 | 62.43 | 32,036.12 | 0.496 | 0.434 | 1.82 |
| KV read (hot cache) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 2.56 | 781,135.58 | 0.019 | 0.016 | 0.065 |
| KV read (99% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 4.04 | 495,067.52 | 0.031 | 0.006 | 0.167 |
| KV read (95% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 5.07 | 394,433.75 | 0.040 | 0.001 | 1.18 |
| KV read (90% L1) | Bun.js + PostgreSQL (L1) | 2000 | 16 | 4.5 | 444,134.04 | 0.035 | 0.001 | 0.957 |

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
