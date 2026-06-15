# Financials Phase 2 — siglens-core overall · chat 통합 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Phase 1에서 만든 `FinancialsScorecard`를 overall 종합 분석에 **동기 주입**(잡 축 아님)하고, `FinancialsAnalysisResponse`를 chat 컨텍스트 `kind`로 추가한다.

**Architecture:** financials는 overall의 5번째 폴링 축이 아니라 **사전 계산된 스코어카드**로 `buildOverallAnalysisPrompt`에 직접 전달된다(폴링·jobId·pending 없음). chat은 `CurrentAnalysisContext` union에 `financials` kind를 더해 `buildChatPrompt`가 처리한다.

**Tech Stack:** Phase 1과 동일(TS strict, vitest 90%). **선행:** Phase 1 완료(동일 core 워크트리 `siglens-core-financials`에서 이어서).

**상위 스펙:** `docs/superpowers/specs/2026-06-15-symbol-financials-tab-design.md` (§4.8, §4.9).

---

## Phase 0: 전제

- [ ] **Step 1: Phase 1 브랜치 확인**

```bash
cd /Users/y0ngha/Project/siglens-core-financials
git status   # feat/financials-domain, Phase 1 커밋 존재 확인
yarn test:quiet   # baseline green
```

---

## Task 1: OverallAnalysisResponse + normalizeOverall에 financialsBulletsKo 추가

**Files:**
- Modify: `src/domain/types.ts` (`OverallAnalysisResponse`, line ~2625 `optionsBulletsKo` 직후)
- Modify: `src/domain/analysis/normalizeOverall.ts` (overall 응답 정규화에 신규 필드)
- Test: `src/__tests__/domain/analysis/normalizeOverall.test.ts`

- [ ] **Step 1: 타입 필드 추가**

`src/domain/types.ts` `OverallAnalysisResponse`:
```typescript
    /** 재무 스코어카드 요약 불릿 (한국어). financials 미주입 시 빈 배열. */
    financialsBulletsKo: string[];
```
> optional이 아닌 `string[]`로 두고 정규화에서 항상 `[]` 기본값(다른 bullets와 일관).

- [ ] **Step 2: normalizeOverall 실패 테스트 추가**

`normalizeOverall.test.ts`에 케이스:
```typescript
it('defaults financialsBulletsKo to [] when missing', () => {
    expect(normalizeOverallAnalysisResponse({}).financialsBulletsKo).toEqual([]);
});
it('normalizes financialsBulletsKo string array', () => {
    expect(normalizeOverallAnalysisResponse({ financialsBulletsKo: ['현금흐름 견조', ''] }).financialsBulletsKo).toEqual(['현금흐름 견조']);
});
```
Run: `yarn vitest run src/__tests__/domain/analysis/normalizeOverall.test.ts` → FAIL

- [ ] **Step 3: normalizeOverall에 필드 추가** — 기존 `*BulletsKo` 정규화 줄 옆에 `financialsBulletsKo: normalizeStringArray(o.financialsBulletsKo)` 추가(기존 헬퍼 재사용).

- [ ] **Step 4: 통과 확인** → PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/types.ts src/domain/analysis/normalizeOverall.ts src/__tests__/domain/analysis/normalizeOverall.test.ts
git commit -m "feat(financials): add financialsBulletsKo to overall response"
```

---

## Task 2: OverallDependencyInputs에 financialsScorecard 슬롯

**Files:**
- Modify: `src/application/overall/types.ts` (`OverallDependencyInputs`, `optionsOiStale?` 직후)

- [ ] **Step 1: 필드 추가**

```typescript
    /**
     * 사전 계산된 재무 스코어카드. 4개 의존성 축(technical/fundamental/news/options)과 달리
     * financials는 동기 계산되어 폴링 없이 프롬프트에 직접 주입된다. 생략 시 financials 축 생략.
     */
    financialsScorecard?: FinancialsScorecard;
