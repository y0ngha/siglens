# ISR Cache Handler — 검증 Test-Case Sheet (배포 전 실증)

> 대상: 커스텀 Next.js 16.2 `cacheHandler` S3 외부화 (branch `feature/isr-cache-handler`)
> 기준 Spec: [`../superpowers/specs/2026-06-28-isr-cache-handler-design.md`](../superpowers/specs/2026-06-28-isr-cache-handler-design.md)
> 변경 범위: [`2026-06-28-isr-cache-handler-change-scope.md`](./2026-06-28-isr-cache-handler-change-scope.md)
> 작성일: 2026-06-28
> 목적: **수동 실증 QA** (curl + Chrome devtools 두 트랙). 단위 테스트가 커버해도 prod-like 빌드/실행에서 빌드 산출물·런타임·캐시 동작·SEO를 직접 검증한다.
> 가정: 서버는 `http://localhost:4200`. curl `BASE=http://localhost:4200`.

---

## 0. 실행 전 준비 (Preconditions — 공통)

- **prod-like 빌드 (캐시 핸들러 활성 경로)**: cacheHandler는 `NODE_ENV==='production' && ISR_CACHE_BUCKET`일 때만 등록되므로, 활성 검증에는 `NODE_ENV=production` + `ISR_CACHE_BUCKET` 둘 다 필요.
  ```bash
  export BASE=http://localhost:4200
  yarn build > /tmp/isr-build.log 2>&1; echo "build exit=$?"   # exit 0 확인 (파이프 금지)
  ```
- 워크트리 `node_modules`는 symlink 금지 (`cp -al` 하드링크 또는 독립 `yarn install`). `@aws-sdk/client-s3` 설치 확인: `node -e "require.resolve('@aws-sdk/client-s3')"`.
- `.env.local`/`.env.production` 키셋이 형제 워크트리와 일치 (QA env 스왑 복원 누락 주의).
- **캐시 활성 케이스(TC-A·TC-CB)** 는 실 S3 + AWS 자격증명 필요: `ISR_CACHE_BUCKET=siglens-isr-cache GIT_SHA=qa-$(date +%s) AWS_PROFILE=siglens`. 자격증명 없으면 해당 케이스는 SKIP하고 사유 기록.
- `NEXT_PUBLIC_SITE_URL` 미설정 시 SEO URL은 `https://siglens.io` 기본값 → canonical/og:url 호스트는 그 값이 박힐 수 있음(정상). 호스트가 아니라 path/구조를 검증한다.

### 참고 상수 (검증 기준값)

| 항목 | 값 |
|---|---|
| S3 prefix | `siglens-isr/{GIT_SHA}/` (pages/ · fetch/ subfolder) |
| 게이트 조건 | `NODE_ENV==='production' && ISR_CACHE_BUCKET` (둘 다여야 활성) |
| 킬스위치 | `ISR_CACHE_DISABLED=true` → get→null/set→no-op |
| Dockerfile 빌드 게이트 | `require.resolve('@aws-sdk/client-s3')`, `cache-handler/index.mjs` accessSync |
| 명시 COPY 모듈 | `cache-handler/*.mjs`, `@aws-sdk`, `@smithy`, `@aws-crypto`, `@aws`, `tslib` |
| news 페이지 revalidate | `/news` = 86400(24h), `/[symbol]/news` = 43200(12h) |
| news on-demand tag | `news:${symbol}` (ensureNewsCardsAnalyzedAction), `market-news:<sentinel>` |
| 디버그 로그 env | `NEXT_PRIVATE_DEBUG_CACHE=1` |
| 키 길이 한계 | encodeURIComponent > 900바이트면 sha256 fallback |

---

## A. BUILD 트랙 (산출물 검증)

### TC-B01 — prod-like 빌드 성공
- **ID**: TC-B01 · **Scope**: build · **Priority**: P0
- **Action**:
  ```bash
  yarn build > /tmp/isr-build.log 2>&1; echo "exit=$?"
  ```
