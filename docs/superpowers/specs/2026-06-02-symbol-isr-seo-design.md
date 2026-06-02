# `[symbol]` ISR + SEO 전면 활성화 — 설계

- 날짜: 2026-06-02
- 상태: **PoC 완료(축 0 발견 + 접근 A 확정), 구현 대기**
- 관련: PR #543(ISR 도입), PR #545(getAssetInfoResilient, 머지됨), 이슈 #439(PPR 비활성)

## 배경 / 문제 (디버깅 + PoC로 확정)

PR #543이 `[symbol]` 6라우트(page/news/fundamental/options/overall/fear-greed)에 ISR(`generateStaticParams=[]` + `revalidate=3600`)을 도입했다. 그러나 `[symbol]`은 redis(`@upstash/redis` HTTP = no-store fetch)를 RSC에서 광범위하게 await한다:

- `getAssetInfo` cache(`createCacheProvider`), `peekAnalysisCache`/`peekOverallAnalysisCache`
- bars: `getBarsAction` → `getOrSetCache`(redis)
- 외부 API: `getProfile`/`getProfileDescriptionKo`, `hasOptionsMarket`/`fetchOptionsSnapshot`, `getNewsList`/earnings/grades, 펀더멘털 metrics/ratios/peers/...

ISR static generate가 no-store fetch(dynamic data)를 만나 `DYNAMIC_SERVER_USAGE`를 throw → 동적 폴백이 깨지며 **런타임 HTTP 500**. 실측: 일반 prod `build && start`(E2E_TEST 없이) `/AAPL` = 500, `DYNAMIC_SERVER_USAGE` 14회. 빌드 output은 `●`(ISR)로 표시되지만 런타임 동작이 다르다.

이 하나의 뿌리가 ① prod `[symbol]` 500 ② E2E 17 실패 ③ E2E 속도 저하(`DYNAMIC_SERVER_USAGE` 207회 재시도)를 모두 유발한다.

### ⚠️ PoC로 드러난 진짜 1차 원인 — root layout `cookies()`

설계 초안은 "redis no-store fetch를 정적화하면 ISR이 걸린다"고 가정했으나, **Phase 0 PoC가 그 가정의 선결 전제를 뒤집었다.** redis를 어떤 방식으로 정적화해도 페이지가 `ƒ (Dynamic)`로 남았고, **데이터를 전혀 fetch하지 않는 빈 페이지조차 dynamic**이었다. 원인은 페이지 데이터 계층이 아니라 **그 위 root layout**에 있었다.

`src/app/layout.tsx`는 `<Suspense><AuthSessionHeader /></Suspense>`를 렌더하고, `AuthSessionHeader`는 본체에서 `await cookies()`(hint 쿠키 읽기) + `getCurrentUser()`(DB 세션)를 호출한다. **`cacheComponents`(PPR)가 꺼진 상태에서는 `cookies()`가 Suspense 경계 안에 있어도 전체 라우트를 dynamic으로 강제한다.** AuthSessionHeader의 JSDoc("PPR 셸 구조상 불가피한 1회 swap")이 그 증거다 — 이 컴포넌트는 **PPR이 켜져 있다는 전제로** 설계됐고, Suspense-격리 트릭은 PPR 없이는 동작하지 않는다. 이슈 #439로 PPR을 끈 순간, root layout `cookies()`가 모든 라우트의 ISR을 조용히 무력화하고 있었다.

### SEO 관련 추가 확정

- `TechnicalFactsSummary`("FactLayer")는 bars/indicators 기반 종목별 실측 지표 텍스트(현재가/RSI 과매수·과매도/MACD/추세)를 **크롤 가능한 텍스트로 노출**하려는 의도(주석 명시). 분석(`AnalysisPanel`, peek)도 동일.
- 그러나 `ChartContent`/`OverallContent`가 `useSearchParams`(timeframe)로 **CSR bailout** → 현재 FactLayer가 **SSR HTML에 안 들어간다**(실측: `기술적 지표 요약`/`현재가` 0, `aria-hidden` fallback만 SSR). 즉 FactLayer SEO 의도가 현재 미실현.
- 현재 SSR SEO는 메타(title/description/keywords) + JSON-LD(assetInfo 기반 정적)에 의존.