```
import: `import type { FinancialsScorecard } from '@/domain/types';`

- [ ] **Step 2: typecheck + Commit**

```bash
yarn typecheck
git add src/application/overall/types.ts
git commit -m "feat(financials): add financialsScorecard slot to OverallDependencyInputs"
```

---

## Task 3: buildOverallAnalysisPrompt — financials 파라미터 + formatFinancials + 스키마

**Files:**
- Modify: `src/domain/analysis/overallPrompt.ts`
- Test: `src/__tests__/domain/analysis/overallPrompt.test.ts`

- [ ] **Step 1: 실패 테스트**

```typescript
import { buildOverallAnalysisPrompt } from '@/domain/analysis/overallPrompt';
// ... 기존 fixtures(technical/fundamental/news) 재사용
it('injects financials scorecard and adds financialsBulletsKo to schema', () => {
    const scorecard = /* computeFinancialsScorecard(emptySnapshot) 또는 fixture */;
    const p = buildOverallAnalysisPrompt('AAPL', 'Apple', tech, fund, news, '1D', undefined, null, false, scorecard);
    expect(p).toContain('financialsBulletsKo');
    expect(p).toMatch(/재무|Financials/);
});
it('renders Korean hint when financials is null', () => {
    const p = buildOverallAnalysisPrompt('AAPL', 'Apple', tech, fund, news, '1D', undefined, null, false, null);
    expect(p).toContain('financialsBulletsKo'); // 스키마엔 항상 존재
});
```
Run → FAIL

- [ ] **Step 2: 시그니처 + 구현**

`buildOverallAnalysisPrompt`에 마지막 파라미터 추가:
```typescript
    financials?: FinancialsScorecard | null
```
`formatFinancials` 헬퍼 추가(`formatOptions` 패턴, options의 null-coalescing 미러):
```typescript
function formatFinancials(scorecard: FinancialsScorecard | null | undefined): string {
    if (scorecard == null) return '[재무 스코어카드] 데이터 없음 — financialsBulletsKo는 빈 배열로 둘 것.';
    const { growth, quality, solvency, cash, composite } = scorecard;
    return [
        `종합: ${composite.grade} (${composite.score}/100) — ${composite.summaryKo}`,
        `성장성: ${growth.grade}, 수익성·질: ${quality.grade}, 안정성: ${solvency.grade}, 현금창출력: ${cash.grade}`,
        `시그널: ${[...growth.signals, ...quality.signals, ...solvency.signals, ...cash.signals].map(s => s.labelKo).join(', ') || '없음'}`,
    ].join('\n');
}
```
프롬프트 본문 Options 섹션 뒤에 `## Financials Scorecard\n${formatFinancials(financials)}` 삽입. 출력 JSON 스키마에 `"financialsBulletsKo": ["재무 요약 불릿 (한국어)"]` 추가.

- [ ] **Step 3: 통과 확인** → PASS

- [ ] **Step 4: Commit**

```bash
git add src/domain/analysis/overallPrompt.ts src/__tests__/domain/analysis/overallPrompt.test.ts
git commit -m "feat(financials): inject scorecard into overall prompt + schema"
```

---

## Task 4: submitOverallAnalysis — 프롬프트 호출 + 캐시 해시

**Files:**
- Modify: `src/application/overall/submitOverallAnalysis.ts`
- Test: `src/__tests__/application/overall/submitOverallAnalysis.test.ts`

- [ ] **Step 1: 실패 테스트** — financials가 (a) 프롬프트 빌더에 전달되고 (b) 입력 해시에 포함돼 캐시 키가 바뀌는지.

```typescript
it('passes financialsScorecard to prompt builder', async () => {
    // buildOverallAnalysisPrompt mock 호출 인자에 scorecard 포함 검증
});
it('financialsScorecard changes cache key (different hash)', async () => {
    // 동일 입력 + scorecard 유무로 cacheKey가 달라지는지
});
```
Run → FAIL

- [ ] **Step 2: 구현**
  - 프롬프트 호출(현 line ~334)에 `options.financialsScorecard ?? undefined` 마지막 인자 추가.
  - 입력 해시(현 line ~258 `hashAnalysisInput(JSON.stringify({...}))`)에 `fin: options.financialsScorecard` 추가.

- [ ] **Step 3: 통과 확인** → PASS

- [ ] **Step 4: Commit**

```bash
git add src/application/overall/submitOverallAnalysis.ts src/__tests__/application/overall/submitOverallAnalysis.test.ts
git commit -m "feat(financials): wire scorecard into overall submit + cache hash"
```