- **Expected**: exit 0. 로그 끝에 `✓ Compiled` / route 테이블 출력. ENOSPC·module-not-found 없음.
- **Pass/Fail**: exit 0 = PASS. exit≠0 = FAIL(로그 tail 첨부).

### TC-B02 — standalone 번들에 cache-handler + @aws-sdk 포함 (Dockerfile require.resolve 게이트 시뮬)
- **ID**: TC-B02 · **Scope**: build · **Priority**: P0
- **Action**: 빌드 산출물(또는 standalone 디렉토리)에서 핸들러·SDK 존재 확인.
  ```bash
  ls cache-handler/*.mjs
  node -e "require.resolve('@aws-sdk/client-s3'); require('node:fs').accessSync('./cache-handler/index.mjs'); console.log('OK')"
  ls -d node_modules/@aws-sdk node_modules/@smithy node_modules/@aws-crypto node_modules/@aws node_modules/tslib
  ```
- **Expected**: `index.mjs config.mjs s3Store.mjs tagStore.mjs serialize.mjs` 5개 존재. node 스니펫이 `OK` 출력. 5개 SDK 의존 디렉토리 모두 존재.
- **Pass/Fail**: 모든 require.resolve/accessSync 성공 = PASS. 하나라도 실패 = FAIL (Dockerfile COPY 누락 = 프로덕션 런타임 깨짐).

### TC-B03 — E2E 빌드(버킷 없음)도 성공 + cacheHandler 미등록(파일시스템 폴백)
- **ID**: TC-B03 · **Scope**: build · **Priority**: P0
- **Action**:
  ```bash
  unset ISR_CACHE_BUCKET
  E2E_TEST=1 yarn build > /tmp/isr-e2e-build.log 2>&1; echo "exit=$?"
  grep -c "cacheHandler" /tmp/isr-e2e-build.log || true
  ```
- **Expected**: exit 0. cacheHandler 미등록이라도 빌드가 깨지지 않음(standalone 트레이싱이 SDK를 빼도 빌드는 정상 — Dockerfile COPY가 보강).
- **Pass/Fail**: exit 0 = PASS. (E2E 경로에서 S3 코드가 require 안 돼 빌드 실패 없어야 함.)

### TC-B04 — 단위 테스트 통과 (cache-handler 스위트)
- **ID**: TC-B04 · **Scope**: build/unit · **Priority**: P1
- **Action**:
  ```bash
  yarn vitest run cache-handler > /tmp/isr-unit.log 2>&1; echo "exit=$?"
  ```
- **Expected**: serialize/s3Store/tagStore/index 스위트 전부 통과. integration 스위트는 `ISR_CACHE_IT` 미설정이라 skip.
- **Pass/Fail**: exit 0 + failed 0 = PASS.

---

## B. RUNTIME 트랙 (curl — Status / HTML)

> 서버 기동: `yarn start`(prod) 또는 `yarn dev`. 캐시 활성 검증은 prod 모드 + 버킷 env 필요.

### TC-C01 — 핵심 페이지 200 + HTML 본문
- **ID**: TC-C01 · **Scope**: runtime · **Priority**: P0
- **Action**:
  ```bash
  for p in / /economy /AAPL /AAPL/overall /news; do
    code=$(curl -s -o /tmp/pg.html -w "%{http_code}" "$BASE$p")
    echo "$p -> $code  bytes=$(wc -c < /tmp/pg.html)"
  done
  ```
- **Expected**: 모든 경로 `200`. 각 응답 바이트 > 10KB(빈/degraded 92KB 미만 페이지 아님). `/AAPL` HTML에 `AAPL` 포함, `/news` HTML에 뉴스 섹션 텍스트 포함.
- **Pass/Fail**: 전부 200 + 본문 존재 = PASS. 5xx 또는 0/빈 바이트 = FAIL.

### TC-C02 — 5xx 없음 / 응답 헤더 정상
- **ID**: TC-C02 · **Scope**: runtime · **Priority**: P0
- **Action**:
  ```bash
  curl -s -D - -o /dev/null "$BASE/AAPL/overall" | grep -iE "^HTTP|content-type|x-nextjs-cache|cache-control"
  ```
