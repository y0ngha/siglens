# Financials Phase 4 — siglens 페이지 + UI 위젯 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** `/[symbol]/financials` RSC 페이지 + `widgets/financials` UI(종합 등급 게이지·4축 스코어카드·재무제표 표/차트·연·분기 토글)를 추가한다. AI 위젯은 Phase 5.

**Architecture:** 룰 스코어카드·표·차트는 **동기 SSR**(core `computeFinancialsScorecard`). `staticSymbolCache`로 6종 fetch, ISR 24h. 차트는 inline SVG(`GrowthChart`/`FearGreedGauge` 패턴), 분기는 클라 lazy fetch.

**Tech Stack:** Next 16 RSC, Tailwind v4, vitest+RTL 90%. **선행:** Phase 3(provider) + core overlay.

**상위 스펙:** §4.4, §4.5, §4.7(ISR).

---

## Phase 0: 전제
- [ ] `cd /Users/y0ngha/Project/siglens-financials && git status`(feat/financials), core overlay 최신, `yarn test src/shared/api/fmp` green.

---

## Task 1: financialData.ts (페이지 데이터 접근)

**Files:**
- Create: `src/app/[symbol]/financials/financialData.ts`
- Test: `src/app/[symbol]/financials/__tests__/financialData.test.ts`

`fundamentalData.ts` 패턴. `staticSymbolCache(['financials:income', symbol], symbol, () => provider.getIncomeStatements(symbol,'annual',5), ['financials:'+symbol])` 등 6종. snapshot 조립 → `normalizeFinancialsSnapshot` → `computeFinancialsScorecard`(동기).

- [ ] **Step 1: 실패 테스트** — provider mock, 6종 fetch 후 `getFinancialsPageData(symbol)`가 `{ snapshot, scorecard }` 반환, 빈 데이터 시 scorecard.composite.grade='F'.
- [ ] **Step 2: 실패 확인** → FAIL
- [ ] **Step 3: 구현**

```typescript
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { getFinancialStatementsProvider } from '@/shared/api/fmp/getFinancialStatementsProvider';
import { computeFinancialsScorecard, normalizeFinancialsSnapshot } from '@y0ngha/siglens-core';
import type { FinancialsScorecard, FinancialsSnapshot, StatementPeriod } from '@y0ngha/siglens-core';

const ANNUAL_LIMIT = 5;
const tag = (s: string) => [`financials:${s.toUpperCase()}`];

export async function getFinancialsSnapshot(symbol: string, period: StatementPeriod = 'annual', limit = ANNUAL_LIMIT): Promise<FinancialsSnapshot> {
    const p = getFinancialStatementsProvider();
    const [income, balance, cashFlow, incomeGrowth, financialGrowth, cashFlowGrowth] = await Promise.all([
        staticSymbolCache(['financials:income', symbol, period], symbol, () => p.getIncomeStatements(symbol, period, limit), tag(symbol)),
        staticSymbolCache(['financials:balance', symbol, period], symbol, () => p.getBalanceSheets(symbol, period, limit), tag(symbol)),
        staticSymbolCache(['financials:cashflow', symbol, period], symbol, () => p.getCashFlowStatements(symbol, period, limit), tag(symbol)),
        staticSymbolCache(['financials:income-growth', symbol, period], symbol, () => p.getIncomeStatementGrowths(symbol, period, limit), tag(symbol)),
        staticSymbolCache(['financials:financial-growth', symbol, period], symbol, () => p.getFinancialGrowths(symbol, period, limit), tag(symbol)),
        staticSymbolCache(['financials:cashflow-growth', symbol, period], symbol, () => p.getCashFlowGrowths(symbol, period, limit), tag(symbol)),
    ]);
    return normalizeFinancialsSnapshot({ income, balance, cashFlow, incomeGrowth, financialGrowth, cashFlowGrowth });
}

export async function getFinancialsPageData(symbol: string): Promise<{ snapshot: FinancialsSnapshot; scorecard: FinancialsScorecard }> {
    const snapshot = await getFinancialsSnapshot(symbol);
    return { snapshot, scorecard: computeFinancialsScorecard(snapshot) };
}
```
- [ ] **Step 4: 통과** → PASS. **Step 5: Commit** `feat(financials): add financialData page access (6 fetch + scorecard)`

