# 메인 리팩토링 (Vercel 제거 + P0/P1/P2) 구현 계획 — PR1~8

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vercel 런타임 의존성을 제거하고 감사로 도출된 P0/P1/P2 중복·배럴 위생 문제를 순수 리팩토링으로 해소한다.

**Architecture:** 파일 disjoint한 8개 독립 PR. Batch1(PR1·PR2) 먼저 머지 → Batch2(PR3~7) 병렬 워크트리 → Batch3(PR8). 모든 변경은 behavior-preserving이며 테스트 단언을 바꾸지 않는다(import 경로 기계적 변경만 허용).

**Tech Stack:** Next.js 16(App Router, standalone), React 19, TypeScript, vitest, Playwright, Drizzle, `@y0ngha/siglens-core`.

**Spec:** `docs/superpowers/specs/2026-06-25-vercel-removal-and-refactor-audit-design.md`

---

## 공통 게이트 (모든 PR 종료 조건 — 매 PR 마지막에 반드시 수행)

- [ ] **G1. 전체 테스트**: `yarn test` → 전부 green. (시간 의존 flaky 2곳 — `CachedMarketDataProvider`, `fmpMarketNewsClient` — 실패 시 master 단독 재현으로 본 변경과 무관함을 확인)
- [ ] **G2. 빌드**: `yarn build > /tmp/build.log 2>&1; echo "EXIT=$?"` → `EXIT=0` (파이프로 exit code 가리지 말 것)
- [ ] **G3. 린트**: `yarn lint` → 0 error
- [ ] **G4. pre-push 게이트**: push 시 full build+format:check+e2e 통과. `--no-verify` 금지.
- [ ] **G5. review-agent(Opus 4.8) → PR 자동 리뷰 반영 → git-agent 머지(일반 merge)**

> 워크트리 셋업: `git worktree add`로 PR별 디렉토리 분리, node_modules는 `cp -al` 하드링크(symlink 금지) + 잔여 `node_modules/node_modules` 제거. core 버전 핀 불일치 시 `rm -rf node_modules && yarn install`.

---

# Batch 1

## PR1 — Vercel 의존성 완전 제거

**Files:**
- Modify: `src/entities/ticker/lib/backgroundTask.ts`
- Modify: `src/entities/ticker/lib/getAssetInfo.ts:1,262,270`
- Modify: `src/entities/ticker/actions/searchTickerAction.ts:3,78`
- Modify: `src/entities/analysis/actions/{pollAnalysisAction,pollBriefingAction,submitAnalysisAction,submitOverallAnalysisAction,submitFinancialsAnalysisAction,submitFundamentalAnalysisAction,submitCongressTrendAction}.ts`
- Modify: `src/entities/options-chain/actions/optionsActions.ts`
- Modify: `src/entities/news-article/actions/submitNewsAnalysisAction.ts`
- Modify: `src/entities/market-news/actions/submitMarketNewsDigestAction.ts`
- Modify: `src/app/layout.tsx:6,164`
- Modify: `package.json`
- Delete: `vercel.json`
- Modify (comment only): `src/shared/db/isNeonTransientError.ts`, `.env.example:45`
- Test: 아래 mock 제거 대상 16개

- [ ] **Step 1: `fireAndForget`을 명시적 소유자로 변경**

`src/entities/ticker/lib/backgroundTask.ts`의 함수 본문을 교체:

```ts
/** Register a background promise with the runtime. */
export function fireAndForget(
    promise: Promise<unknown>,
    options?: BackgroundTaskOptions
): void {
    // long-lived 서버에서는 floating promise가 이벤트 루프에서 완료된다.
    // rejection이 unhandledRejection으로 새지 않도록 catch 안전망을 단다.
    // waitUntil은 향후 AWS graceful-drain 훅 주입 자리로 optional 유지.
    if (options?.waitUntil) {
        options.waitUntil(promise);
        return;
    }
    void promise.catch(() => {});
}
```