---

## Task 5: CurrentAnalysisContext — financials kind

**Files:**
- Modify: `src/domain/types.ts` (`CurrentAnalysisContext` union)
- Modify: `src/application/chat/types.ts` (JSDoc)

- [ ] **Step 1: union 멤버 추가**

```typescript
    | { kind: 'financials'; payload: FinancialsAnalysisResponse };
```
`RequestChatCompletionParams.currentAnalysisContext` JSDoc에 `/ financials` 추가.

- [ ] **Step 2: typecheck** → `buildChatPrompt` switch가 non-exhaustive로 에러날 수 있음(다음 Task에서 해결). 일단 커밋 보류, Task 6과 함께.

---

## Task 6: buildChatPrompt — formatFinancialsContext + case

**Files:**
- Modify: `src/domain/chat/buildChatPrompt.ts`
- Test: `src/__tests__/domain/chat/buildChatPrompt.test.ts`

- [ ] **Step 1: 실패 테스트**

```typescript
it('renders financials context section', () => {
    const payload = { overallConclusionKo: '현금흐름 견조', axisAssessments: [], riskFactorsKo: [], overallSentiment: 'bullish' as const };
    const out = buildChatPrompt('AAPL', '1D', analysis, [], 'q', { kind: 'financials', payload });
    expect(out.system).toContain('현금흐름 견조');
});
```
Run → FAIL (switch에 case 없음)

- [ ] **Step 2: 구현**

`formatFinancialsContext` 헬퍼(`formatFundamentalContext` 패턴):
```typescript
function formatFinancialsContext(p: FinancialsAnalysisResponse): string {
    return [
        `Overall: ${p.overallConclusionKo} (${p.overallSentiment})`,
        ...p.axisAssessments.map(a => `- ${a.axis} [${a.sentiment}]: ${a.rationaleKo}`),
        p.riskFactorsKo.length ? `Risks: ${p.riskFactorsKo.join('; ')}` : '',
    ].filter(Boolean).join('\n');
}
```
switch에 `case 'financials': body = formatFinancialsContext(context.payload); break;` 추가.

- [ ] **Step 3: 통과 확인** → PASS, `yarn typecheck` 통과(exhaustive).

- [ ] **Step 4: Commit (Task 5+6 함께)**

```bash
git add src/domain/types.ts src/application/chat/types.ts src/domain/chat/buildChatPrompt.ts src/__tests__/domain/chat/buildChatPrompt.test.ts
git commit -m "feat(financials): add financials kind to chat context"
```

---

## Task 7: 전체 검증 + 빌드

- [ ] **Step 1: typecheck + 커버리지 + 빌드**

Run:
```bash
yarn typecheck
yarn test:coverage   # 변경 파일 ≥90%
yarn build           # dist 생성
```
Expected: 모두 PASS.

- [ ] **Step 2: core overlay 준비 (Phase 3 진입 전)**

```bash
# core 빌드 산출물을 siglens 워크트리(Phase 3에서 생성)의 node_modules로 복사 — Phase 3 Step에서 수행
# 여기서는 dist 생성 확인만:
ls dist/index.js dist/index.d.ts
```

> **머지·릴리스는 사용자.** Phase 1+2 PR을 사용자가 머지하면, `yarn build` 산출물을 siglens `node_modules/@y0ngha/siglens-core/`에 overlay(Phase 3 Phase 0에서 절차화).

---

## Self-Review

- 스펙 §4.8(overall): Task 1·2·3·4 = response 필드 + inputs 슬롯 + 프롬프트 주입 + submit 호출/해시. ✅
- 스펙 §4.9(chat): Task 5·6 = union + buildChatPrompt case. ✅
- 타입 일관성: `financialsScorecard`(inputs)·`FinancialsScorecard`(Phase 1)·`financialsBulletsKo`(response) 일치. `FinancialsAnalysisResponse`(chat payload)=Phase 1 정의.
- normalizeOverall도 신규 필드 처리(Task 1) — 누락 방지.

---

## 후속: Phase 3(siglens 데이터 계층) → 이 문서의 build dist를 siglens node_modules에 overlay 후 진입.
