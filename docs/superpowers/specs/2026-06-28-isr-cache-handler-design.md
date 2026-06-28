# ISR Cache Handler 외부화 설계 (Next.js 16.2 → S3)

- 작성일: 2026-06-28
- 상태: 설계 확정 (구현 대기)
- 관련: 2026-06-28 디스크풀 인시던트(루트 디스크 100% → read-only 강등 → 서비스 장애) — 본 설계는 그 근본 해결책

## 1. 배경 / 문제

siglens의 ISR 캐시(`.next/server`의 런타임 생성물 + `.next/cache/fetch-cache`)가 **컨테이너 로컬 디스크에 무한 누적**된다. 모든 `[symbol]/*` 라우트가 `generateStaticParams()=[]`(on-demand ISR)이라, 사용자가 방문한 (심볼×탭) 페이지가 매번 디스크에 저장된다. 수천 개의 동적 라우트 탓에 **시간당 ~2.3GB 증가**, 한 인스턴스가 ~22시간 살면 50GB 루트 디스크가 가득 차 **read-only로 강등 → 서비스 장애**(2026-06-28 인시던트).

기존엔 배포(instance refresh)가 잦아 `--rm` 컨테이너 재시작으로 캐시가 리셋되며 가려져 있었으나, 한 인스턴스가 오래 살면 터진다.

## 2. 목표 / 비목표

**목표**
- ISR/fetch 캐시를 컨테이너 디스크 → **외부 공유 저장소(S3)**로 이전해 디스크 누적을 원천 차단
- 인스턴스 교체·스케일아웃에도 캐시 영속 → cold 재생성(외부 API 폭증) 감소
- 기존 on-demand 무효화(`revalidateTag`) 동작 보존