- **Expected**: `HTTP/.. 200`. `content-type: text/html`. `x-nextjs-cache` 헤더가 `HIT`/`MISS`/`STALE` 중 하나(캐시 계층 동작 증거). 5xx 없음.
- **Pass/Fail**: 200 + text/html = PASS.

### TC-C03 — 반복 요청 안정성 (캐시 hit이 깨지지 않음)
- **ID**: TC-C03 · **Scope**: runtime · **Priority**: P1
- **Action**:
  ```bash
  for i in 1 2 3; do curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" "$BASE/AAPL"; done
  ```
- **Expected**: 3회 모두 200. 2·3회차가 1회차보다 같거나 빠름(캐시 hit). 회차 간 500/타임아웃 없음.
- **Pass/Fail**: 3회 200 = PASS.

---

## C. CACHE BEHAVIOR 트랙 (S3 활성 — 자격증명 필요)

> 전제: prod 모드 + `ISR_CACHE_BUCKET=siglens-isr-cache GIT_SHA=qa-<ts>` + AWS 자격증명. 미충족 시 SKIP(사유 기록).

### TC-A01 — 페이지 방문 후 S3에 buildId prefix 객체 생성
- **ID**: TC-A01 · **Scope**: cache · **Priority**: P0
- **Action**:
  ```bash
  PFX="siglens-isr/${GIT_SHA}"
  aws s3 ls "s3://$ISR_CACHE_BUCKET/$PFX/" --recursive | wc -l   # 방문 전
  curl -s -o /dev/null "$BASE/AAPL"; curl -s -o /dev/null "$BASE/AAPL/overall"
  sleep 2
  aws s3 ls "s3://$ISR_CACHE_BUCKET/$PFX/pages/" --recursive
  ```
- **Expected**: 방문 후 `$PFX/pages/` 아래 `*.cache` 객체 ≥ 1개 생성. 키가 `siglens-isr/{GIT_SHA}/pages/...cache` 형태. fetch 캐시도 발생 시 `$PFX/fetch/`에 객체.
- **Pass/Fail**: prefix 아래 객체 증가 = PASS. 0개 = FAIL(set 미동작 또는 게이트 미충족).

### TC-A02 — NEXT_PRIVATE_DEBUG_CACHE=1 로 get/set 로그
- **ID**: TC-A02 · **Scope**: cache · **Priority**: P1
- **Action**: 서버를 `NEXT_PRIVATE_DEBUG_CACHE=1`로 기동 후 `/AAPL` 방문, 서버 stdout 관찰.
  ```bash
  curl -s -o /dev/null "$BASE/AAPL"   # 서버 로그 tail 확인
  ```
- **Expected**: 서버 로그에 cacheHandler get/set 활동 표시(Next 디버그 라인). `[isr-cache] s3 ... failed` 에러가 **반복** 출력되지 않음(자격증명/버킷 정상이면 실패 로그 없어야 함).
- **Pass/Fail**: 핸들러 호출 로그 존재 + 반복 에러 없음 = PASS.

### TC-A03 — revalidateTag(news) 무효화 경로
- **ID**: TC-A03 · **Scope**: cache · **Priority**: P1
- **Action**: `/news` 또는 `/[symbol]/news` 페이지가 신선 뉴스 ingestion(`ensureNewsCardsAnalyzedAction`)으로 `revalidateTag('news:${symbol}', 'max')`를 호출하는 경로. 검증은 단위 테스트(index.test.mjs의 revalidateTag→stale 분기)로 1차 보증하고, 런타임에서는:
  ```bash
  curl -s -o /tmp/n1.html -w "%{http_code}\n" "$BASE/AAPL/news"   # 1차 (캐시 채움)
  # (뉴스 갱신 트리거 후) 재요청 시 stale 판정으로 재생성되는지 확인
  curl -s -o /tmp/n2.html -w "%{http_code}\n" "$BASE/AAPL/news"
  ```