## 목표

1. **ISR 활성화 + 모든 오류 처리**: E2E 느림/실패, 런타임 500, ISR static→동적 전환 충돌을 전부 제거. `[symbol]`이 정상 ISR 캐시되어 vercel transfer cost를 줄인다.
2. **ISR 후 SEO 콘텐츠를 SSR HTML에 모두 채움**: FactLayer(bars/peek 기반 실측 텍스트)를 SSR HTML에 박아 크롤러(JS 미실행 봇 포함)가 보게 한다. `prod build && start`로 요청 시 값이 보여야 한다.
3. **SEO 무손상**: ISR 활성화로 canonical/메타가 깨지지 않는다(특히 `[SYMBOL]` placeholder 누출 없음).

## 검증 기준 (사용자 제약)

- 1·2 모두 **실측**으로 확인 — 오류 없이 렌더링됨을 증명.
- 테스트는 **Happy Path + Worst Case** 모두 입증.
- **E2E + Integration(vitest)** 테스트를 필요 시 추가.
- **변경된 파일은 90%+ 테스트 커버리지**.

## 비목표

- PPR(`cacheComponents`) 재활성은 하지 않는다(이슈 #439 — PPR이 dynamic route를 fake-params로 prerender → generateMetadata가 `[SYMBOL]` placeholder canonical 생성). **접근 A는 PPR을 켜지 않으므로 이 메커니즘 자체가 없다.** 또한 PPR을 켜지 않기 때문에 root layout `cookies()`는 축 0(클라이언트화)으로 제거해야 한다(아래).
- core(`@y0ngha/siglens-core`)의 분석/캐시 로직 변경. peek 함수 자체는 core이며, 본 작업은 siglens app 레이어의 **호출/캐싱/렌더 전략**만 바꾼다.

## 아키텍처 — 4축 (축 0이 최우선 전제)

### 축 0. root layout `cookies()` 제거 — AuthSessionHeader 클라이언트화 ⭐ (신규·최우선)

**이것이 ISR을 막는 1차 차단 원인이다. 다른 모든 축은 축 0이 선결돼야 의미가 있다.**

root layout 렌더 경로에서 `cookies()`/DB-세션 조회를 **클라이언트로 이전**해, static generate 경로에서 dynamic API를 완전히 제거한다.

- **현재**: `layout.tsx` → `<Suspense><AuthSessionHeader /></Suspense>` → `AuthSessionHeader`(서버)가 `await cookies()` + `getCurrentUser()` 호출 → 전 라우트 dynamic.
- **변경**: `AuthSessionHeader`(서버)를 `AuthSessionHeaderClient`(`'use client'`)로 교체.
  - hint 쿠키(`siglens_auth`, 값 `'1'`, **이미 non-httpOnly**)는 `document.cookie`로 클라에서 직접 읽어 **낙관적 skeleton**(`loadingUserMenu`) 추정.
  - 실제 auth 상태는 **기존 인프라 재사용** — `useCurrentUser()` 훅(`'use client'`, react-query, `useHydrated` 게이트)이 `currentUserAction`(`'use server'`, `cookies()`+DB)을 **클라 마운트 후** 호출해 확정. 즉 `cookies()`는 static render 트리가 아니라 **클라이언트가 트리거하는 server action 안에서만** 실행된다.
  - `<Header currentUser={...} loadingUserMenu={...} />` 렌더는 동일.
- **결과**: root layout 렌더 트리에 `cookies()`가 사라져 layout이 static-eligible → 모든 라우트가 ISR/정적 캐시 가능. (PoC 5/6/7로 실증.)
- **보안(검증 완료)**: hint 쿠키는 값이 `'1'` 플래그뿐이고 PII 없음. **이미 httpOnly:false**(클라가 읽도록 설계됨), `secure` + `sameSite:lax`. 실제 인증은 httpOnly 세션 쿠키 + DB(`getCurrentUser`/`currentUserAction`)로만 이뤄지므로 hint 쿠키를 클라가 읽어도 권한 상승/세션 위조 표면이 없다. 클라이언트화는 보안 표면을 넓히지 않는다.
- **UX(트레이드오프 — 수용 확정)**: ISR 캐시 HTML은 모든 방문자에게 **동일한 게스트 셸**이 되고, 로그인 사용자는 첫 페인트에 게스트 헤더 → hydrate 후 `useCurrentUser`가 실제 상태로 교체되는 **짧은 swap**을 본다(현재 dynamic은 서버에서 바로 정답 렌더). hint 쿠키로 skeleton 추정은 하지만 캐시된 HTML 자체는 게스트다. **이 1회 swap은 ISR transfer cost 절감의 본질적 대가로 사용자가 수용했다(2026-06-02 결정).**

### 축 1. 데이터 정적화 — ✅ 접근 A(`unstable_cache`) 확정 (PoC 7)

동적 호출을 ISR static-safe하게 만들어 static generate가 데이터를 HTML에 박고 정적 캐시하게 한다.

- **확정 방식(A)**: 각 동적 호출을 `unstable_cache(fn, [keyParts], { revalidate: 3600, tags: [`symbol:${SYMBOL}`] })` 래퍼로 감싼다(legacy data cache — `cacheComponents` 없이 동작).
- **PoC 결론**: 축 0(root layout cookies 제거)을 먼저 적용한 뒤 redis(`@upstash` no-store) 호출을 `unstable_cache`로 감싸면 **`DYNAMIC_SERVER_USAGE` 0 + 정적 ○**로 확인됐다(PoC 7). 즉 `unstable_cache`는 redis no-store fetch를 ISR static-safe하게 만든다 — **단, 축 0이 선결된 경우에만**. (축 0 없이는 어떤 정적화도 무력했다 — PoC 1~4.)
- 대안 B(source-direct `fetch(url, { next: { revalidate } })`)는 **불필요**(A 확정). 단 호출부는 정적화 헬퍼로 캡슐화해 내부 방식 변경에 무관하게 둔다.

### 축 2. FactLayer SSR 분리 (CSR bailout 해결)

`timeframe`(useSearchParams)을 FactLayer에서 떼어낸다.

- **FactLayer**(`TechnicalFactsSummary` + 분석 fact 텍스트): page RSC에서 **default-tf bars(정적화)** 로 **서버 렌더 → SSR HTML**. SEO 텍스트가 크롤러에 보인다.
- **인터랙티브**(timeframe 변경·차트 시각화·재분석 트리거): `ChartContent`(클라, useSearchParams) 유지.
- 대상: page(차트), overall — `useSearchParams` 사용처. fear-greed/options/fundamental/news는 CSR bailout이 없어 **데이터 정적화만으로 SSR** 된다.
- 원칙: FactLayer는 timeframe·검색 파라미터·쿠키 등 요청별 동적 입력에 의존하지 않는 default 뷰만 렌더한다(그래야 static generate 가능 + 종목당 캐시).

### 축 3. ISR 활성화 + SEO 무손상

- `generateStaticParams=[]` + `revalidate=3600`(리터럴) 유지. 축0·1·2로 static generate가 성공 → `500`/`DYNAMIC_SERVER_USAGE`/동적전환 제거.
- SEO 무손상 필수 조건:
  - `symbol-metadata.test`(canonical 회귀 가드 — `[SYMBOL]` placeholder 누출 검증) 통과.
  - 실측: `prod build && start` → `/AAPL` 200 + SSR HTML에 FactLayer 텍스트 + canonical이 실제 ticker.

## PoC 실측 결과 (Phase 0, 완료)

prod `build && start`(E2E_TEST 없이) 기준. ƒ = Dynamic(매 요청 렌더), ○/● = 정적 캐시(ISR).

| PoC | 변경 | 결과 |
|---|---|---|
| 1 | `unstable_cache(getBarsAction)` 만 적용 (root layout 유지) | `ƒ` — 여전히 dynamic |
| 2 | `unstable_cache(순수 함수)` (root layout 유지) | `ƒ` |
| 3 | source-direct `fetch(next.revalidate)` (root layout 유지) | `ƒ` |
| 4 | **데이터 fetch 전혀 없는 빈 페이지** (root layout 유지) | `ƒ` — `/terms`(기존)도 `ƒ` ← **결정적 단서: 원인이 페이지가 아니라 root layout** |
| 5/6 | **root layout `cookies()` 제거** | `poc-isr`/`privacy`/`terms` 전부 `○` — ISR 동작(revalidate 표기) |
| 7 | root layout cookies 제거 + redis bars `unstable_cache` | `○` + **`DYNAMIC_SERVER_USAGE` 0** ← 축 1(A) 실증 |

**결론**: ① root layout `cookies()`(AuthSessionHeader)가 1차 ISR 차단 원인 → 축 0으로 제거. ② 축 0 선결 시 `unstable_cache`(접근 A)가 redis를 정적화 → 축 1 확정. PoC 디렉터리(`poc-isr`)는 정리 완료.

## Phase (끝까지)

### Phase 0 — 인프라 (PoC 부분 완료)
1. ✅ **PoC(실측, 완료)**: 위 표. 축 0 발견 + 접근 A 확정.
2. **축 0 구현**: AuthSessionHeader 클라이언트화(root layout cookies 제거) — ISR 차단 해제. **모든 후속 작업의 전제.**
3. **정적화 헬퍼**: 접근 A(`unstable_cache`)를 `entities`의 캐시 래퍼로 캡슐화(revalidate/tag 규약 포함).
4. **FactLayer 서버 분리 패턴**: `TechnicalFactsSummary`를 `useSearchParams` 밖 서버 렌더로 올리는 컴포넌트 경계 재배치 패턴 확립(default-tf bars 정적화 사용).

### Phase 1 — 차트 page (대표, 패턴 확립)
`app/[symbol]/page.tsx` + `layout.tsx` + `widgets/symbol-page`:
- assetInfo/bars/peek/skillCounts 정적화.
- FactLayer를 SSR로 분리(default-tf), ChartContent는 클라 유지.
- 실측(200 + FactLayer HTML + ISR HIT) + Happy/Worst 테스트.

### Phase 2 — 나머지 5라우트 (의존 단순 순)
2a. **overall** — assetInfo/peekOverall/bars 정적화 + 종합 fact SSR 분리(tf).
2b. **fear-greed** — assetInfo/bars 정적화(CSR bailout 없음).
2c. **options** — assetInfo/hasOptions/snapshot 정적화.
2d. **fundamental** — assetInfo + profile/metrics/ratios/peers/growth/health/future 정적화. 서버 섹션(이미 Suspense SSR)이라 데이터 정적화 위주.
2e. **news** — assetInfo/newsList/earnings/grades 정적화. `newsListJsonLd`(SEO 구조화) + 뉴스 요약 SSR.

### Phase 3 — SEO 감사 (구현 후)
`seo-audit` 스킬로 작업된 6라우트 전체 SEO를 감사하고 발견된 이슈를 수정한다. FactLayer SSR 전환으로 SEO 표면(크롤 가능 콘텐츠·h1 위계·구조화 데이터·메타/canonical)이 바뀌었으므로 종합 점검이 필요하다. 감사 결과 수정도 Happy/Worst 테스트 + 실측으로 검증한다.

### Phase 4 — 문서화 (구현 후)
ISR 설계를 프로젝트 문서에 반영한다:
- `src/app/CLAUDE.md`의 ISR/Route Segment Config 섹션 — **(축 0) root layout(및 모든 공유 셸)에서 `cookies()`/`headers()`를 직접 호출하면 PPR-off 상태에서 전 라우트가 dynamic으로 강제돼 ISR이 깨진다 → 인증 셸은 클라이언트화(hint 쿠키 `document.cookie` + `currentUserAction`)** 규약, `[symbol]` ISR이 redis 등 dynamic data와 충돌하지 않으려면 정적화 래퍼(축 1)를 거쳐야 한다는 규약, FactLayer를 `useSearchParams` 밖 서버 컴포넌트로 두는 패턴(축 2), "빌드 `●` 표시 ≠ 런타임 동작 — 런타임 `DYNAMIC_SERVER_USAGE` 확인" 교훈을 추가.
- 필요 시 `docs/ARCHITECTURE.md` 등 관련 문서에 ISR 데이터 흐름 반영.

각 Phase는 독립적으로 동작·실측·테스트 통과한다.

## 라우트별 작업 표

| 라우트 | 정적화 대상 | SSR SEO 콘텐츠 | CSR bailout 분리 |
|---|---|---|---|
| page | assetInfo, bars, peek, skillCounts | `TechnicalFactsSummary`(bars), 분석 fact(peek) | FactLayer를 tf 밖 서버로 |
| overall | assetInfo, peekOverall, bars | 종합 fact | 동상(tf 분리) |
| fear-greed | assetInfo, bars | FactLayer | 불필요 |
| options | assetInfo, hasOptions, snapshot | 옵션 요약 fact | 불필요 |
| fundamental | assetInfo, profile, metrics, ratios, peers, growth, health, future | 서버 섹션(이미 SSR) | 불필요 |
| news | assetInfo, newsList, earnings, grades | `newsListJsonLd` + 뉴스 요약 | 불필요 |

> 위 표의 모든 라우트는 **축 0(root layout cookies 제거)을 공유 전제**로 한다. 축 0 없이는 어떤 라우트도 정적화되지 않는다.

### 라우트별 추가 dynamic API 블로커 (정적화 외 제거 대상)

데이터 정적화(축 1)와 별개로, 라우트 본문이 직접 호출하는 dynamic API는 ISR을 깨뜨리므로 제거해야 한다(축 0의 `cookies()`와 동일 메커니즘).

- **news (`news/page.tsx`)**: 본문이 `await headers()`(isBot 판정 → `skipAnalysis`)를 호출해 `waitUntil(ensureNewsCardsAnalyzedAction(...))`로 백그라운드 분석을 트리거한다. `headers()`는 라우트를 dynamic으로 강제한다. → **분석 트리거를 클라이언트로 이전**한다: `NewsAiSummary`(이미 `'use client'`)가 마운트 시 `ensureNewsCardsAnalyzedAction`을 호출(bot은 JS 미실행이라 자연히 skip — chart의 `useAnalysis` 패턴과 동일). 본문의 `headers()`/`isBot`/`waitUntil`을 제거. `getNewsList`는 본문(JSON-LD용)과 `NewsListSection`에서 중복 호출되므로 정적화 래퍼로 dedupe.
  - **news 신선도 — on-demand 무효화 확정(2026-06-02 결정)**: news는 6라우트 중 신선도가 가장 민감하므로 revalidate 1h만으로는 부족하다. `ensureNewsCardsAnalyzedAction`이 fresh 뉴스를 DB upsert한 직후(`markFetched(symbol)` 뒤)에 **`revalidateTag('news:${symbol}')`** 를 호출해 해당 종목 news ISR 캐시를 즉시 무효화한다 → 새 뉴스가 들어오면 다음 요청부터 fresh. 이를 위해 news 데이터의 정적화 래퍼는 `symbol:${symbol}` 외에 **`news:${symbol}` 그룹 태그**를 추가로 단다(news만 골라 무효화 — bars/peek/profile 캐시는 보존). 첫 방문자가 ingestion+무효화를 트리거하고 후속 방문/크롤이 fresh를 받는 stale-while-revalidate 패턴. (현재 dynamic도 DB 상태를 보여줄 뿐 FMP 대비 ingestion 지연이 있어, ISR 전환이 신선도를 유의미하게 악화시키지 않는다.)
- 나머지 5라우트(chart/overall/options/fear-greed/fundamental)는 본문에 `headers()`/`cookies()`/`searchParams` 직접 호출이 없다(전수 확인). chart·overall의 `useSearchParams`는 클라 위젯(`useTimeframeChange`/`useTimeframeFromUrl`) 내부이며 축 2(FactLayer 서버 분리)로 처리.
- **fundamental notFound 가드**: `getProfile`(정적화 대상) 결과의 null이 notFound를 결정한다(assetInfo가 아님). 정적화 후에도 이 분기를 유지한다.

## 테스트 전략

- **Happy Path**: 정적화 cache hit → FactLayer/섹션 SSR 정상 렌더, canonical 정상.
- **Worst Case**:
  - 정적화 source 실패/빈 결과 → degrade(FactLayer 빈/null 시 렌더 안 깨짐, 페이지는 200).
  - bars 없음 → `buildTechnicalFacts` null → FactLayer 미렌더(크래시 없음).
  - peek MISS → 분석 fact 폴백.
  - 인프라 실패(getAssetInfo) → PR #545 `getAssetInfoResilient` 경로와 정합(인프라 실패 fallback + degraded noindex; `DYNAMIC_SERVER_USAGE`는 rethrow).
  - **축 0**: hint 쿠키 있음 but 실제 세션 만료(`currentUserAction`=null) → skeleton 추정 후 게스트로 정정(잘못된 추정이 권한 노출로 이어지지 않음). hint 쿠키 없음 but 세션 유효 → 게스트 추정 후 로그인 상태로 교체.
- **Integration(vitest)**: 각 page RSC를 호출해 반환 트리에 FactLayer/SSR 섹션이 정적화 데이터로 렌더되는지(=SSR HTML에 박히는지) 검증. 축 0은 `AuthSessionHeaderClient`의 hint/실제상태 분기 단위 테스트.
- **E2E**: prod build로 `[symbol]` 200 + SSR HTML에 FactLayer 텍스트 존재 + `x-nextjs-cache` 정적 HIT + 23 spec 통과 + 속도 회복(이전 `DYNAMIC_SERVER_USAGE` 폭주 제거) + 로그인/게스트 헤더가 클라이언트화 후에도 정상.
- **커버리지**: 변경 파일 90%+.

## 실측 검증 (필수 통과 조건)

```
rm -rf .next && yarn build && yarn start
# 축 0 검증: build output에서 root layout이 전 라우트를 ƒ로 만들지 않는지 — 정적 라우트(/terms 등)가 ○인지
curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/AAPL   # 200
grep -c "DYNAMIC_SERVER_USAGE" <start log>                          # 0
curl -s http://localhost:3000/AAPL | grep "기술적 지표 요약\|현재가"   # FactLayer 존재
curl -sI http://localhost:3000/AAPL | grep -i x-nextjs-cache         # ISR 캐시
```

## 미해결 / 구현 시 결정

- ✅ Phase 0 PoC — **완료**. 축 0(root layout cookies 제거) 발견 + 접근 A(`unstable_cache`) 확정.
- ✅ 축 0 보안 검증 — **완료**. hint 쿠키 값 `'1'`(PII 없음, 이미 non-httpOnly), 실제 인증은 httpOnly 세션+DB. 클라이언트화는 보안 표면을 넓히지 않음.
- FactLayer 서버 분리 시 컴포넌트 경계(어디까지 서버 vs 클라) 정밀 배치 — Phase 1에서 확정 후 Phase 2에 적용.
- ✅ PR #545(`getAssetInfoResilient`) — **머지됨(master)**. 본 작업은 master 기반으로 rebase 후 진행한다(`feat/symbol-isr-seo`를 master에 rebase).
- AuthSessionHeader 클라이언트화 후 기존 `AuthSessionHeader`(서버) 파일/`getCurrentUser` 서버 경로의 잔여 소비자 정리 — Phase 0 축 0 task에서 확인.
