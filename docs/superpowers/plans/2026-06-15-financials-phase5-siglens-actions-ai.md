# Financials Phase 5 — siglens 분석 액션 · hook · AI 위젯 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** financials AI 분석의 server actions(submit/poll/cancel), react-query hook, `FinancialsAiSummary` 위젯, chat publish를 추가하고 페이지에 AI 섹션을 연결한다.

**Architecture:** `fundamental` AI 흐름 1:1 미러 — action(`isBot`→`skipEnqueueIfMiss`, `resolveTierAndByok`, E2E stub)→core `submit/pollFinancialsAnalysis`→worker. hook은 `enabled:false`·`staleTime:Infinity`·`ANALYSIS_POLL_INTERVAL_MS` 폴링. **peek SSR seed 없음**(스펙 §4.7 결정 — 룰 데이터가 SEO 충족, AI는 클라 폴링만).

**Tech Stack:** Next 16 server actions, @tanstack/react-query, vitest+RTL 90%. **선행:** Phase 2(core chat kind), Phase 4(페이지), core overlay.

**상위 스펙:** §4.2(AI 잡), §4.9(chat).

---

## Phase 0: 전제
- [ ] `cd /Users/y0ngha/Project/siglens-financials`, core overlay에 `submitFinancialsAnalysis`/`pollFinancialsAnalysis` export 존재 확인(`node -e "console.log(typeof require('@y0ngha/siglens-core').submitFinancialsAnalysis)"` → "function").

---

## Task 1: submit/poll/cancel FinancialsAnalysisAction

**Files:**
- Create: `src/entities/analysis/actions/{submit,poll,cancel}FinancialsAnalysisAction.ts`
- Modify: `src/entities/analysis/actions.ts` (barrel)
- Test: `src/entities/analysis/actions/__tests__/submitFinancialsAnalysisAction.test.ts`

`submitFundamentalAnalysisAction.ts` 미러.

- [ ] **Step 1: 실패 테스트** (happy + worst) — getCurrentUser/resolveTierAndByok/getFinancialStatementsProvider/isBot mock:
```
- 정상: submitFinancialsAnalysis 위임, dataProvider=getFinancialStatementsProvider() 주입, waitUntil 전달
- 봇(isBot=true): skipEnqueueIfMiss=true 전달
- gate blocked: {status:'error', error}
- E2E(isE2E): e2eCachedFinancials() 반환(provider 미호출)
- 예외: {status:'error', error: buildGateError('unexpected_error')}
```
Run → FAIL
- [ ] **Step 2: 구현** — `submitFinancialsAnalysisAction(symbol, modelId)`:
```typescript
'use server';
// isE2E → e2eCachedFinancials()
// headers→isBot→skipEnqueueIfMiss
// getCurrentUser→resolveTierAndByok(userId, modelId)→blocked면 error
// return submitFinancialsAnalysis({ symbol, modelId, dataProvider: getFinancialStatementsProvider(), waitUntil, tier, skipEnqueueIfMiss, ...(userApiKey) })
// catch→buildGateError('unexpected_error')
```
`pollFinancialsAnalysisAction(jobId)` = `return pollFinancialsAnalysis(jobId)`. `cancelFinancialsAnalysisJobAction(jobId)` = core cancel 위임. barrel `actions.ts`에 3개 + 타입 re-export(`'use server'`는 개별 파일만).
- [ ] **Step 3: 통과** → PASS. **Step 4: Commit** `feat(financials): add financials analysis server actions`

---

## Task 2: E2E stub

**Files:**
- Modify: `src/shared/api/e2eAnalysisStub.ts`
- Modify: `@e2e/fixtures/analysis.json` (financials 항목)
- Test: 기존 stub 테스트 보강

- [ ] **Step 1~3:** `e2eCachedFinancials(): SubmitFinancialsAnalysisCached`(fixture `FinancialsAnalysisResponse` 반환) + `E2E_FORCE_FINANCIALS_ERROR_COOKIE` 상수 + 강제 에러 헬퍼(resilience용). fixture에 결정론적 financials 분석 추가.
- [ ] **Step 4: Commit** `feat(financials): add E2E analysis stub + force-error cookie`

---

## Task 3: QUERY_KEYS

**Files:**
- Modify: `src/shared/config/queryConfig.ts`

- [ ] **Step 1~3:** `financialsAnalysis: (symbol, modelId) => ['financials-analysis', upper(symbol), modelId] as const` 추가. 테스트 보강.
- [ ] **Step 4: Commit** `feat(financials): add financialsAnalysis query key`