---

## Task 2: page.tsx (RSC + ISR)

**Files:**
- Create: `src/app/[symbol]/financials/page.tsx`
- Test: `src/app/[symbol]/financials/__tests__/page.test.tsx`

`fundamental/page.tsx` 패턴: `revalidate=86400`, `generateStaticParams()→[]`, `getProfileResilient` 게이팅(404/degraded), `connection()`/dynamic API 금지. (generateMetadata·JsonLd는 Phase 6.)

- [ ] **Step 1: 실패 테스트** — 존재 심볼 렌더 시 `FinancialsScorecard` + 섹션 표시, 미존재 시 `notFound`.
- [ ] **Step 2: 실패 확인** → FAIL
- [ ] **Step 3: 구현** — RSC async page. `getProfileResilient(upper)` → null이면 `notFound()`, degraded면 degraded UI. `getFinancialsPageData(upper)` → `<FinancialsScorecard scorecard={...} />` + sections + (Phase5에서 `<FinancialsAiSummary symbol/>` 추가). `export const revalidate = 86400; export async function generateStaticParams(){return []}`.
- [ ] **Step 4: 통과** → PASS. **Step 5: Commit** `feat(financials): add /[symbol]/financials page (ISR 24h)`

---

## Task 3: 점수 시각화 — CompositeGradeGauge + AxisScoreCard

**Files:**
- Create: `src/widgets/financials/CompositeGradeGauge.tsx`, `src/widgets/financials/AxisScoreCard.tsx`
- Test: 각 `__tests__`

`FearGreedGauge`(반원 SVG+니들) 패턴. 등급색 A/B=`ui-success`, C=`ui-warning`, D/F=`ui-danger`.

- [ ] **Step 1: 실패 테스트** — score=78 → "78" + grade "B+"(또는 "B") 표시, role="img" aria-label; null score → "—".
- [ ] **Step 2~4: 구현/통과** — `CompositeGradeGauge({score, grade, summaryKo})` 반원 게이지. `AxisScoreCard({title, axis: AxisScore})` 미니 게이지/바 + 등급 + signals 칩(`labelKo`, direction별 색).
- [ ] **Step 5: Commit** `feat(financials): add grade gauge + axis score card`

---

## Task 4: FinancialsScorecard (조립 위젯)

**Files:**
- Create: `src/widgets/financials/FinancialsScorecard.tsx`
- Test: `__tests__/FinancialsScorecard.test.tsx`

- [ ] **Step 1~4: TDD** — `FinancialsScorecard({scorecard})` = `CompositeGradeGauge`(히어로) + 4× `AxisScoreCard`(growth/quality/solvency/cash) 2x2(모바일)/4열 그리드. 카드 `border-secondary-700 bg-secondary-800 rounded-xl border p-6`.
- [ ] **Step 5: Commit** `feat(financials): add FinancialsScorecard widget`

---

## Task 5: 재무제표 열람 섹션 (표 + 차트)

**Files:**
- Create: `src/widgets/financials/sections/{StatementTable,FinancialTrendChart,IncomeStatementSection,BalanceSheetSection,CashFlowSection,GrowthAnalysisSection,EmptySectionCard}.tsx`
- Test: 각 핵심 `__tests__`

`PeersTable`(native table) + `GrowthChart`(inline SVG) 패턴.

