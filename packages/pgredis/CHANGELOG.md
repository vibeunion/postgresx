# Changelog

## [0.7.2](https://github.com/vibeunion/postgresx/compare/@postgresx/noredis-v0.7.1...@postgresx/noredis-v0.7.2) (2026-09-04)


### Bug Fixes

* **pgredis:** scope expired cleanup to namespace ([6093d2d](https://github.com/vibeunion/postgresx/commit/6093d2dcdd870a79339036fb7a68d8903a95b417))

## [0.7.1](https://github.com/vibeunion/postgresx/compare/@postgresx/noredis-v0.7.0...@postgresx/noredis-v0.7.1) (2026-08-18)


### Bug Fixes

* resolve code quality findings ([#17](https://github.com/vibeunion/postgresx/issues/17)) ([c613f6c](https://github.com/vibeunion/postgresx/commit/c613f6c3f16a1c107f2a93f82d44a41b71dd5b03))

## [0.7.0](https://github.com/vibeunion/postgresx/compare/@postgresx/noredis-v0.6.1...@postgresx/noredis-v0.7.0) (2026-08-16)


### Features

* **pgredis:** support WAL-backed schema setup ([#15](https://github.com/vibeunion/postgresx/issues/15)) ([855d42f](https://github.com/vibeunion/postgresx/commit/855d42f58663c3da1557656bde1186f1725c293b))


### Miscellaneous

* update repository URLs to vibeunion/postgresx ([17b5434](https://github.com/vibeunion/postgresx/commit/17b54349c385688db430e823962b8853108e50fd))

## [0.6.1](https://github.com/vibeunion/postgresx/compare/@postgresx/noredis-v0.6.0...@postgresx/noredis-v0.6.1) (2026-07-27)


### Bug Fixes

* make kv invalidation and swaps atomic ([ed1deb2](https://github.com/vibeunion/postgresx/commit/ed1deb28ce30fe122dbd5ee804fdbbd5dcb0b2dd))
* **pgredis:** make L1 invalidation and KV swaps atomic ([066d8c7](https://github.com/vibeunion/postgresx/commit/066d8c730c55ab282a83de036dc1922fafc7bb18))


### Miscellaneous

* sync agent-team framework and bump CI to PostgreSQL 17/18 ([7153904](https://github.com/vibeunion/postgresx/commit/71539042cb3d7b2fd3783825ab33c49a073d4871))

## [0.6.0](https://github.com/vibeunion/postgresx/compare/@postgresx/noredis-v0.5.2...@postgresx/noredis-v0.6.0) (2026-06-27)


### Features

* **pgredis:** add fixed-window rate limit controls ([#12](https://github.com/vibeunion/postgresx/issues/12)) ([84549f0](https://github.com/vibeunion/postgresx/commit/84549f0ab0cf30e62eb955177e29c1d7c5302b9b))


### Bug Fixes

* add npm provenance repository metadata ([8a6ab7d](https://github.com/vibeunion/postgresx/commit/8a6ab7df05b80e606d4d16a733181f214884c270))
* add npm provenance repository metadata ([80e7839](https://github.com/vibeunion/postgresx/commit/80e78397a631b5f77d636a43fa573d3ac1e1107a))

## [0.5.2](https://github.com/vibeunion/postgresx/compare/@postgresx/noredis-v0.5.1...@postgresx/noredis-v0.5.2) (2026-06-20)


### Documentation

* add telemetry collector recipe ([8fa43bf](https://github.com/vibeunion/postgresx/commit/8fa43bf4212fed0dd0e3c08e277f75428547cc12))
* add telemetry collector recipe ([50b72c7](https://github.com/vibeunion/postgresx/commit/50b72c7ffbd06a99a779c7bc2a91269defd13e7b))

## [0.5.1](https://github.com/vibeunion/postgresx/compare/@postgresx/noredis-v0.5.0...@postgresx/noredis-v0.5.1) (2026-06-18)


### Bug Fixes

* preserve workspace deps for release flow ([1e07a37](https://github.com/vibeunion/postgresx/commit/1e07a37867b5ebda539fcf4e3e0b123a221ec2b6))
* preserve workspace deps for release flow ([ec98879](https://github.com/vibeunion/postgresx/commit/ec988794b09706772b7bec9691c77abcea032097))

## [0.5.0](https://github.com/vibeunion/postgresx/compare/@postgresx/noredis-v0.4.0...@postgresx/noredis-v0.5.0) (2026-05-27)


### Features

* add ioredis/redis adapters, noredis facade packages, sub-module exports, and release-please config ([5d39b5b](https://github.com/vibeunion/postgresx/commit/5d39b5b487f3edc21124cf08800091d59d8d209d))


### Documentation

* update README Redis compatibility tables and mark migration features complete ([f0a60c4](https://github.com/vibeunion/postgresx/commit/f0a60c4dcc6e8a17d831e2a26ea4eccde0d062b7))

## [0.4.0](https://github.com/vibeunion/postgresx/compare/@postgresx/noredis-v0.3.0...@postgresx/noredis-v0.4.0) (2026-05-26)


### Features

* pgredis - PostgreSQL-powered Redis interface for Bun/Node ([614b1b7](https://github.com/vibeunion/postgresx/commit/614b1b77bc7b501f54f7fe1fba70a051e72efc37))

## [0.3.0](https://github.com/vibeunion/postgresx/compare/@postgresx/noredis-v0.2.0...@postgresx/noredis-v0.3.0) (2026-05-26)


### Features

* add pgredis migration primitives ([a4dfa43](https://github.com/vibeunion/postgresx/commit/a4dfa43d19ebe73b9b614c4ec9bec76d67e99a67))

## [0.2.0](https://github.com/vibeunion/postgresx/compare/@postgresx/noredis-v0.1.0...@postgresx/noredis-v0.2.0) (2026-05-26)


### Features

* prepare pgredis for beta release ([7adcc2b](https://github.com/vibeunion/postgresx/commit/7adcc2b05c102803fa4d3e80b9541286b0472b95))


### Documentation

* add chinese readme sections ([4851741](https://github.com/vibeunion/postgresx/commit/485174164d15166cd89f0e57f29f121aa2ce022f))


### Miscellaneous

* align packages under postgresx scope ([ec2b214](https://github.com/vibeunion/postgresx/commit/ec2b2143c7f88056fbc7675a9c3a6bb47b95883d))
* rename npm packages under postgres scopes ([a671afa](https://github.com/vibeunion/postgresx/commit/a671afa07b38c4975d13d007b096f036328f62dc))
