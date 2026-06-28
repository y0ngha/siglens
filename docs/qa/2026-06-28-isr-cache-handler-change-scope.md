# ISR Cache Handler 외부화 — 변경 범위 (Change Scope)

> 대상 PR: 커스텀 Next.js 16.2 `cacheHandler`로 ISR/fetch 캐시를 S3로 외부화 (branch `feature/isr-cache-handler`)
> 기준 Spec: [`../superpowers/specs/2026-06-28-isr-cache-handler-design.md`](../superpowers/specs/2026-06-28-isr-cache-handler-design.md)
> 작성일: 2026-06-28
> 목적: 검증자가 무엇이 바뀌었고 무엇이 게이트되며 어디가 리스크 면인지 한눈에 파악하도록 정리. 실증 케이스는 [`2026-06-28-isr-cache-handler-testcases.md`](./2026-06-28-isr-cache-handler-testcases.md).

---

## 1. 한 줄 요약

`/`·`/economy`·`[symbol]/*` 등 모든 ISR/fetch 캐시를 **컨테이너 로컬 디스크 → S3**로 이전한다(2026-06-28 디스크풀 인시던트 근본 해결). 커스텀 `cacheHandler`(get/set/revalidateTag) + 로컬 in-process 태그맵 + S3 prefix = `GIT_SHA`(배포 격리). **production + `ISR_CACHE_BUCKET` 설정 시에만** 활성화되고, dev/E2E는 기본 파일시스템 캐시로 폴백한다.

---

## 2. 파일별 변경 (file-by-file)

### 신규 캐시 핸들러 모듈 (`cache-handler/`, plain ESM `.mjs` — Next가 transpile 없이 require)

| 파일 | 역할 |
|---|---|
| `cache-handler/index.mjs` | `CacheHandler` 클래스 (얇은 오케스트레이터). `get`/`set`/`revalidateTag`/`resetRequestCache` + `collectTags(data, ctx)` 헬퍼 |
| `cache-handler/config.mjs` | env 읽기: `bucket`(ISR_CACHE_BUCKET), `region`(AWS_REGION, 기본 ap-northeast-2), `keyPrefix='siglens-isr'`, `buildId`(GIT_SHA, 기본 'dev'), `disabled`(ISR_CACHE_DISABLED==='true') |
| `cache-handler/s3Store.mjs` | S3 `getEntry`/`setEntry` + `s3Key(key, kind)` 키 스킴. EC2 instance role 자격증명 자동 사용 |
| `cache-handler/tagStore.mjs` | 로컬 in-process `Map<tag, revalidatedAt>` (soft invalidation source of truth) |
| `cache-handler/serialize.mjs` | gzip `serialize`/`deserialize` (RSC 페이로드 커서 gzip 필수) |
| `cache-handler/__tests__/*.test.mjs` | 단위 테스트: index(stale 분기·set try/catch·collectTags), s3Store(키스킴·NoSuchKey→null·에러→null), tagStore, serialize. + `s3Store.integration.test.mjs`(실 S3 왕복, `ISR_CACHE_IT=1`일 때만 실행, 기본 스킵) |

### 와이어링 / 빌드

| 파일 | 변경 |
|---|---|
| `next.config.ts` | `createRequire(import.meta.url)` 추가. `cacheHandler` = (NODE_ENV==='production' && ISR_CACHE_BUCKET) ? `require.resolve('./cache-handler/index.mjs')` : `undefined`. `cacheMaxMemorySize: 0`(인스턴스 로컬 L1 끔). `images.customCacheHandler`는 켜지 않음(IMAGE kind는 디스크 유지) |
| `Dockerfile` | `ARG GIT_SHA` → `ENV GIT_SHA`. standalone이 자동 트레이싱 안 하므로 `cache-handler/*.mjs` + `@aws-sdk`/`@smithy`/`@aws-crypto`/`@aws`/`tslib` 명시 COPY. `require.resolve('@aws-sdk/client-s3')` + `cache-handler/index.mjs` accessSync 빌드 게이트(누락 시 빌드 실패) |
| `package.json` | `@aws-sdk/client-s3` `^3.1075.0` 추가 (modular import) |
| `vitest.config.ts` | node project include에 `cache-handler/**/__tests__/**/*.test.mjs` 추가 |

### 배포 / 인프라

| 파일 | 변경 |
|---|---|
| `.github/workflows/deploy.yml` | docker build에 `--build-arg GIT_SHA=${IMAGE_TAG}` 전달 |
| `infra/aws/deploy.sh` | instance refresh 성공 후 SSM `/siglens/prev-isr-buildid`에서 직전 태그를 읽어 옛 S3 prefix `s3 rm --recursive`로 정리(best-effort, 실패해도 배포 안 막음), 현재 태그를 SSM에 기록 |
| `infra/aws/iam/ec2-role-policy.json` | `IsrCacheS3` statement 추가 — `s3:GetObject/PutObject/DeleteObject` on `arn:aws:s3:::siglens-isr-cache/*` |
| `infra/aws/12-isr-cache.sh` (신규) | S3 버킷 멱등 생성 + 퍼블릭 접근 차단 + 14일 균일 만료 lifecycle |