---

## Task 4: useFinancialsAnalysis hook

**Files:**
- Create: `src/widgets/financials/hooks/useFinancialsAnalysis.ts`
- Test: `__tests__/useFinancialsAnalysis.test.ts`

`useFundamentalAnalysis.ts` 미러. **initialData seed 없음**(peek 미사용).

- [ ] **Step 1: 실패 테스트** (happy + worst) — submit→poll 루프, cached 즉시, miss_no_trigger→`BotBlockedError`, error→error 상태, abort/unmount cancel.
- [ ] **Step 2: 구현** — react-query `enabled:false`·`retry:false`·`staleTime:Infinity`, queryKey=`QUERY_KEYS.financialsAnalysis`. `fetchFinancialsAnalysis`: `submitFinancialsAnalysisAction`→cached return / miss_no_trigger throw BotBlockedError / error throw / submitted면 `pollFinancialsAnalysisAction` 루프(`sleep(ANALYSIS_POLL_INTERVAL_MS)`, signal.aborted). hydration 시 auto refetch, unmount/queryKey 변경 시 `cancelFinancialsAnalysisJobAction`. state union `loading|done|bot_blocked|error`.
- [ ] **Step 3: 통과** → PASS. **Step 4: Commit** `feat(financials): add useFinancialsAnalysis hook`

---

## Task 5: FinancialsAiSummary 위젯

**Files:**
- Create: `src/widgets/financials/FinancialsAiSummary.tsx` (+ Skeleton/Error/View)
- Test: `__tests__/FinancialsAiSummary.test.tsx`

`FundamentalAiSummary` 패턴: sentiment 뱃지 + axisAssessments 리스트 + riskFactors, `MarkdownText`, skeleton(aria-busy), `BotBlockedNotice`.

- [ ] **Step 1: 실패 테스트** — loading→skeleton, done→총평+4축+위험, bot_blocked→BotBlockedNotice, error→error UI + 재시도.
- [ ] **Step 2: 구현** — `FinancialsAiSummary({symbol})`: `modelId=useDefaultModelId()`, `state=useFinancialsAnalysis(symbol, modelId)`. SENTIMENT_LABEL/CLASS(긍정/중립/부정), AXIS_LABEL(성장성/수익성·질/안정성/현금창출력). View=헤더+sentiment 뱃지+`overallConclusionKo`+axisAssessments(`ul`)+riskFactorsKo(`ul`).
- [ ] **Step 3: 통과** → PASS. **Step 4: Commit** `feat(financials): add FinancialsAiSummary widget`

---

## Task 6: chat publish + 페이지 연결

**Files:**
- Create: `src/widgets/financials/utils/buildChatState.ts`
- Modify: `src/widgets/financials/FinancialsAiSummary.tsx` (publish 연결)
- Modify: `src/app/[symbol]/financials/page.tsx` (AI 섹션 추가)
- Test: `__tests__/buildChatState.test.ts`

- [ ] **Step 1~3:** `buildChatState(state)`: `done`이면 `{ context: { kind:'financials', payload: state.result }, timeframe: null, isAnalysisReady: true }`, else `{ context:null, timeframe:null, isAnalysisReady:false }`. `FinancialsAiSummary`에서 `usePublishSymbolChat(useMemo(()=>buildChatState(state),[state]))`. page.tsx에 `<FinancialsAiSummary symbol={upper} />` 섹션 추가(ErrorBoundary 래핑).
- [ ] **Step 4: 통과** → PASS. **Step 5: Commit** `feat(financials): publish financials context to chat + wire AI section`

---

## Task 7: 검증

- [ ] **Step 1:** `yarn lint` + `yarn test src/widgets/financials src/entities/analysis`(커버리지 ≥90%) + `E2E_TEST=1 yarn build`(clientTest/prerender 회귀 없음 — 메모리 교훈) 확인.
- [ ] **Step 2:** 기존 fundamental/overall 회귀 없음.

---

## Self-Review
- §4.2 AI 잡(action·hook·위젯) Task 1·4·5. §4.9 chat Task 6. peek 미사용(스펙 §4.7) — initialData seed 없음 명시.
- worst case: bot_blocked, error, abort, E2E force-error.
- 타입: core `FinancialsAnalysisResponse`, chat `kind:'financials'`(Phase 2) 일치.