- **Expected**: 두 요청 모두 200. revalidateTag 후의 get은 `maxRevalidatedAt(tags) > lastModified`로 stale → null → 재생성(콘텐츠 갱신). 태그가 `tags:[]`로 저장되지 않음(collectTags가 `x-next-cache-tags` 헤더에서 `news:AAPL`/`symbol:AAPL` 추출).
- **Pass/Fail**: 200 + 단위 테스트 revalidateTag 분기 PASS = PASS. (collectTags 회귀: 페이지 엔트리 tags가 비면 FAIL.)

### TC-A04 — 킬스위치 (ISR_CACHE_DISABLED)
- **ID**: TC-A04 · **Scope**: cache · **Priority**: P1
- **Action**: 서버를 `ISR_CACHE_DISABLED=true`로 기동.
  ```bash
  curl -s -o /tmp/pg.html -w "%{http_code}\n" "$BASE/AAPL"
  aws s3 ls "s3://$ISR_CACHE_BUCKET/siglens-isr/${GIT_SHA}/" --recursive | wc -l
  ```
- **Expected**: 페이지 200(SSR 직행). 킬스위치 ON이라 set이 no-op → S3에 새 객체 생성 안 됨(또는 증가 0).
- **Pass/Fail**: 200 + S3 객체 미증가 = PASS.

---

## D. SEO 트랙 (curl — 서버 렌더 메타)

### TC-S01 — title / meta description / canonical (서버 렌더)
- **ID**: TC-S01 · **Scope**: seo · **Priority**: P0
- **Action**:
  ```bash
  curl -s "$BASE/AAPL/overall" | grep -oE '<title>[^<]+</title>|<meta name="description"[^>]*>|<link rel="canonical"[^>]*>' | head
  ```
- **Expected**: `<title>` 비어있지 않음. `<meta name="description" content="...">` 존재(내용 있음). `<link rel="canonical" href=".../AAPL/overall">` 존재(path가 요청 경로와 일치). 모두 **HTML 소스에** 존재(클라이언트 전용 아님).
- **Pass/Fail**: 3종 모두 SSR HTML에 존재 = PASS.

### TC-S02 — OG / Twitter 태그
- **ID**: TC-S02 · **Scope**: seo · **Priority**: P1
- **Action**:
  ```bash
  curl -s "$BASE/AAPL" | grep -oE '<meta property="og:[^"]+"|<meta name="twitter:[^"]+"' | sort -u
  ```
- **Expected**: `og:title`·`og:description`·`og:image`·`og:url`·`og:type` 및 `twitter:card`·`twitter:title` 존재.
- **Pass/Fail**: og:* 와 twitter:* 핵심 태그 존재 = PASS.

### TC-S03 — sitemap / robots
- **ID**: TC-S03 · **Scope**: seo · **Priority**: P1
- **Action**:
  ```bash
  curl -s -o /dev/null -w "sitemap=%{http_code}\n" "$BASE/api/sitemap"
  curl -s -o /dev/null -w "robots=%{http_code}\n"  "$BASE/robots.txt"
  curl -s "$BASE/robots.txt" | grep -iE "sitemap:|user-agent|disallow" | head
  ```
- **Expected**: `/api/sitemap` 200 (XML). `/robots.txt` 200 + `Sitemap:` 라인 + `User-agent`/`Disallow` 규칙 포함.
- **Pass/Fail**: 둘 다 200 + robots에 sitemap 라인 = PASS.

### TC-S04 — master 대비 SEO 회귀 없음
- **ID**: TC-S04 · **Scope**: seo/regression · **Priority**: P1
- **Action**: master 빌드와 본 브랜치 빌드에서 같은 페이지의 메타 태그 셋을 비교.
  ```bash
  curl -s "$BASE/AAPL/overall" | grep -oE '<meta [^>]+>|<title>[^<]+</title>|<link rel="canonical"[^>]*>' | sort > /tmp/seo-branch.txt
  # (master 서버에서 동일 추출 → /tmp/seo-master.txt)
  diff /tmp/seo-master.txt /tmp/seo-branch.txt || echo "DIFF DETECTED"
  ```