---

## 3. 핵심 동작 (core behaviors)

### get(cacheKey, ctx)
1. `config.disabled`(킬스위치)면 즉시 `null`.
2. `s3Store.getEntry(key, ctx.kind)` → S3 GET + gunzip → `{value, lastModified, tags}`.
3. soft invalidation: `maxRevalidatedAt(entry.tags) > entry.lastModified`면 stale → `null`.
4. 아니면 Next 계약대로 래퍼 `{ lastModified, value }` 반환.

### set(cacheKey, data, ctx)
- `disabled`면 no-op. 아니면 `setEntry(key, data.kind, { value: data, lastModified: now, tags: collectTags(data, ctx) })`.
- `collectTags`는 FETCH의 `ctx.tags`(+방어적 `ctx.softTags`)+`data.tags`, 그리고 APP_PAGE/APP_ROUTE/PAGES의 헤더 `x-next-cache-tags`(쉼표 구분)를 union — 이전 `ctx?.tags||[]`가 페이지를 항상 `tags:[]`로 저장해 revalidateTag가 ISR 페이지를 영구 무효화 못 하던 버그를 수정.

### revalidateTag(tags, durations?)
- 로컬 맵에 `tag→now` 즉시 기록(read-your-writes). `durations`(Next16 SWR profile)는 무시.

### S3 키 스킴
```
siglens-isr/{GIT_SHA}/pages/{encodeURIComponent(key)}.cache   APP_PAGE/APP_ROUTE/PAGES
siglens-isr/{GIT_SHA}/fetch/{encodeURIComponent(key)}.cache   FETCH
```
- `encodeURIComponent(key)` 길이가 900바이트 초과 시 `sha256(key)` fallback(1024바이트 한계 헤드룸).
- object body = `gzip(JSON.stringify({ value, lastModified, tags }))`.

### buildId prefix 무효화
- 배포 = 새 `GIT_SHA` = 새 S3 prefix → 옛 캐시 미참조 = 자동 cold. `deploy.sh`가 직전 prefix를 `s3 rm`으로 정리, lifecycle 14일이 백업.

### 킬스위치
- 런타임 비상: `ISR_CACHE_DISABLED=true` → get→null/set→no-op(SSR 직행). 핸들러 등록 자체는 빌드 타임 결정이라 토글 불가 → 완전 롤백은 이전 이미지 instance refresh.

### 에러 처리 (fail-open)
- get: `NoSuchKey`/404 → null(정상 miss), 기타 에러 → null + console.error(재생성). set: 에러 삼킴(응답 flush 후).

---

## 4. 게이트 (무엇이 언제 활성화되나)

| 환경 | cacheHandler | 캐시 위치 |
|---|---|---|
| **production + ISR_CACHE_BUCKET 설정** | **활성** | S3 (`siglens-isr/{GIT_SHA}/...`) |
| production + 버킷 미설정 | 비활성(undefined) | 파일시스템(`.next/cache`) |
| dev (`yarn dev`) | 비활성 | 파일시스템 |
| E2E build/run (버킷 없음) | 비활성 | 파일시스템 |

- IMAGE kind(next/image 최적화)는 게이트와 무관하게 항상 디스크 유지(`images.customCacheHandler` 미옵트인).

---

## 5. 리스크 면 (risk surface)

- **커스텀 코드 (최대 리스크)**: S3 검증 라이브러리 없음 → Next 내부 계약(ctx `kind`/`key` 형식, `x-next-cache-tags` 헤더, CacheHandlerValue shape)에 직접 의존. Next 업그레이드 시 깨질 수 있음. 완화: 철저한 단위 테스트 + `NEXT_PRIVATE_DEBUG_CACHE` 검증.
- **staging 부재**: 실 S3 I/O 자동 검증 불가 → 배포 후 수동 검증 게이트에 의존(통합 테스트는 기본 스킵).
- **standalone 트레이싱**: cacheHandler가 비활성(E2E)이면 Next가 SDK를 트레이싱 안 함 → Dockerfile 명시 COPY + `require.resolve` 빌드 게이트로 보강. COPY 누락 시 런타임 ENOSPC가 아니라 빌드 실패로 잡아야 함.
- **로컬 태그맵 휘발**: 인스턴스 재시작 시 무효화 휘발(배포는 prefix 격리라 무관), 멀티 인스턴스 전파 없음 → 둘 다 시간 `revalidate`가 백업.
- **배포마다 전체 cold**: 새 prefix → 외부 API/CPU 스파이크(현 빈-캐시 재시작과 동일 수준, on-demand라 점진 재생성).

---

## 6. 비변경(명시) — 회귀 가드

- analysis 도메인 로직, AI 프롬프트, 지표 계산, tier 정책: **무변경**(이 PR은 순수 인프라/캐시 계층).
- 페이지 컴포넌트·라우트·SEO 메타·sitemap/robots 로직: **무변경**(캐시 백엔드만 교체).
- dev/E2E 동작: cacheHandler 미등록이라 master와 동일해야 함(회귀 0 기대).