- [ ] **Step 1: StatementTable** — `StatementTable({columns, rows})` 재사용 표(연도 열, 지표 행, `font-mono tabular-nums`, 양/음 색). 테스트: 행/열 렌더, null→"—".
- [ ] **Step 2: FinancialTrendChart** — inline SVG 막대/라인(`GrowthChart` 확장). N년 시계열 1개 metric. 테스트: 막대 개수, 음수 색.
- [ ] **Step 3: 4개 Section** — IncomeStatementSection(매출·순이익 차트 + 표: 매출/총이익/영업이익/순이익/EPS/3마진), BalanceSheetSection(자산·부채·자본 + 표: 총자산/총부채/순부채/현금/자본/유동비율), CashFlowSection(영업CF·FCF·CapEx + 표: 영업CF/CapEx/FCF/FCF마진/배당), GrowthAnalysisSection(financial-growth 성장률 + 3Y/5Y/10Y). 데이터 없으면 `EmptySectionCard`. 각 섹션 InfoTooltip(Task 7 용어).
- [ ] **Step 4: 통과** → 각 PASS. **Step 5: Commit** `feat(financials): add statement viewer sections (table + trend chart)`

---

## Task 6: PeriodToggle + useFinancialsPeriod (분기 lazy)

**Files:**
- Create: `src/widgets/financials/PeriodToggle.tsx`, `src/widgets/financials/hooks/useFinancialsPeriod.ts`
- Create: `src/entities/.../getFinancialsQuarterAction.ts` 또는 `financialData.ts`에 분기 server action
- Test: 각 `__tests__`

`TimeframeSelector`(세그먼트 버튼) 패턴. 연간은 SSR 기본, 분기 토글 시 server action으로 8분기 lazy fetch(페이로드 절약).

- [ ] **Step 1~4: TDD** — `PeriodToggle({value, onChange})`(연간/분기, a11y). `useFinancialsPeriod(symbol, initialAnnual)`: 'annual'→SSR 데이터, 'quarter' 선택 시 `getFinancialsQuarterAction(symbol)`(server action, `getFinancialsSnapshot(symbol,'quarter',8)`) lazy fetch + react-query 캐시. 실패 시 토글 비활성 + 연간 유지.
- [ ] **Step 5: Commit** `feat(financials): add annual/quarter toggle with lazy quarter fetch`

---

## Task 7: InfoTooltip 용어 (신규 7종)

**Files:**
- Create: `src/widgets/financials/financialsTooltips.tsx` (옵션 `optionsTooltips.tsx` 패턴) 또는 각 섹션 인라인
- Test: 텍스트 존재 확인

스펙 §4.5 워딩(FCF·순부채·이익의질·CapEx·FCF마진·CAGR·매출총이익률). house style `~이에요`체. 기존 용어(부채비율·유동비율·영업현금흐름·마진)는 fundamental에서 재사용/공용 승격.

- [ ] **Step 1~4: TDD** — 각 툴팁 컴포넌트/상수 + 섹션에 `<InfoTooltip>` 연결. **Step 5: Commit** `feat(financials): add financial term tooltips`

---

## Task 8: 탭 등록

**Files:**
- Modify: `src/widgets/symbol-page/utils/symbolTabsConfig.ts`
- Test: 기존 탭 테스트 보강

- [ ] **Step 1~4:** `TABS`에 `{ key: 'financials', label: '재무제표', hrefBuilder: (s) => `/${s}/financials` }` 추가(fundamental 다음 위치). 테스트: 탭 목록에 financials 존재, href 정확.
- [ ] **Step 5: Commit** `feat(financials): register financials tab`

---

## Task 9: 검증

- [ ] **Step 1:** `yarn lint src/widgets/financials src/app/[symbol]/financials` + `yarn test src/widgets/financials src/app/[symbol]/financials`(커버리지 ≥90%) + `yarn build`(financials 페이지 prerender 확인, E2E_TEST 아님).
- [ ] **Step 2:** 회귀 없음 확인(기존 탭/페이지).

---

## Self-Review
- §4.4 컴포넌트 트리 전부(Scorecard/Gauge/AxisCard/Toggle/sections/Table/TrendChart/Empty) Task로 커버. AiSummary는 Phase 5(의도).
- §4.7 ISR(revalidate 86400, generateStaticParams [], connection 금지) Task 2.
- §4.5 용어 Task 7.
- 타입: core overlay의 `FinancialsScorecard`/`FinancialsSnapshot` 소비.