`BackgroundTaskOptions.waitUntil?: WaitUntil` 타입과 `import type { WaitUntil }`는 **유지**. JSDoc의 "On Vercel, pass waitUntil…" 문구만 "런타임이 graceful-drain 훅을 제공하면 주입"으로 갱신.

- [ ] **Step 2: `getAssetInfo.ts` 직접 호출 치환**

1행 `import { waitUntil } from '@vercel/functions';` 제거. `fireAndForget`은 동일 디렉토리 `./backgroundTask`에서 import 추가.
262·270행의 `waitUntil(...)` → `fireAndForget(...)`로 치환(인자 그대로, `.catch(...)`는 호출부에 이미 있으므로 유지):

```ts
if (koreanName) {
    fireAndForget(
        persistTranslation(upper, fmpSymbol, name, koreanName, cache).catch(
            e => console.warn('[getAssetInfo] persist failed', e)
        )
    );
    return info;
}

fireAndForget(
    translateAndPersist(
        upper,
        { symbol: fmpSymbol, name, exchange, exchangeFullName },
        cache
    ).catch(e =>
        console.warn('[getAssetInfo] background translation failed', e)
    )
);
```

- [ ] **Step 3: `searchTickerAction.ts` 전달 인자 제거**

3행 `import { waitUntil } from '@vercel/functions';` 제거. 78행 `return searchTicker(trimmed, { waitUntil });` → `return searchTicker(trimmed);`.
(주의: `searchTicker`(siglens lib)가 옵션 없이도 동작하는지 — 라이브 코드 확인. 내부에서 `fireAndForget(opts)`를 호출하므로 옵션 부재 시 catch-net 경로로 동작. 만약 `searchTicker` 시그니처가 옵션 필수면 optional로 완화하되 기본 동작 동일.)

- [ ] **Step 4: core-위임 액션 7+3개에서 `waitUntil` 제거**

각 파일에서 (a) `import { waitUntil } from '@vercel/functions';` 제거, (b) core 함수에 넘기는 options 객체에서 `waitUntil,` 한 줄 제거. 예 — `submitAnalysisAction.ts`(3행 import; 77·101행 options의 `waitUntil,`):

```ts
// before: submitAnalysis(symbol, companyName, timeframe, force, fmpSymbol, { waitUntil, modelId, ... })
// after:  submitAnalysis(symbol, companyName, timeframe, force, fmpSymbol, { modelId, ... })
```

동일 패턴 적용: `pollAnalysisAction(:9)`, `pollBriefingAction(:9)`, `submitOverallAnalysisAction(:163)`, `submitFinancialsAnalysisAction(:60)`, `submitFundamentalAnalysisAction(:54)`, `submitCongressTrendAction(:59)`, `optionsActions(:83)`, `submitNewsAnalysisAction(:78)`, `submitMarketNewsDigestAction(:87)`. core 측 `WaitUntil`은 optional 타입이므로 부재 시 floating promise로 완료(동작 동일).

- [ ] **Step 5: Analytics 제거**

`src/app/layout.tsx` 6행 `import { Analytics } from '@vercel/analytics/next';`와 164행 `<Analytics />` 제거.

- [ ] **Step 6: 설정·의존성 제거**

`vercel.json` 삭제. `package.json`에서 `@vercel/functions`·`@vercel/analytics` 의존성 줄 제거 후 `yarn install`.

- [ ] **Step 7: stale 주석 갱신(동작 변경 없음)**

`src/shared/db/isNeonTransientError.ts`의 "Vercel 10s serverless" 가정 주석 → "long-lived 서버: 함수 상한 없음" 취지로(타임아웃/retry 값은 변경 금지). `.env.example:45` "Vercel Cron" → "외부 cron caller (예: EventBridge)".

- [ ] **Step 8: `@vercel/functions` mock 제거 + 단언 치환**