**비목표**
- `cacheComponents`(`use cache`) 활성화 (이슈 #439로 비활성 유지)
- 멀티 인스턴스 상시 운영 최적화 (평소 단일 인스턴스 — 확장 경로로 분리)

## 3. 아키텍처

### 저장소 결정: S3-only + 로컬 in-process 태그맵

검증된 라이브러리(@neshca=Next16 미지원, @trieb.work/@fortedigital=Redis 전용)는 모두 Redis 의존. Upstash(서버리스 Redis)는 캐시 용량(수십 GB)·`cacheMaxMemorySize:0`로 인한 매-read 페이로드 전송 때문에 storage/command/bandwidth 비용이 불리(추정 $35~80/mo vs S3 $10~20/mo). → **S3 커스텀 핸들러** 채택.

**DynamoDB는 의도적 제외.** ASG가 평소 `desired=1`(스케일 정책 1000 req/target, 현재 트래픽 28 req/분 → 거의 스케일아웃 없음)이라, 태그 무효화는 **로컬 in-process 맵**으로 충분. (확장 경로 §8 참조)

### 컴포넌트

```
cache-handler.mjs   CacheHandler 클래스 (얇은 오케스트레이터)
config.mjs          env 읽기: 버킷명, region, keyPrefix, buildId(GIT_SHA)
s3Store.mjs         S3 get/set/delete (gzip 직렬화)
tagStore.mjs        로컬 in-process Map<tag, revalidatedAt>
serialize.mjs       gzip/gunzip
```

각 모듈은 독립 단위 테스트 가능(AWS SDK mock, 두 스토어 mock).

### 데이터 흐름

```
읽기:  get(key, ctx)
  → s3Store.get(key)  [S3 GET + gunzip] → {value, lastModified, tags}
  → 엔트리 tags 각각 tagStore.get(tag) 비교
  → max(revalidatedAt) > lastModified 이면 null(stale), 아니면 hit

쓰기:  set(key, data, ctx)
  → s3Store.set(key, gzip({value, lastModified:now, tags, revalidate, kind}))
  → try/catch (실패는 로깅만, 응답 flush 후라 사용자 영향 없음)

무효화: revalidateTag(tags, durations?)
  → 각 tag: tagStore.set(tag, now)  [로컬 맵 즉시 갱신 = read-your-writes]
```

## 4. 상세 설계

### 4.1 Next.js 16.2 cacheHandler 계약 (소스 확인)

`incremental-cache/index.d.ts` 기준 단수 `CacheHandler` 메서드:
```ts
get(cacheKey, ctx): Promise<CacheHandlerValue | null>
set(cacheKey, data, ctx): Promise<void>
revalidateTag(tags: string | string[], durations?): ...
resetRequestCache(): void
```
- ⚠️ **`refreshTags`는 단수 핸들러에 없음** (그건 `cacheHandlers` 복수 = `use cache` 전용). 멀티 인스턴스 태그 검증은 **`get()` 내부**에서 수행.
- `cacheComponents` 비활성이므로 전통 cacheHandler가 ISR/fetch/route/unstable_cache를 모두 담당.
- 태그는 `unstable_cache`(`staticSymbolCache`)에 걸리며 `FETCH` kind `set` ctx.tags로 정상 전달됨(검증 완료). #78864(APP_PAGE set의 tags 누락) 버그는 데이터-레이어 태그 방식이라 영향 없음.

### 4.2 S3 키 스킴 + 저장 포맷

```
{prefix}/{buildId}/pages/{encodeURIComponent(key)}.cache   APP_PAGE/APP_ROUTE/PAGES
{prefix}/{buildId}/fetch/{encodeURIComponent(key)}.cache   FETCH
  prefix  = "siglens-isr"
  buildId = process.env.GIT_SHA  (Dockerfile ARG→ENV)
```
- 키 충돌 방지: `encodeURIComponent(key)`(고유성 보존), 1024바이트 초과 시 sha256 fallback
- S3 object body = `gzip(JSON.stringify({ value, lastModified, tags, revalidate, kind }))` — 메타를 페이로드와 한 객체에. RSC 페이로드가 커서 **gzip 필수**

### 4.3 태그 처리 (로컬 in-process, soft invalidation)

- `tagStore` = 핸들러 메모리의 `Map<tag, revalidatedAt>`, 항목 **10s TTL**은 적용하지 않고(로컬이 source of truth) 영구 보관
- `set`은 DynamoDB/외부 미접촉 — S3 엔트리에 `tags`+`lastModified`만 기록
- `revalidateTag`는 로컬 맵에 `tag→now` 즉시 기록(read-your-writes 보장)
- `get`은 S3 엔트리의 각 tag를 로컬 맵과 비교해 stale 판정

### 4.4 무효화 / 배포

- **배포 무효화 = buildId(GIT_SHA) prefix 전환으로 자동.** 새 배포 = 새 prefix → 옛 캐시는 참조되지 않아 자동 무효(전부 cold 재생성)
- 옛 prefix 정리: `deploy.sh`에 `aws s3 rm --recursive .../{직전SHA}/` + S3 lifecycle 14일 백업
- CF 퍼지: `deploy.yml`의 기존 `purge_everything` 유지(엣지 캐시)
- ⚠️ 배포마다 전체 cold → 외부 API/CPU 스파이크. 현재(새 인스턴스 빈 캐시)와 동일 수준. on-demand라 방문분만 점진 재생성

### 4.5 next.config 와이어링 (ESM)

```ts
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// ...
cacheHandler: process.env.NODE_ENV === 'production' && process.env.ISR_CACHE_BUCKET
  ? require.resolve('./cache-handler.mjs') : undefined,
cacheMaxMemorySize: 0,   // 멀티 인스턴스 정합성: 인스턴스 로컬 L1 끔
```
- `generateBuildId`는 손대지 않음 — siglens는 CI 단일 빌드 → 단일 이미지라 `.next/BUILD_ID`가 전 인스턴스 동일. S3 prefix용 buildId는 `GIT_SHA` env로 별도 주입

### 4.6 에러 처리 (가용성 우선, fail-open)

- `get`: S3 `NoSuchKey`→null(정상 miss). 기타 에러→null + `console.error`(graceful degrade, 재생성)
- `set`: try/catch→로깅만 (응답 flush 후라 사용자 영향 없음)
- `revalidateTag`: 실패→로깅(로컬 맵 갱신은 성공). 시간 기반 `revalidate`가 최종 백업

### 4.7 빌드 / Docker

- `@aws-sdk/client-s3` 추가 (modular import로 번들 최소화)
- standalone이 핸들러·SDK를 자동 트레이싱 안 할 수 있음(특히 E2E 빌드에선 cacheHandler 미등록) → **`outputFileTracingIncludes`에 조건 무관 명시 포함** + Dockerfile 명시 COPY + `require.resolve` 검증 라인(sharp 패턴)
- `GIT_SHA`를 Dockerfile `ARG`→`ENV`로 주입(`deploy.yml`이 전달)

### 4.8 인프라 (`infra/aws/12-isr-cache.sh`, 신규)

- S3 버킷 + lifecycle(전체 14일 만료; og/twitter image prefix는 30일+)
- `00-iam-setup.sh`의 EC2 role inline 정책에 S3(GetObject/PutObject/DeleteObject) 추가 (DynamoDB 없음)

### 4.9 킬 스위치 / 롤백 (2단계)

cacheHandler 등록은 **빌드 타임 결정**이라 런타임 토글 불가. 따라서:
1. **런타임 비상 토글**: 핸들러 내부에서 `ISR_CACHE_DISABLED` env를 읽어 `true`면 `get→null`/`set→no-op`(캐시 끄고 SSR 직행, 외부 API↑ 감수). 즉시
2. **완전 롤백**: 이전 이미지(cacheHandler 없던 빌드)로 instance refresh(buildId 롤백, deploy.sh 헬스체크 롤백과 동일)

## 5. 빌드타임 prerender 처리

- `/`, `/economy`, `/news` 등 빌드 prerender 페이지는 이미지에 baked(고정 크기, 디스크 누적 무관). revalidate 후 재생성 시에만 cacheHandler 경유
- `[symbol]/*`(generateStaticParams=[])는 빌드 prerender 0 → 전량 런타임 cacheHandler → **디스크풀 주범이 정확히 외부화**됨

## 6. 테스트 전략

- **단위(vitest, mock)**: `serialize`(gzip 왕복), `s3Store`(키 스킴·gzip·NoSuchKey→null·에러→null, SDK mock), `tagStore`(revalidate/조회, read-your-writes), `cache-handler`(stale 판정 분기·set try-catch, 두 스토어 mock)
- ⚠️ **통합 테스트 공백 리스크**: siglens는 staging이 없고 cacheHandler는 prod-only라 S3 실제 I/O 자동 검증이 어렵다. → (권장) localstack 또는 전용 테스트 버킷으로 왕복 통합 1세트 추가, (최소) 배포 후 즉시 검증을 게이트로 명문화
- **배포 후 검증(게이트)**: `NEXT_PRIVATE_DEBUG_CACHE=1` 로그로 핸들러 호출 확인, `df` 평탄화(성공 기준), S3 객체 증가, news `revalidateTag` 동작, origin TTFB·5xx·외부 API 스파이크 허용 범위, 롤백(`ISR_CACHE_DISABLED`) 리허설

## 7. 구현 순서

1. `@aws-sdk/client-s3` 추가 + yarn install
2. `serialize.mjs` + 단위 테스트
3. `s3Store.mjs` + 단위 테스트
4. `tagStore.mjs`(로컬 태그맵) + 단위 테스트
5. `cache-handler.mjs` + 단위 테스트
6. `next.config` 와이어링(createRequire, cacheMaxMemorySize:0, prod+bucket 조건)
7. Dockerfile(outputFileTracingIncludes + 명시 COPY + require.resolve 검증, GIT_SHA ARG→ENV)
8. `infra/aws/12-isr-cache.sh`(S3 버킷+lifecycle+IAM)
9. `deploy.yml`/`deploy.sh`(GIT_SHA 전달 + 옛 prefix 정리)
10. (선택) localstack/테스트버킷 통합 테스트
10.5. **회귀 게이트**: 전체 `yarn test` + `yarn e2e` 통과 (캐시 정리는 `yarn clear:build`)
11. 배포 + 배포 후 검증(§6) — **df 평탄화 = 성공 기준**

## 8. 확장 경로 (기록)

| 단계 | 트리거 | 조치 |
|---|---|---|
| **현재** | 단일 인스턴스 | 로컬 in-process 태그맵 |
| **1차** | 재시작 무효화 휘발 문제 / 가끔 멀티 | **S3 태그 마커**(`siglens-isr/tags/{tag}`에 revalidatedAt 객체) — DynamoDB 없이 S3만으로 영속+멀티 전파 |
| **2차** | 상시 `desired≥2` + 태그 조회 레이턴시 중요 | **DynamoDB 태그 스토어**(soft invalidation, PK=tag/revalidatedAt 한 컬럼) |

`tagStore.mjs` 상단 주석에도 이 경로를 명시한다.

## 9. 리스크 & 트레이드오프

- **커스텀 코드 유지보수**(최대 리스크): S3 검증 라이브러리 없음 → Next 내부 계약(ctx kind/key 형식/durations) 변경에 취약. 완화: OpenNext 구현 참고 + 철저한 단위 테스트 + `NEXT_PRIVATE_DEBUG_CACHE` 검증
- **staging 부재**: 통합 검증이 배포 후 수동에 의존 (§6)
- **cacheComponents 부채**: 미래에 `use cache` 활성화 시 `cacheHandlers`(복수) 마이그레이션 필요
- **로컬 태그맵 한계**: 재시작 시 무효화 휘발(크래시 한정, 배포는 prefix 격리로 무관) / 멀티 전파 없음(스케일아웃 순간) — 둘 다 시간 `revalidate`가 백업

## 10. 비용 (추정)

- S3 storage(~30GB) ~$0.7 + 요청 ~$6~15 + DynamoDB 없음 = **~$10~20/mo**
- 절감 효과(캐시로 인한 외부 API 절감 + 디스크풀 장애 제거 + cold↓)는 S3 외부화가 달성하며 DynamoDB 유무와 독립
- 정확한 수치는 배포 후 외부 API 호출량 변화로 실측

## 11. 관련 후속 (완료, 별건)

- CloudWatch 알람의 빈 `AlarmActions` 보강: `07-alarms.sh`가 SNS 토픽 idempotent 생성 + 액션 연결(커밋 `6f8dd600`). 디스크풀이 무알림으로 진행된 인시던트 후속. 외부화 배포 전까지 disk 85% 알람이 공백 안전망.
