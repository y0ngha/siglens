# Vercel 의존성 제거 + 감사 기반 리팩토링 (P0/P1/P2) — 설계

- 작성일: 2026-06-25
- 상태: 설계 승인 대기 → 구현(ISSUE_IMPL_FLOW)
- 관련 spec: `2026-06-25-symbol-page-to-pages-layer-design.md`(Spec-2), `2026-06-25-user-session-merge-design.md`(Spec-3)

## 배경

- siglens는 Vercel → AWS(ALB·ASG·EC2 standalone Next 서버)로 **완전 이전·운영 중**.
- FSD 6-레이어 아키텍처 전면 재정비(baseline 커밋 `4fbcaa16`, PR #492 "FSD final polish", 2026-05-25) 이후 ~1290 커밋이 쌓였고, Opus 4.8 전수 감사(8개 레이어 파티션)로 리팩토링 기회를 수집했다.
- 본 설계는 **순수 리팩토링**만 다룬다. 코드는 운영상 정상이며, 모든 변경은 아래 절대조건을 만족해야 한다.

## 절대조건 (모든 PR 공통)

1. **Behavior-preserving**: 반환값·렌더 DOM·직렬화 출력이 byte-identical. 분기/순서/상수 변경 금지.
2. **테스트 단언 불변**: 테스트의 기댓값(assertion)은 절대 변경하지 않는다. 허용되는 유일한 테스트 수정은 **import 경로 기계적 변경**(barrel→deep)뿐(레포 규약상 테스트 파일 deep-import 허용).
3. **운영 무영향**: ISR/SEO 관측 출력(metadata, revalidate 리터럴, prerender 동작) 불변. AWS 런타임 동작 불변.
4. **PR별 게이트**: `yarn test`(vitest 전체) + `yarn build`(exit code 직접 캡처, 파이프 금지) + `yarn lint` + pre-push(full build+format:check+e2e) 통과.
5. **워크트리 규칙**: `cp -al` 하드링크 node_modules(symlink 금지), 잔여 `node_modules/node_modules` 제거. core 버전 핀 불일치 시 `rm -rf node_modules && yarn install`.
6. **시간 의존 flaky 격리**: `CachedMarketDataProvider`(US_EQUITY 세션 TTL: ET 장중/장외 분기)와 `fmpMarketNewsClient`(7일 lookback 경계 fixture)는 실제 시각 미mock으로 master에서도 간헐 실패한다. 본 리팩토링과 무관한 실패는 master 단독 재현 + `TZ=America/New_York date`로 격리하고, 리팩토링 회귀와 혼동하지 않는다.

> **테스트 변경 정책(핵심 제약)**: 리팩토링으로 인해 테스트의 **기댓값(assertion)을 바꾸는 일은 없다.** 코드 추출/이동의 결과로 테스트가 깨진다면 그건 동작이 바뀐 것이므로 **리팩토링이 틀린 것**이다. 테스트 파일에 허용되는 변경은 오직 **import 경로의 기계적 치환**(barrel→deep 등)뿐이다. 유일한 예외는 PR1의 `@vercel/functions` mock 제거(대상 모듈이 삭제되므로 동등 동작 단언으로 치환) — PR 본문에 사유를 명시한다.

## 스코프 제외 (사용자 확인 — 의도된 상태)

- `PwaBanner.tsx`의 `return null`(unmount) — 회귀 아님, 의도. 주석/dead 분기 손대지 않음.
- Kakao OAuth 어댑터(`features/auth-oauth/lib/kakao.ts` + 테스트) — 의도된 parking 유지.
- analysis usage 인프라(`DrizzleUsageRepository`, `usageCounts.ts`, `usage_logs`) — 의도된 휴면(유료티어/사용량제한 ship 대기). 그대로 둔다.

## 실행 구조

도메인별 **병렬 워크트리 + Sonnet sub-agent**, 저위험 우선. 파일 disjoint한 독립 PR 8개. 각 PR: 구현 → 전체 test+build+lint → review-agent → (회귀 없으면) git-agent.

| Batch | PR | 내용 | 위험 |
|---|---|---|---|
| 1 | PR1 | Vercel 제거 | 저 |
| 1 | PR2 | P0 배럴/server-only 일관성 | 저 |
| 2 | PR3 | app SEO/JSON-LD 헬퍼 ×8 | 저 |
| 2 | PR4 | DST/ET-offset 통합 (+경계 테스트 먼저) | 중 ⚠️ |
| 2 | PR5 | 옵션 차트 dedup | 중 |
| 2 | PR6 | 뉴스카드 셸 통합 | 중 ⚠️ |
| 2 | PR7 | FMP Cached/Fake/factory 제네릭 | 중 |
| 3 | PR8 | P2 cleanup 묶음 | 저~중 |

Batch 2는 PR3~7이 파일 disjoint → 워크트리 병렬. Batch 1은 먼저 머지(배럴/server-only가 다른 PR의 import 기반). Batch 3는 Batch 2 머지 후.

---

## PR1 — Vercel 의존성 완전 제거

### A. waitUntil seam (핵심)

`backgroundTask.ts`의 `WaitUntil`/`fireAndForget`/`BackgroundTaskOptions` 추상화는 런타임 무관(`WaitUntil` 타입은 core). **seam은 유지하고 Vercel 주입만 끊는다.**

- `fireAndForget`을 promise의 **명시적 소유자**로 변경: 현재 `options?.waitUntil?.(promise)`(waitUntil 없으면 no-op, promise가 "호출부에서 이미 실행 중"이라는 암묵 가정)를 `void promise.catch(() => {})` 안전망으로 명시화. long-lived 서버에서 floating promise는 이벤트 루프가 완료시킴 → 동작 동일.
- `BackgroundTaskOptions.waitUntil?` **타입은 유지**(향후 AWS graceful-drain 훅 주입 자리) → use-case 시그니처 변경 최소화.
- 11개 action에서 `import { waitUntil } from '@vercel/functions'` + `waitUntil` 인자 전달 제거:
  `entities/ticker/lib/getAssetInfo.ts`, `entities/ticker/actions/searchTickerAction.ts`, `entities/analysis/actions/{pollAnalysisAction,pollBriefingAction,submitAnalysisAction,submitOverallAnalysisAction,submitFinancialsAnalysisAction,submitFundamentalAnalysisAction,submitCongressTrendAction}.ts`, `entities/options-chain/actions/optionsActions.ts`, `entities/news-article/actions/submitNewsAnalysisAction.ts`, `entities/market-news/actions/submitMarketNewsDigestAction.ts`.

### B. Analytics

- `app/layout.tsx`에서 `import { Analytics } from '@vercel/analytics/next'`(6행)와 `<Analytics />`(164행) 제거.

### C. 설정·의존성·주석

- `vercel.json` 삭제.
- `package.json`에서 `@vercel/functions`·`@vercel/analytics` 제거 후 `yarn install`.
- `vi.mock('@vercel/functions', …)` ~16개 제거(아래 "테스트 영향").
- `shared/db/isNeonTransientError.ts`의 "Vercel 10s serverless" 타임아웃 가정 주석 갱신(상한 사라짐 — 단 retry 동작 자체는 변경하지 않음, 주석만).
- `.env.example:45` "Vercel Cron" → EventBridge 주석.

### Behavior-preservation

- waitUntil 제거 후에도 백그라운드 작업(번역 persist, AI job poll, asset info 캐싱)은 floating promise로 완료. 잃는 것은 Vercel 전용 graceful-drain 보장뿐(AWS에선 waitUntil을 두든 빼든 동일, 대상은 self-healing).

### 테스트 영향

- `@vercel/functions` mock 제거 대상: `app/[symbol]/__tests__/symbol-metadata.test.ts`, `__tests__/worst-case/{pollAnalysisRedisError,aiSlowResponse,cacheWriteFailure,assetInfoDegradation}.test.ts`, `entities/analysis/__tests__/{pollAnalysisAction,pollBriefingAction,submitAnalysisAction,submitOverallAnalysisAction,submitFinancialsAnalysisAction,submitFundamentalAnalysisAction,submitCongressTrendAction}.test.ts`, `entities/options-chain/__tests__/optionsActions.test.ts`, `entities/news-article/__tests__/submitNewsAnalysisAction.test.ts`, `entities/ticker/__tests__/actions/searchTickerAction.test.ts`.
- waitUntil 호출 여부를 단언하던 테스트는 **"백그라운드 작업이 실제로 일어났는지"** 로 단언 전환(동작 검증 — 단언의 *의미*는 동일, 더 견고). 이는 §2의 "단언 불변" 예외: mock 대상이 사라졌으므로 동등 동작 단언으로 치환. PR 본문에 명시.

---

## PR2 — P0 배럴 / server-only 일관성

문서화된 불변식(`options-chain`/`session`은 DB·server-only export를 barrel에서 제외)을 균일 적용. import 경로 변경뿐 → behavior-preserving.

| 슬라이스 | 증거 | 조치 |
|---|---|---|
| `entities/session` | `index.ts:39` bcrypt 재export → `useCurrentUser`(client) 동일 barrel | bcrypt re-export 제거; `auth-login/registerAction/confirmPasswordResetAction`은 `@/entities/session/lib/bcrypt` deep import |
| `entities/api-key` | `index.ts:1` `DrizzleUserApiKeyRepository`(node:crypto 체인) → premium-gate·api-key-management(client) | repo barrel 제외; server는 `@/entities/api-key/api` |
| `entities/inquiry` | `index.ts:1` `DrizzleContactRepository` → ContactForm(client) | 동일 |
| `entities/news-article` | `api.ts` `'server-only'` 누락 + barrel 재export | `'server-only'` 추가 + barrel에서 `./api` re-export 제외(타입 `NewsRow`는 type-only로 유지 가능) |
| (잠재) `market-news`, `notice` | 현재 type-only로 안전하나 동형 취약 | 동반 정리(선택) |

추가 안전장치: `shared/db/schema.ts`/`types.ts`에 `import 'server-only'` 추가 → 향후 value-leak가 빌드에서 fail-fast.

### 테스트 영향

- barrel→deep import 경로 변경 대상 테스트: `entities/session/__tests__/lib/bcrypt.test.ts`(이미 deep), `news-article/__tests__/{api,submitNewsAnalysisAction,ensureNewsCardsAnalyzedAction,lib/getNewsList}.test.ts`, `api-key`/`inquiry` 관련 테스트. **단언 불변**, 경로만.

---

## PR3 — app SEO/JSON-LD 헬퍼 추출 (×8 페이지)

8개 symbol 페이지(`[symbol]/page.tsx` + `overall/news/fundamental/options/fear-greed/congress/financials/page.tsx`)에 byte-identical로 복붙된 2블록을 `shared/lib/seo.ts`로 추출.

- `buildSymbolWebPageJsonLd({ url, name, description, about? }) → object` — WebPage JSON-LD 노드(9줄, `...(about && { about })` 조건부 스프레드 의미 보존). 기존 `buildBreadcrumbJsonLd` 옆.
- `symbolMetadataFromSeo(seo: SymbolSeoContent) → Metadata` — `{ title, description, keywords, alternates.canonical, openGraph, twitter }` 매핑. options만 `robots` 추가 스프레드 유지: `{ ...symbolMetadataFromSeo(seo), ...(hasOptions ? {} : { robots }) }`. `NOINDEX_SYMBOL_METADATA` early-return 경로는 헬퍼 미경유.

### Behavior-preservation

- `JsonLd`는 받은 객체를 그대로 직렬화 → 동일 입력=동일 SSR 출력. metadata는 값 단위 단언(title/canonical/og.title) 유지.

---

## PR4 — DST/ET-offset 3중복 통합 ⚠️ 경계 테스트 선행

`shared/api/fmp/FmpMarketProvider.ts`(36-54), `shared/lib/eastern.ts`(17-47), `shared/lib/etTimeUtils.ts`(19-73)에 "Nth Sunday + EST/EDT offset"이 3중복. 반환 shape는 각각 `-4|-5`, `-4|-5`, `'-04:00'|'-05:00'`.

### ⚠️ 선행 작업 (반드시 먼저)

3구현은 **spring-forward 경계일에 동작이 다름**: `etTimeUtils.getEtOffset`은 local hour 고려(02:00 전 EST), `FmpMarketProvider.getEtOffsetHours`는 date만 비교(hour 무시), `eastern.getEasternOffsetHours`는 UTC instant 비교. → **병합 전에 경계일(3월 2nd Sunday, 11월 1st Sunday, 전후 시각) 동등성 테스트를 추가**하고, 각 caller의 기존 동작을 픽스한 뒤 단일화.

### 통합

- `eastern.ts`를 canonical로: `nthSundayDay` 단일 primitive + hour-aware offset 함수. `etTimeUtils.getEtOffset`/`FmpMarketProvider.getEtOffsetHours`는 위임하여 각자 string/`-4|-5` shape 파생. `FmpMarketProvider`는 `fmpIntradayDateToUtcSeconds`에서 hour 보유 → hour-aware 채택해도 비경계 데이터는 무손실(경계일은 선행 테스트로 보장).

---

## PR5 — 옵션 차트 dedup

`widgets/options/OpenInterestChart.tsx`(575)와 `StrikeVolumeChart.tsx`(477)가 ~200줄 행동 로직 중복(포인터 핸들러, 툴팁 셸, sr-only 테이블, 라벨 렌더, geometry 헬퍼 `slotWidth/barCenterX/barPixelHeight`).

- pure geometry → `widgets/options/lib/strikeChartGeometry.ts`.
- 포인터 핸들러 + `cachedRectRef` 패턴 → `useStrikeBarChart` 훅.
- 툴팁/sr-only → `StrikeBarTooltip` + `StrikeBarSrTable`.
- **유지**: 레이아웃 상수 중복(의도된 per-chart 튜너빌리티, 코드 주석 근거), Call-above/Put-below 렌더, OI 전용 Max Pain 라인.

### 테스트 영향

- DOM/testid(`volume-chart-tooltip` vs OI id) 동일 유지. `__tests__/{OpenInterestChart,StrikeVolumeChart}.test.tsx` + `computeTooltipPos`/`pickLabelIndices`/`aggregateStrikeVolume` util 테스트 재검증.

---

## PR6 — 뉴스카드 셸 통합 ⚠️ 라벨/클래스 맵 주입 유지

`widgets/news/sections/NewsList.tsx`의 `NewsCard`(213-288)와 `widgets/market-news/MarketNewsCard.tsx`(161-245)가 카드 셸 전체 중복(+`AnalysisSkeleton`/`SummarySkeletonLine`/배지/KST 포매터).

- 공유 `NewsCard` 셸 추출(`widgets/news` export 또는 `shared/ui/news`), 라벨/클래스 맵과 ticker-chip 슬롯을 props/children으로 주입.
- ⚠️ **의도적 차이 보존**: news=`SENTIMENT_CLASS.bullish='bg-ui-success/10 text-chart-bullish'`, `IMPACT_LABEL.high='가격 영향 큼'` vs market-news=`text-ui-success-text`, `주가 영향 큼`. 셸만 통합, **각 surface가 자기 맵·testid 주입**.
- KST 포매터(`NEWS_PUBLISHED_AT_FORMATTER`/`PUBLISHED_AT_FORMATTER` 동일) → `shared/lib/timeFormat.ts`로 단일화(export 이름 유지하여 `NewsList.test.tsx:99-103` 단언 보존).
- byte-identical 폴링 상수 re-export(`news/constants.ts`·`market-news/constants.ts`)도 정리.

### 테스트 영향

- `NewsList.test.tsx`(가격/보통 라벨 단언), `MarketNewsCard.test.tsx`(공유 클래스 단언) — 셸 추출 후 양쪽 재검증. 라벨/클래스 맵은 절대 collapse 금지.

---

## PR7 — FMP Cached/Fake/factory 제네릭

`shared/api/fmp/`의 provider 패밀리 보일러플레이트 통합.

- `const sym = (s) => s.toUpperCase()` 3중복 → `shared/api/fmp/symKey.ts`.
- `getOrSetCache(...).then(slice).catch(log→[])` (financials+congress) → `cachedListWithLimit(key, ttl, max, fetch, { onError })`. congress의 "throw 전파"는 `onError: rethrow` 파라미터로(구조 분기 → 플래그).
- "E2E-gated singleton" 팩토리 5중복(`get{Fundamental,FinancialStatements,CongressTrades}DataProvider`, `getMarketDataProvider`, `getEconomyProvider`) → `createE2EGatedSingleton(makeReal, loadFake)`. ⚠️ `require` **리터럴 경로는 콜사이트 유지**(Turbopack 번들/dead-code 요구) → `loadFake`는 클로저로 전달. `getEconomyProvider`의 force-empty 미캐시 분기는 bespoke 유지.

### 테스트 영향

- `get*Provider.test.ts` ×5(real-vs-fake 선택), `Cached*Provider` 테스트(캐시 키/`[]` 폴백). 로그 prefix·키 포맷·분기 순서·require 리터럴 보존 시 단언 그대로 통과.

---

## PR8 — P2 cleanup 묶음

저위험 정리 모음(서로 disjoint).

- **StockChart 바인딩 레지스트리화**: `StockChart.tsx`(500-703)의 35줄 수동 `indicatorBindings`를 `INDICATOR_REGISTRY` 파생 + 오버레이/period override 맵으로. ⚠️ `StockChart.test.tsx:438`의 34-key 순서·`data-count="34"` 픽스 → 레지스트리 순서 그대로 재현. 23개 pane-hook 호출은 React 규칙상 유지.
- **useAnalysis restart 헬퍼**: `widgets/symbol-page/hooks/useAnalysis.ts`(393-450)의 cancel-reset-mutate 3중복 → `useCallback restartAnalysis(modelIdOverride?)`. 각 effect의 가드 로직은 inline 유지.
- **ChatPanel ModelSelect 분리**: `widgets/chat/ChatPanel.tsx`의 인라인 120줄 listbox → `widgets/chat/ModelSelect.tsx`(`{options, selected, onChange, isHydrated}`). DOM(`aria-haspopup`, `role="option"`, `aria-selected`, `✓`/`PRO`) 동일 유지.
- **소형 중복**: `findSpecByApiModelId`(llm-provider anthropic/openai → `lib/utils.ts`), client-IP 추출(chat-message 2곳 → `lib/getClientIp.ts`), Redis refresh-flag 5~6곳 → `shared/cache/createRedisFlag`, `isoDate`→`etDateOf`(economy 내), `num`/`toFiniteNumber`(fmp → `toFiniteNumber.ts`), dashboard `QuoteHeader` 추출.
- **잉여 re-export 삭제**: `api-key/lib/index.ts`(테스트만 사용 → 경로 변경 후 삭제), `oauth-account/lib/revoker.ts:29`, `verifyEmailAction:42` 중복 `normalizeEmail`.
- **dead `'use server'` actions.ts ×5 삭제**: `features/{auth-login,auth-signup,auth-logout,auth-email-verification,account-delete}/actions.ts` — 미사용(import 0건) + 문서화된 barrel 'use server' 규칙 위반. `auth-oauth/actions.ts`는 사용 중 → 유지.

### 테스트 영향

- 각 항목 colocated 테스트는 관측 동작(렌더 텍스트/클래스, mutate/cancel 호출)을 단언 → 추출에 불변. dead barrel은 import 0건 확인됨.

---

## 후속 (별도 spec)

- **Spec-2**: `symbol-page → pages` 레이어 승격. 완료 시 ESLint `widgets→widgets` 예외 **재봉인**.
- **Spec-3**: `user/session` 병합 여부. 완료 시 user↔session deep-path 결합 **재봉인**(단 `entities→entities` 룰 전체는 analysis 조합 때문에 유지).