대상: `src/app/[symbol]/__tests__/symbol-metadata.test.ts`, `src/__tests__/worst-case/{pollAnalysisRedisError,aiSlowResponse,cacheWriteFailure,assetInfoDegradation}.test.ts`, `src/entities/analysis/__tests__/{pollAnalysisAction,pollBriefingAction,submitAnalysisAction,submitOverallAnalysisAction,submitFinancialsAnalysisAction,submitFundamentalAnalysisAction,submitCongressTrendAction}.test.ts`, `src/entities/options-chain/__tests__/optionsActions.test.ts`, `src/entities/news-article/__tests__/submitNewsAnalysisAction.test.ts`, `src/entities/ticker/__tests__/actions/searchTickerAction.test.ts`.
각 파일에서 `vi.mock('@vercel/functions', …)` 제거. `waitUntil` 호출 여부를 단언하던 케이스는 **백그라운드 작업의 관측 결과**(persist/캐시 쓰기/enqueue mock 호출)로 단언 치환. **이것이 spec의 "단언 불변" 유일 예외** — mock 대상 모듈이 삭제되었기 때문. PR 본문에 사유 명시.

- [ ] **Step 9: 게이트 G1~G5 수행 후 커밋/PR**

```bash
git add -A && git commit -m "refactor(infra): remove Vercel runtime deps (waitUntil seam, analytics, vercel.json)"
```

---

## PR2 — P0 배럴 / server-only 일관성

**Files:**
- Modify: `src/entities/session/index.ts:39` (+ 3 server action import sites)
- Modify: `src/entities/api-key/index.ts:1` (+ server import sites)
- Modify: `src/entities/inquiry/index.ts:1` (+ server import sites)
- Modify: `src/entities/news-article/api.ts:1`, `src/entities/news-article/index.ts:1`
- Modify: `src/shared/db/schema.ts`, `src/shared/db/types.ts` (add `import 'server-only'`)
- Modify (optional): `src/entities/market-news/index.ts`, `src/entities/notice/index.ts`
- Test: import 경로 갱신 대상(아래)

- [ ] **Step 1: shared/db server-only 가드 추가**

`src/shared/db/schema.ts`와 `src/shared/db/types.ts` 최상단에 `import 'server-only';` 추가. → 빌드 후 클라이언트 번들이 이들을 value로 끌어오면 fail-fast.

- [ ] **Step 2: 빌드로 누수 지점 노출**

`yarn build > /tmp/b.log 2>&1; echo EXIT=$?`. server-only 위반이 뜨면 그 지점이 정리 대상. (현재 type-only consumer는 통과)

- [ ] **Step 3: session bcrypt 배럴 제외**

`src/entities/session/index.ts:39`의 `export { bcryptPasswordHasher, bcryptPasswordVerifier } from './lib/bcrypt';` 제거. 3개 server action — `features/auth-login/actions/loginAction.ts`, `features/auth-signup/actions/registerAction.ts`, `features/auth-password-reset/actions/confirmPasswordResetAction.ts` — 의 import를 `@/entities/session` → `@/entities/session/lib/bcrypt`로 변경.

- [ ] **Step 4: api-key repo 배럴 제외**

`src/entities/api-key/index.ts:1`의 `DrizzleUserApiKeyRepository`·`LlmApiKeyDecryptionFailedError` re-export 제거(타입·client-safe const는 유지). server consumer를 `@/entities/api-key/api`로 deep import.

- [ ] **Step 5: inquiry repo 배럴 제외**

`src/entities/inquiry/index.ts`의 `DrizzleContactRepository` re-export 제거. server consumer를 `@/entities/inquiry/api`로.

- [ ] **Step 6: news-article server-only + 배럴 제외**

`src/entities/news-article/api.ts:1`에 `import 'server-only';` 추가. `src/entities/news-article/index.ts:1`의 `./api` value re-export(`DrizzleNewsRepository`, `getNewsList`) 제거(타입 `NewsRow`는 `export type`로 유지 가능). server consumer(`app/[symbol]/news/page.tsx`, `app/[symbol]/overall/page.tsx`, 관련 actions)를 `@/entities/news-article/api`로.