- **Expected**: 메타 태그 셋이 master와 동일(캐시 백엔드만 바뀜 → SEO 출력 불변).
- **Pass/Fail**: diff 없음(또는 호스트/캐시 무관 차이만) = PASS.

---

## E. CHROME 트랙 (시각 / 콘솔)

> Chrome MCP 도구(navigate / read_page / read_console_messages) 사용.

### TC-CH01 — 페이지 시각 렌더 + 콘솔 에러 없음
- **ID**: TC-CH01 · **Scope**: chrome · **Priority**: P0
- **Action**: Chrome로 `$BASE/AAPL/overall` 이동 → 렌더 대기 → 콘솔 읽기.
- **Expected**: 차트/분석/탭 등 핵심 UI 표시. console error(빨강) 없음(애드센스/3rd-party 경고는 무시). 빈 화면·hydration mismatch 없음.
- **Pass/Fail**: UI 렌더 + error 0 = PASS.

### TC-CH02 — 홈/economy/news 렌더
- **ID**: TC-CH02 · **Scope**: chrome · **Priority**: P1
- **Action**: `$BASE/` , `$BASE/economy`, `$BASE/news` 각각 이동 → 렌더 확인 + 콘솔.
- **Expected**: 각 페이지 핵심 섹션 표시(홈=마켓 요약, economy=지표, news=뉴스 카드). console error 없음.
- **Pass/Fail**: 3페이지 렌더 + error 0 = PASS.

---

## F. REGRESSION 트랙 (캐시 핸들러 비활성 경로)

### TC-R01 — dev 모드에서 동작 불변 (cacheHandler 미등록)
- **ID**: TC-R01 · **Scope**: regression · **Priority**: P0
- **Action**: `yarn dev`(NODE_ENV!=production → cacheHandler undefined) 기동 후 핵심 경로 curl.
  ```bash
  for p in / /economy /AAPL /AAPL/overall /news; do
    echo "$p -> $(curl -s -o /dev/null -w '%{http_code}' "$BASE$p")"
  done
  ```
- **Expected**: 전부 200. S3 접근 없음(`[isr-cache]` 로그 없음). 파일시스템 캐시 정상.
- **Pass/Fail**: 전부 200 + S3 미접근 = PASS.

### TC-R02 — 버킷 미설정 prod 빌드도 폴백 동작
- **ID**: TC-R02 · **Scope**: regression · **Priority**: P1
- **Action**: `ISR_CACHE_BUCKET` unset 상태로 prod 빌드/기동 후 페이지 요청.
- **Expected**: cacheHandler undefined → 파일시스템 캐시. 페이지 200, 5xx·크래시 없음.
- **Pass/Fail**: 200 + 정상 = PASS.

### TC-R03 — 전체 단위 테스트 회귀 없음
- **ID**: TC-R03 · **Scope**: regression · **Priority**: P1
- **Action**: `yarn test > /tmp/full-test.log 2>&1; echo "exit=$?"`
- **Expected**: 기존 스위트 전부 통과(캐시 핸들러는 src/ 밖 추가라 기존 테스트 영향 0). exit 0.
- **Pass/Fail**: exit 0 + failed 0 = PASS.

---

## 우선순위 요약

| Priority | 케이스 |
|---|---|
| P0 (필수) | TC-B01, TC-B02, TC-B03, TC-C01, TC-C02, TC-A01, TC-S01, TC-CH01, TC-R01 |
| P1 | 나머지 전부 |

> S3 자격증명 미확보 시: TC-A01~A04는 단위 테스트(TC-B04) + 빌드 게이트(TC-B02)로 대체 보증하고 SKIP 사유를 명시한다. 배포 후 §6(spec) 검증 게이트에서 실 S3 동작을 최종 확인한다.