- [ ] **Step 7: (선택) market-news/notice 동반 정리**

현재 type-only라 안전하나 동형 — 시간 허용 시 동일 패턴 적용. 아니면 spec에 후속으로 남김.

- [ ] **Step 8: 테스트 import 경로 갱신(단언 불변)**

`entities/news-article/__tests__/{api,submitNewsAnalysisAction,ensureNewsCardsAnalyzedAction,lib/getNewsList}.test.ts`, api-key·inquiry 관련 테스트에서 barrel import를 deep(`/api`)로 **경로만** 변경. 단언은 그대로. (`session/__tests__/lib/bcrypt.test.ts`는 이미 deep)

- [ ] **Step 9: 게이트 G1~G5 + 커밋**

```bash
git commit -am "refactor(arch): exclude server-only repositories from client-reachable barrels (P0)"
```

---

# Batch 2 (PR3~7 — 파일 disjoint, 병렬 워크트리)

## PR3 — app SEO/JSON-LD 헬퍼 추출

**Files:**
- Modify: `src/shared/lib/seo.ts` (헬퍼 2개 추가)
- Modify: `src/app/[symbol]/page.tsx`, `src/app/[symbol]/{overall,news,fundamental,options,fear-greed,congress,financials}/page.tsx`
- Test: `src/shared/lib/__tests__/seo.test.ts`(헬퍼 단위테스트 추가), 각 page metadata 테스트(단언 불변)

- [ ] **Step 1: `buildSymbolWebPageJsonLd` 추가**

`src/shared/lib/seo.ts`의 `buildBreadcrumbJsonLd` 옆에:

```ts
export function buildSymbolWebPageJsonLd(params: {
    url: string;
    name: string;
    description: string;
    about?: object;
}): object {
    const { url, name, description, about } = params;
    return {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        name,
        description,
        url,
        inLanguage: 'ko',
        isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}#website` },
        ...(about && { about }),
    };
}
```

- [ ] **Step 2: `symbolMetadataFromSeo` 추가**

```ts
export function symbolMetadataFromSeo(seo: SymbolSeoContent): Metadata {
    const { title, fullTitle, description, url, keywords } = seo;
    return {
        title,
        description,
        keywords,
        alternates: { canonical: url },
        openGraph: { type: 'website', siteName: SITE_NAME, title: fullTitle, description, url, locale: 'ko_KR' },
        twitter: { card: 'summary_large_image', title: fullTitle, description },
    };
}
```
(`SymbolSeoContent`/`SITE_NAME`/`SITE_URL`은 seo.ts 기존 export — 실제 필드명 라이브 확인 후 정확히 맞출 것.)

- [ ] **Step 3: 헬퍼 단위 테스트(신규)**

`seo.test.ts`에 두 헬퍼의 출력 객체 형태를 단언하는 테스트 추가(기존 페이지 동작과 동일 형태 보장).

- [ ] **Step 4: 8개 페이지의 인라인 블록을 호출로 치환**

각 페이지의 JSON-LD 인라인 객체(예 `overall/page.tsx:198-208`)를 `const jsonLd = buildSymbolWebPageJsonLd({ url, name: fullTitle, description, about: aboutNode });`로. `generateMetadata`의 return 블록을 `return symbolMetadataFromSeo(seoContent);`로. **options만**: `return { ...symbolMetadataFromSeo(seo), ...(hasOptions ? {} : { robots }) };`. `NOINDEX_SYMBOL_METADATA` early-return 경로는 손대지 않음.

- [ ] **Step 5: 게이트 G1~G5 + 커밋** — `refactor(seo): extract buildSymbolWebPageJsonLd/symbolMetadataFromSeo (P1)`

---

## PR4 — DST/ET-offset 통합 ⚠️ 경계 테스트 선행

**Files:**
- Test FIRST: `src/shared/lib/__tests__/eastern.test.ts` (경계일 동등성 케이스 추가)
- Modify: `src/shared/lib/eastern.ts`(canonical), `src/shared/lib/etTimeUtils.ts:19-73`, `src/shared/api/fmp/FmpMarketProvider.ts:36-54`

- [ ] **Step 1: 경계일 동등성 실패 테스트 작성(TDD)**

3월 2nd Sunday·11월 1st Sunday의 01:59/02:00/03:00(local) 시각에 대해 세 함수(`eastern.getEasternOffsetHours`, `etTimeUtils.getEtOffset`, `FmpMarketProvider.getEtOffsetHours`)의 현재 출력을 픽스하는 케이스 추가. 현재 동작을 그대로 캡처(회귀 가드).

- [ ] **Step 2: 테스트 실행 → 현재 동작 캡처(green이어야 정상)**

`yarn test eastern` — 현재 구현 기준 통과하는 캡처 테스트. (불일치 시 실제 동작을 정확히 반영하도록 케이스 수정 — 추측 금지, 실측)

- [ ] **Step 3: canonical 단일화**

`eastern.ts`에 `nthSundayDay(year,month,nth)` primitive + hour-aware offset 함수를 단일 소스로. `etTimeUtils.getEtOffset`은 이를 위임해 `'-04:00'|'-05:00'` 파생, `FmpMarketProvider.getEtOffsetHours`는 위임해 `-4|-5` 파생(`fmpIntradayDateToUtcSeconds`의 hour 전달). 로컬 상수(`EDT/EST_OFFSET_HOURS`, month/Sunday)는 eastern.ts로 일원화.

- [ ] **Step 4: Step1 캡처 테스트 + 전체 통과 확인**

`yarn test eastern etTimeUtils FmpMarketProvider` → 경계·비경계 모두 캡처값과 동일.

- [ ] **Step 5: 게이트 G1~G5 + 커밋** — `refactor(shared): unify DST/ET-offset into eastern.ts (P1)`

---

## PR5 — 옵션 차트 dedup

**Files:**
- Create: `src/widgets/options/lib/strikeChartGeometry.ts`, `src/widgets/options/ui/StrikeBarTooltip.tsx`, `src/widgets/options/ui/StrikeBarSrTable.tsx`, `src/widgets/options/hooks/useStrikeBarChart.ts`
- Modify: `src/widgets/options/OpenInterestChart.tsx`, `src/widgets/options/StrikeVolumeChart.tsx`

- [ ] **Step 1: pure geometry 추출**

`slotWidth/barCenterX/barPixelHeight`(두 파일 동일)를 `strikeChartGeometry.ts`로 **verbatim 이동**, export. 레이아웃 상수는 의도된 per-chart 튜너빌리티이므로 각 컴포넌트에 유지(geometry 함수는 상수를 인자로 받도록).

- [ ] **Step 2: 포인터 핸들러 훅 추출**

`handlePointerEnter/Move/Leave` + `cachedRectRef` 패턴(두 파일 동일)을 `useStrikeBarChart`로. 반환: 핸들러 + 툴팁 상태. DOM/testid는 각 컴포넌트가 주입.

- [ ] **Step 3: 툴팁/sr-only 컴포넌트 추출**

`StrikeBarTooltip`(hidden div + `--tooltip-x/y/min-w`), `StrikeBarSrTable`(sr-only table). id/testid(`volume-chart-tooltip` vs OI id)는 props로 주입해 **동일 DOM 유지**.

- [ ] **Step 4: 두 컴포넌트에서 적용**

OI는 Max Pain 라인·Call-above/Put-below 렌더 유지. 추출 후 렌더 트리·class·testid 불변.

- [ ] **Step 5: 게이트 — 특히 `__tests__/{OpenInterestChart,StrikeVolumeChart}.test.tsx` + util 테스트(`computeTooltipPos`/`pickLabelIndices`/`aggregateStrikeVolume`) green 확인 후 커밋** — `refactor(options): extract shared strike-bar chart behavior (P1)`

---

## PR6 — 뉴스카드 셸 통합 ⚠️ 라벨/클래스 맵 주입 유지

**Files:**
- Create: 공유 `NewsCard` 셸(`src/widgets/news/ui/NewsCardShell.tsx` 또는 `src/shared/ui/news/`), `src/shared/lib/timeFormat.ts`에 `formatNewsPublishedAt` 추가
- Modify: `src/widgets/news/sections/NewsList.tsx`, `src/widgets/market-news/MarketNewsCard.tsx`, `src/widgets/news/constants.ts`, `src/widgets/market-news/constants.ts`

- [ ] **Step 1: KST 포매터 단일화**

두 동일 `Intl.DateTimeFormat`(`NEWS_PUBLISHED_AT_FORMATTER`/`PUBLISHED_AT_FORMATTER`)을 `shared/lib/timeFormat.ts`의 `formatNewsPublishedAt(iso): string`로. **export 이름 유지/재export**하여 `NewsList.test.tsx:99-103`의 `formatNewsPublishedAt(...)` 단언 보존.

- [ ] **Step 2: 공유 셸 추출**

카드 셸(article 래퍼, 제목, pending/skeleton, badge-row, 본문, "원문 보기" 링크)을 `NewsCardShell`로. **라벨/클래스 맵(`SENTIMENT_LABEL/CLASS`, `IMPACT_LABEL/CLASS`)과 ticker-chip 슬롯은 props/children으로 주입** — 각 surface가 자기 맵·testid 전달. news=`가격`/`text-chart-bullish`, market-news=`주가`/`text-ui-success-text` **절대 collapse 금지**.

- [ ] **Step 3: 폴링 상수 정리**

byte-identical re-export(`news/constants.ts`·`market-news/constants.ts`)를 shared config alias로 정리(소비 hook import 갱신).

- [ ] **Step 4: 게이트 — `NewsList.test.tsx`(가격/보통 라벨), `MarketNewsCard.test.tsx`(공유 클래스) green 확인 후 커밋** — `refactor(news): unify news card shell, inject label/class maps (P1)`

---

## PR7 — FMP Cached/Fake/factory 제네릭

**Files:**
- Create: `src/shared/api/fmp/symKey.ts`, `src/shared/api/fmp/cachedListWithLimit.ts`, `src/shared/api/fmp/createE2EGatedSingleton.ts`
- Modify: `CachedFundamentalProvider.ts`, `CachedFinancialStatementsProvider.ts`, `CachedCongressTradesProvider.ts`, `get{Fundamental,FinancialStatements,CongressTrades}DataProvider.ts`, `market/getMarketDataProvider.ts`, `economy/getEconomyProvider.ts`

- [ ] **Step 1: `symKey` 추출** — `export const sym = (s: string): string => s.toUpperCase();` 단일 모듈. 3 provider import 갱신.

- [ ] **Step 2: `cachedListWithLimit` 추출**

```ts
export async function cachedListWithLimit<T>(
    key: string, ttl: number, max: number,
    fetch: () => Promise<T[]>,
    opts?: { onError?: 'empty' | 'rethrow'; logPrefix?: string }
): Promise<T[]> { /* getOrSetCache(key,ttl,fetch).then(r => r.slice(0,max)) + onError 처리 */ }
```
financials=`onError:'empty'`(로그+`[]`), congress=`onError:'rethrow'`. **로그 prefix·키 포맷·slice 동작을 기존과 byte-identical** 유지.

- [ ] **Step 3: `createE2EGatedSingleton` 추출**

```ts
export function createE2EGatedSingleton<T>(makeReal: () => T, loadFake: () => T): () => T {
    let cached: T | null = null;
    return () => {
        if (cached) return cached;
        cached = isE2E() ? loadFake() : makeReal();
        return cached;
    };
}
```
⚠️ `require('./Fake…')` **리터럴 경로는 콜사이트(loadFake 클로저)에 유지**(Turbopack dead-code). `getEconomyProvider`의 force-empty 미캐시 분기는 bespoke로 남김(제네릭 미적용).

- [ ] **Step 4: 게이트 — `get*Provider.test.ts`×5, `Cached*Provider` 테스트 green 후 커밋** — `refactor(fmp): generic sym/cachedListWithLimit/E2E-gated singleton (P1)`

---

# Batch 3

## PR8 — P2 cleanup 묶음

**Files:** (서로 disjoint — 항목별 독립 커밋 권장)

- [ ] **Step 1: StockChart 바인딩 레지스트리화** — `src/widgets/chart/StockChart.tsx:500-703`의 35줄 수동 `indicatorBindings`를 `INDICATOR_REGISTRY` map + 오버레이/period override map으로 생성. ⚠️ `StockChart.test.tsx:438`의 `data-count="34"`·34-key 순서를 **레지스트리 순서로 정확 재현**. 23 pane-hook 호출은 유지.
- [ ] **Step 2: useAnalysis restart 헬퍼** — `src/widgets/symbol-page/hooks/useAnalysis.ts:393-450`의 cancel-reset-mutate 3중복을 `useCallback restartAnalysis(modelIdOverride?)`로. effect별 가드는 inline 유지.
- [ ] **Step 3: ChatPanel ModelSelect 분리** — `src/widgets/chat/ChatPanel.tsx`의 인라인 listbox(toggle/keydown/refs/markup)를 `src/widgets/chat/ModelSelect.tsx`(`{options,selected,onChange,isHydrated}`)로. DOM(`aria-haspopup`,`role="option"`,`aria-selected`,`✓`/`PRO`) 불변.
- [ ] **Step 4: 소형 중복** — `findSpecByApiModelId`(llm-provider anthropic/openai → `lib/utils.ts`), client-IP(chat-message chatAction/getRemainingTokensAction → `lib/getClientIp.ts`), Redis flag 5~6곳 → `shared/cache/createRedisFlag(keyOrFn, ttl)`, `isoDate`→`etDateOf`(economySnapshotCache), `num`/`toFiniteNumber`(fmp → `toFiniteNumber.ts`), dashboard `QuoteHeader`(IndexCard/SignalStockCard).
- [ ] **Step 5: 잉여 re-export/중복 삭제** — `api-key/lib/index.ts`(3 테스트 경로 변경 후 삭제), `oauth-account/lib/revoker.ts:29`, `verifyEmailAction.ts:42`의 중복 `normalizeEmail(email)`→`email`.
- [ ] **Step 6: dead actions.ts ×5 삭제** — `features/{auth-login,auth-signup,auth-logout,auth-email-verification,account-delete}/actions.ts` 삭제. (`auth-oauth/actions.ts`는 사용 중 — 유지). 삭제 전 `grep -rn "from.*features/<slice>/actions'" src` 0건 재확인.
- [ ] **Step 7: 게이트 G1~G5 + 커밋(항목별 또는 묶음)** — `refactor: P2 cleanups (StockChart binding, useAnalysis, ChatPanel, dup helpers, dead barrels)`

---

## 자가 점검 (이 plan ↔ spec 대조)

- spec PR1~8 전 항목이 위 Task로 매핑됨. 누락 없음.
- 스코프 제외(PwaBanner/Kakao/usage 인프라)는 Task에 없음(의도).
- placeholder 없음: 추출형 Task는 "verbatim 이동 + 인터페이스 정의"로 구체화. 라이브 코드 본문을 읽어 정확히 옮기는 것은 추출 refactoring의 본질(추측 아님).
- 후속(Spec-2/3)은 별도 plan 문서.
