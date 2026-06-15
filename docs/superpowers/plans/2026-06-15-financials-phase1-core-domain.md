# Financials Phase 1 — siglens-core 도메인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** siglens-core에 `financials` 분석 도메인을 `fundamental` 도메인의 미러로 추가한다(port·types·정규화·룰 스코어카드·프롬프트·submit/poll/cancel·barrel).

**Architecture:** `fundamental`과 동일한 레이어 구조(domain/ports, domain/types, domain/analysis, application/financials, infrastructure/cache). 룰 스코어카드는 `detectSignals`식 **순수 함수**로 결정론적 계산, AI는 worker 잡(submit/poll). LLM 출력은 `normalizeFinancialsAnalysisResponse`로 방어 정규화.

**Tech Stack:** TypeScript(strict, ES2023, CommonJS), vitest(v8 coverage, 임계 90%), `@/` alias + tsc-alias 빌드.

**상위 스펙:** `docs/superpowers/specs/2026-06-15-symbol-financials-tab-design.md` (§4.2, §5, §6).

**레포:** `/Users/y0ngha/Project/siglens-core` (siglens와 별도 레포). 빌드 `yarn build`(tsc + tsc-alias), 테스트 `yarn test`/`yarn test:coverage`.

---

## Phase 0: 워크트리 셋업

- [ ] **Step 1: core 레포 워크트리 생성**

```bash
cd /Users/y0ngha/Project/siglens-core
git worktree add ../siglens-core-financials -b feat/financials-domain
cd /Users/y0ngha/Project/siglens-core-financials
```

- [ ] **Step 2: 의존성 설치 (symlink 금지 — 메모리 교훈)**

```bash
# 하드링크 복사 후 잔여 중첩 디렉토리 제거 (Turbopack/dual-instance 회피)
cp -al /Users/y0ngha/Project/siglens-core/node_modules ./node_modules 2>/dev/null || yarn install
rm -rf ./node_modules/node_modules 2>/dev/null || true
```

- [ ] **Step 3: 베이스라인 그린 확인**

Run: `yarn test:quiet && yarn typecheck`
Expected: 전체 PASS (변경 전 baseline). 실패 시 워크트리 node_modules 재설치(`rm -rf node_modules && yarn install`).

---

## Task 1: financials 도메인 타입 정의

**Files:**
- Modify: `src/domain/types.ts` (fundamental 타입 블록 직후, lines ~2496 부근에 추가)

기존 `Fundamental*` 타입 컨벤션을 그대로 따른다. **core는 thin** — Row 타입은 분석·표시 공용 핵심 필드만(스펙 §4.2-2).

- [ ] **Step 1: Row · Snapshot · Scorecard · Response · Raw 타입 추가**

`src/domain/types.ts`에 추가:

```typescript
// ─── Financials (재무제표) domain ───────────────────────────────

export type StatementPeriod = 'annual' | 'quarter';
export type FinancialsSentiment = 'bullish' | 'neutral' | 'bearish';
export type FinancialsAxis = 'growth' | 'quality' | 'solvency' | 'cash';
export type FinancialsGrade = 'A' | 'B' | 'C' | 'D' | 'F';

/** 손익계산서 1행 (domain-neutral, 분석·표시 공용 핵심 필드). */
export interface IncomeStatementRow {
    fiscalYear: string;
    period: string;
    date: string;
    revenue: number | null;
    grossProfit: number | null;
    operatingIncome: number | null;
    netIncome: number | null;
    ebitda: number | null;
    eps: number | null;
    epsDiluted: number | null;
    grossMargin: number | null;       // 파생: grossProfit/revenue
    operatingMargin: number | null;   // 파생: operatingIncome/revenue
    netMargin: number | null;         // 파생: netIncome/revenue
}

/** 재무상태표 1행. */
export interface BalanceSheetRow {
    fiscalYear: string;
    period: string;
    date: string;
    totalAssets: number | null;
    totalCurrentAssets: number | null;
    totalLiabilities: number | null;
    totalCurrentLiabilities: number | null;
    cashAndShortTermInvestments: number | null;
    totalDebt: number | null;
    netDebt: number | null;
    totalStockholdersEquity: number | null;
    currentRatio: number | null;      // 파생: totalCurrentAssets/totalCurrentLiabilities
}

/** 현금흐름표 1행. fcfMargin은 income.revenue가 필요해 snapshot 정규화 단계에서 채운다. */
export interface CashFlowRow {
    fiscalYear: string;
    period: string;
    date: string;
    operatingCashFlow: number | null;
    capitalExpenditure: number | null;
    freeCashFlow: number | null;
    dividendsPaid: number | null;
    fcfMargin: number | null;
}

export interface IncomeGrowthRow {
    fiscalYear: string;
    period: string;
    growthRevenue: number | null;
    growthNetIncome: number | null;
    growthEPS: number | null;
    growthOperatingIncome: number | null;
}

export interface FinancialGrowthRow {
    fiscalYear: string;
    period: string;
    revenueGrowth: number | null;
    netIncomeGrowth: number | null;
    epsgrowth: number | null;
    freeCashFlowGrowth: number | null;
    operatingCashFlowGrowth: number | null;
    assetGrowth: number | null;
    debtGrowth: number | null;
    threeYRevenueGrowthPerShare: number | null;
    fiveYRevenueGrowthPerShare: number | null;
    tenYRevenueGrowthPerShare: number | null;
}

export interface CashFlowGrowthRow {
    fiscalYear: string;
    period: string;
    growthOperatingCashFlow: number | null;
    growthFreeCashFlow: number | null;
    growthCapitalExpenditure: number | null;
}

/** computeFinancialsScorecard 입력. 각 배열은 최신→과거 정렬(0=최신). */
export interface FinancialsSnapshot {
    income: IncomeStatementRow[];
    balance: BalanceSheetRow[];
    cashFlow: CashFlowRow[];
    incomeGrowth: IncomeGrowthRow[];
    financialGrowth: FinancialGrowthRow[];
    cashFlowGrowth: CashFlowGrowthRow[];
}

export interface FinancialSignal {
    type: string;
    direction: 'positive' | 'negative' | 'neutral';
    labelKo: string;
}

export interface ScoreMetric {
    labelKo: string;
    value: number | null;
    unit: 'pct' | 'ratio' | 'usd' | 'score';
}

export interface AxisScore {
    score: number;            // 0–100
    grade: FinancialsGrade;
    signals: FinancialSignal[];
    metrics: ScoreMetric[];
}

export interface FinancialsScorecard {
    growth: AxisScore;
    quality: AxisScore;
    solvency: AxisScore;
    cash: AxisScore;
    composite: { score: number; grade: FinancialsGrade; summaryKo: string };
}

// ─── AI 분석 응답 (LLM) ───
export interface FinancialsAxisAssessment {
    axis: FinancialsAxis;
    sentiment: FinancialsSentiment;
    rationaleKo: string;
}

export interface FinancialsAnalysisResponse {
    overallConclusionKo: string;
    axisAssessments: FinancialsAxisAssessment[];
    riskFactorsKo: string[];
    overallSentiment: FinancialsSentiment;
}

// ─── Raw (LLM 미검증 출력) ───
export interface RawFinancialsAxisAssessment {
    axis?: unknown;
    sentiment?: unknown;
    rationaleKo?: unknown;
}
export interface RawFinancialsAnalysisResponse {
    overallConclusionKo?: unknown;
    axisAssessments?: unknown;
    riskFactorsKo?: unknown;
    overallSentiment?: unknown;
}

/** normalizeFinancialsSnapshot 입력 (어댑터가 채운 domain-neutral 묶음). */
export interface NormalizeFinancialsSnapshotInput {
    income: IncomeStatementRow[];
    balance: BalanceSheetRow[];
    cashFlow: CashFlowRow[];
    incomeGrowth: IncomeGrowthRow[];
    financialGrowth: FinancialGrowthRow[];
    cashFlowGrowth: CashFlowGrowthRow[];
}
```

- [ ] **Step 2: 타입 컴파일 확인**

Run: `yarn typecheck`
Expected: PASS (타입만 추가, 사용처 없음).

- [ ] **Step 3: Commit**

```bash
git add src/domain/types.ts
git commit -m "feat(financials): add domain types (rows, snapshot, scorecard, response)"
```

---

## Task 2: FinancialStatementsProvider port

**Files:**
- Create: `src/domain/ports/financialStatementsProvider.ts`
- Test: (port는 interface라 테스트 없음; coverage exclude `src/domain/ports/**`)

- [ ] **Step 1: port 인터페이스 작성** (`fundamentalDataProvider.ts` 패턴)

```typescript
import type {
    BalanceSheetRow,
    CashFlowGrowthRow,
    CashFlowRow,
    FinancialGrowthRow,
    IncomeGrowthRow,
    IncomeStatementRow,
    StatementPeriod,
} from '@/domain/types';

/**
 * 재무제표 시계열 provider 포트. 어댑터(siglens FMP client)가 구현한다.
 * 각 메서드는 domain-neutral Row 배열을 최신→과거 순으로 반환하며,
 * 데이터 부재 시 빈 배열을 반환한다(throw는 인프라 장애에 한함).
 */
export interface FinancialStatementsProvider {
    getIncomeStatements(symbol: string, period: StatementPeriod, limit: number): Promise<IncomeStatementRow[]>;
    getBalanceSheets(symbol: string, period: StatementPeriod, limit: number): Promise<BalanceSheetRow[]>;
    getCashFlowStatements(symbol: string, period: StatementPeriod, limit: number): Promise<CashFlowRow[]>;
    getIncomeStatementGrowths(symbol: string, period: StatementPeriod, limit: number): Promise<IncomeGrowthRow[]>;
    getFinancialGrowths(symbol: string, period: StatementPeriod, limit: number): Promise<FinancialGrowthRow[]>;
    getCashFlowGrowths(symbol: string, period: StatementPeriod, limit: number): Promise<CashFlowGrowthRow[]>;
}
```

- [ ] **Step 2: typecheck + Commit**

Run: `yarn typecheck` → PASS
```bash
git add src/domain/ports/financialStatementsProvider.ts
git commit -m "feat(financials): add FinancialStatementsProvider port"
```

---

## Task 3: normalizeFinancialsAnalysisResponse (LLM 방어 정규화)

**Files:**
- Create: `src/domain/analysis/normalizeFinancials.ts`
- Test: `src/__tests__/domain/analysis/normalizeFinancials.test.ts`

`normalizeFundamental.ts`의 정확한 미러. 공용 헬퍼 `asArray/asEnum/asObject/asString/compact`(`./normalizePrimitives`)와 `extractJsonFromLlmResponse`(`./promptFormat`) 재사용.

- [ ] **Step 1: 실패 테스트 작성** (`normalizeFundamental.test.ts`의 8개 케이스 패턴 미러)

```typescript
import { describe, it, expect } from 'vitest';
import { normalizeFinancialsAnalysisResponse } from '@/domain/analysis/normalizeFinancials';

describe('normalizeFinancialsAnalysisResponse', () => {
    it('parses a valid object payload', () => {
        const r = normalizeFinancialsAnalysisResponse({
            overallConclusionKo: '현금흐름 견조',
            axisAssessments: [{ axis: 'growth', sentiment: 'bullish', rationaleKo: '매출 가속' }],
            riskFactorsKo: ['부채 증가'],
            overallSentiment: 'bullish',
        });
        expect(r.overallConclusionKo).toBe('현금흐름 견조');
        expect(r.axisAssessments).toEqual([{ axis: 'growth', sentiment: 'bullish', rationaleKo: '매출 가속' }]);
        expect(r.overallSentiment).toBe('bullish');
    });

    it('strips ```json fences before parsing', () => {
        const r = normalizeFinancialsAnalysisResponse('```json\n{"overallConclusionKo":"x","overallSentiment":"neutral"}\n```');
        expect(r.overallConclusionKo).toBe('x');
    });

    it('defaults missing fields', () => {
        const r = normalizeFinancialsAnalysisResponse({});
        expect(r).toEqual({ overallConclusionKo: '', axisAssessments: [], riskFactorsKo: [], overallSentiment: 'neutral' });
    });

    it('drops malformed axis entries and falls back invalid enums', () => {
        const r = normalizeFinancialsAnalysisResponse({
            axisAssessments: [null, 'x', { axis: 'WRONG', sentiment: 'WRONG', rationaleKo: 5 }],
        });
        expect(r.axisAssessments).toEqual([{ axis: 'growth', sentiment: 'neutral', rationaleKo: '' }]);
    });

    it('filters empty strings from riskFactorsKo', () => {
        const r = normalizeFinancialsAnalysisResponse({ riskFactorsKo: ['a', '', '  '] });
        expect(r.riskFactorsKo).toEqual(['a', '  ']); // 빈 문자열만 제거, 공백 보존
    });

    it('throws SyntaxError on invalid JSON string', () => {
        expect(() => normalizeFinancialsAnalysisResponse('{not json')).toThrow(SyntaxError);
    });

    it('defaults all fields for non-object input', () => {
        expect(normalizeFinancialsAnalysisResponse(42).overallSentiment).toBe('neutral');
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn vitest run src/__tests__/domain/analysis/normalizeFinancials.test.ts`
Expected: FAIL ("Cannot find module '@/domain/analysis/normalizeFinancials'").

- [ ] **Step 3: 구현** (`normalizeFundamental.ts` 미러)

```typescript
import type {
    FinancialsAnalysisResponse,
    FinancialsAxis,
    FinancialsAxisAssessment,
    FinancialsSentiment,
    RawFinancialsAnalysisResponse,
    RawFinancialsAxisAssessment,
} from '@/domain/types';
import { asArray, asEnum, asObject, asString, compact } from './normalizePrimitives';
import { extractJsonFromLlmResponse } from './promptFormat';

const VALID_SENTIMENTS: readonly FinancialsSentiment[] = ['bullish', 'neutral', 'bearish'];
const VALID_AXES: readonly FinancialsAxis[] = ['growth', 'quality', 'solvency', 'cash'];

function parseLlmPayload(raw: unknown): unknown {
    return typeof raw === 'string' ? extractJsonFromLlmResponse(raw) : raw;
}
function normalizeStringArray(raw: unknown): string[] {
    return asArray(raw).map(item => asString(item)).filter(item => item.length > 0);
}
function normalizeSentiment(value: unknown): FinancialsSentiment {
    return asEnum(value, VALID_SENTIMENTS, 'neutral');
}
function normalizeAxis(value: unknown): FinancialsAxis {
    return asEnum(value, VALID_AXES, 'growth');
}
function normalizeAxisAssessment(item: unknown): FinancialsAxisAssessment | null {
    const o = asObject(item) as RawFinancialsAxisAssessment | null;
    if (!o) return null;
    return { axis: normalizeAxis(o.axis), sentiment: normalizeSentiment(o.sentiment), rationaleKo: asString(o.rationaleKo) };
}

/**
 * @internal 재무 LLM 응답을 typed {@link FinancialsAnalysisResponse}로 방어 정규화.
 * 마크다운 펜스 제거 → JSON.parse → 누락 string→'', array→[], invalid enum→기본값, malformed child 드롭.
 * @throws {SyntaxError} 펜스 제거 후에도 JSON이 아닐 때.
 */
export function normalizeFinancialsAnalysisResponse(raw: unknown): FinancialsAnalysisResponse {
    const parsed = parseLlmPayload(raw);
    const o = (asObject(parsed) ?? {}) as RawFinancialsAnalysisResponse;
    return {
        overallConclusionKo: asString(o.overallConclusionKo),
        axisAssessments: compact(asArray(o.axisAssessments).map(normalizeAxisAssessment)),
        riskFactorsKo: normalizeStringArray(o.riskFactorsKo),
        overallSentiment: normalizeSentiment(o.overallSentiment),
    };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `yarn vitest run src/__tests__/domain/analysis/normalizeFinancials.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/analysis/normalizeFinancials.ts src/__tests__/domain/analysis/normalizeFinancials.test.ts
git commit -m "feat(financials): add normalizeFinancialsAnalysisResponse with defensive parsing"
```

---

## Task 4: normalizeFinancialsSnapshot

**Files:**
- Create: `src/domain/analysis/normalizeFinancialsSnapshot.ts`
- Test: `src/__tests__/domain/analysis/normalizeFinancialsSnapshot.test.ts`

입력 Row를 그대로 snapshot에 담되, **파생 필드(마진·currentRatio·fcfMargin)를 계산**해 채운다(어댑터가 못 채운 경우 보강). 항상 구조적으로 완전한 snapshot 반환.

- [ ] **Step 1: 실패 테스트 작성**

```typescript
import { describe, it, expect } from 'vitest';
import { normalizeFinancialsSnapshot } from '@/domain/analysis/normalizeFinancialsSnapshot';
import type { NormalizeFinancialsSnapshotInput } from '@/domain/types';

const base: NormalizeFinancialsSnapshotInput = {
    income: [{ fiscalYear: '2025', period: 'FY', date: '2025-09-27', revenue: 1000, grossProfit: 400,
        operatingIncome: 300, netIncome: 200, ebitda: 350, eps: 6, epsDiluted: 5.9,
        grossMargin: null, operatingMargin: null, netMargin: null }],
    balance: [{ fiscalYear: '2025', period: 'FY', date: '2025-09-27', totalAssets: 5000, totalCurrentAssets: 1500,
        totalLiabilities: 3000, totalCurrentLiabilities: 1000, cashAndShortTermInvestments: 800,
        totalDebt: 1200, netDebt: 400, totalStockholdersEquity: 2000, currentRatio: null }],
    cashFlow: [{ fiscalYear: '2025', period: 'FY', date: '2025-09-27', operatingCashFlow: 350,
        capitalExpenditure: -50, freeCashFlow: 300, dividendsPaid: -40, fcfMargin: null }],
    incomeGrowth: [], financialGrowth: [], cashFlowGrowth: [],
};

describe('normalizeFinancialsSnapshot', () => {
    it('computes derived margins when missing', () => {
        const s = normalizeFinancialsSnapshot(base);
        expect(s.income[0].grossMargin).toBeCloseTo(40);     // 400/1000*100
        expect(s.income[0].netMargin).toBeCloseTo(20);
        expect(s.balance[0].currentRatio).toBeCloseTo(1.5);  // 1500/1000
        expect(s.cashFlow[0].fcfMargin).toBeCloseTo(30);     // 300/1000*100
    });

    it('keeps existing derived values when already present', () => {
        const s = normalizeFinancialsSnapshot({ ...base, income: [{ ...base.income[0], grossMargin: 99 }] });
        expect(s.income[0].grossMargin).toBe(99);
    });

    it('leaves derived null when inputs missing', () => {
        const s = normalizeFinancialsSnapshot({ ...base,
            income: [{ ...base.income[0], revenue: null }],
            balance: [{ ...base.balance[0], totalCurrentLiabilities: null }] });
        expect(s.income[0].grossMargin).toBeNull();
        expect(s.balance[0].currentRatio).toBeNull();
        expect(s.cashFlow[0].fcfMargin).toBeNull(); // revenue null
    });

    it('returns structurally complete snapshot for empty input', () => {
        const s = normalizeFinancialsSnapshot({ income: [], balance: [], cashFlow: [], incomeGrowth: [], financialGrowth: [], cashFlowGrowth: [] });
        expect(s).toEqual({ income: [], balance: [], cashFlow: [], incomeGrowth: [], financialGrowth: [], cashFlowGrowth: [] });
    });
});
```

- [ ] **Step 2: 실패 확인** — Run: `yarn vitest run src/__tests__/domain/analysis/normalizeFinancialsSnapshot.test.ts` → FAIL

- [ ] **Step 3: 구현**

```typescript
import type {
    BalanceSheetRow, CashFlowRow, FinancialsSnapshot, IncomeStatementRow,
    NormalizeFinancialsSnapshotInput,
} from '@/domain/types';

const pct = (num: number | null, den: number | null): number | null =>
    num == null || den == null || den === 0 ? null : (num / den) * 100;
const ratio = (num: number | null, den: number | null): number | null =>
    num == null || den == null || den === 0 ? null : num / den;

function withIncomeDerived(r: IncomeStatementRow): IncomeStatementRow {
    return {
        ...r,
        grossMargin: r.grossMargin ?? pct(r.grossProfit, r.revenue),
        operatingMargin: r.operatingMargin ?? pct(r.operatingIncome, r.revenue),
        netMargin: r.netMargin ?? pct(r.netIncome, r.revenue),
    };
}
function withBalanceDerived(r: BalanceSheetRow): BalanceSheetRow {
    return { ...r, currentRatio: r.currentRatio ?? ratio(r.totalCurrentAssets, r.totalCurrentLiabilities) };
}
function withCashDerived(r: CashFlowRow, revenueByYear: Map<string, number | null>): CashFlowRow {
    return { ...r, fcfMargin: r.fcfMargin ?? pct(r.freeCashFlow, revenueByYear.get(r.fiscalYear) ?? null) };
}

export function normalizeFinancialsSnapshot(input: NormalizeFinancialsSnapshotInput): FinancialsSnapshot {
    const income = input.income.map(withIncomeDerived);
    const revenueByYear = new Map(income.map(r => [r.fiscalYear, r.revenue]));
    return {
        income,
        balance: input.balance.map(withBalanceDerived),
        cashFlow: input.cashFlow.map(r => withCashDerived(r, revenueByYear)),
        incomeGrowth: input.incomeGrowth,
        financialGrowth: input.financialGrowth,
        cashFlowGrowth: input.cashFlowGrowth,
    };
}
```

- [ ] **Step 4: 통과 확인** — Run 동일 → PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/analysis/normalizeFinancialsSnapshot.ts src/__tests__/domain/analysis/normalizeFinancialsSnapshot.test.ts
git commit -m "feat(financials): add normalizeFinancialsSnapshot with derived margins"
```

---

## Task 5: computeFinancialsScorecard (룰 점수 4축)

**Files:**
- Create: `src/domain/analysis/financialsScorecard.ts`
- Test: `src/__tests__/domain/analysis/financialsScorecard.test.ts`

순수 함수. 각 축은 0–100 점수 + 등급 + 시그널 + 표시 metrics. 임계값은 도메인 상수(아래 표; `refs/theory`·`refs/indicators`로 보정 가능).

**축별 산식 (0–100, 가중 평균):**

| 축 | 입력 | 점수 규칙(요지) |
|---|---|---|
| growth | financialGrowth[0].revenueGrowth·netIncomeGrowth·epsgrowth·freeCashFlowGrowth + 일관성(양수 연도 비율) | 각 성장률 구간 점수(≥0.20→100, ≥0.10→75, ≥0.05→55, ≥0→40, <0→15) 평균 × 0.7 + 일관성(양수비율×100) × 0.3 |
| quality | income[0].netMargin·operatingMargin + 마진추세(최근>과거) + accruals(OCF/netIncome) | 마진수준(netMargin≥20→100…) + 추세(개선+15/악화−15) + accruals(≥1.0→+20, <0.8→−20), clamp 0–100 |
| solvency | balance[0].currentRatio·netDebt + debtRatio(=totalLiabilities/totalAssets) + 부채추세(debtGrowth) | currentRatio(≥2→100…) + netDebt<0(순현금 +20) + debtRatio(≤0.4→100…) 평균, 부채증가 시 −10 |
| cash | cashFlow fcfMargin + FCF 양수 일관성 + OCF→FCF 전환(FCF/OCF) + CapEx 강도(CapEx/revenue) | fcfMargin 구간 + FCF 양수비율 + 전환율(≥0.7→100…), CapEx 과대(>0.15) 시 −10 |

등급: `score>=80?'A':>=65?'B':>=50?'C':>=35?'D':'F'`. composite = 4축 평균. **데이터 부족 지표는 가중치에서 제외**(점수 0 오염 금지) — null 지표는 평균 계산에서 빠진다.

- [ ] **Step 1: 실패 테스트 작성** (대표 케이스 — happy + worst)

```typescript
import { describe, it, expect } from 'vitest';
import { computeFinancialsScorecard } from '@/domain/analysis/financialsScorecard';
import type { FinancialsSnapshot } from '@/domain/types';

function snap(p: Partial<FinancialsSnapshot> = {}): FinancialsSnapshot {
    return { income: [], balance: [], cashFlow: [], incomeGrowth: [], financialGrowth: [], cashFlowGrowth: [], ...p };
}

describe('computeFinancialsScorecard', () => {
    it('grades a strong company high (A/B)', () => {
        const sc = computeFinancialsScorecard(snap({
            income: [{ fiscalYear: '2025', period: 'FY', date: '', revenue: 1000, grossProfit: 450, operatingIncome: 320, netIncome: 250, ebitda: 360, eps: 7, epsDiluted: 7, grossMargin: 45, operatingMargin: 32, netMargin: 25 }],
            balance: [{ fiscalYear: '2025', period: 'FY', date: '', totalAssets: 5000, totalCurrentAssets: 2200, totalLiabilities: 1500, totalCurrentLiabilities: 800, cashAndShortTermInvestments: 1200, totalDebt: 600, netDebt: -600, totalStockholdersEquity: 3500, currentRatio: 2.75 }],
            cashFlow: [{ fiscalYear: '2025', period: 'FY', date: '', operatingCashFlow: 300, capitalExpenditure: -40, freeCashFlow: 260, dividendsPaid: -50, fcfMargin: 26 }],
            financialGrowth: [{ fiscalYear: '2025', period: 'FY', revenueGrowth: 0.22, netIncomeGrowth: 0.30, epsgrowth: 0.28, freeCashFlowGrowth: 0.25, operatingCashFlowGrowth: 0.2, assetGrowth: 0.1, debtGrowth: -0.05, threeYRevenueGrowthPerShare: null, fiveYRevenueGrowthPerShare: null, tenYRevenueGrowthPerShare: null }],
        }));
        expect(['A', 'B']).toContain(sc.composite.grade);
        expect(sc.solvency.signals.some(s => s.type === 'net_cash')).toBe(true);
    });

    it('returns deterministic F/empty for no data (worst case)', () => {
        const sc = computeFinancialsScorecard(snap());
        expect(sc.composite.score).toBe(0);
        expect(sc.composite.grade).toBe('F');
        expect(sc.growth.metrics.every(m => m.value === null)).toBe(true);
    });

    it('excludes null metrics from average (partial data)', () => {
        const sc = computeFinancialsScorecard(snap({
            income: [{ fiscalYear: '2025', period: 'FY', date: '', revenue: 1000, grossProfit: 400, operatingIncome: 300, netIncome: 200, ebitda: 350, eps: 6, epsDiluted: 6, grossMargin: 40, operatingMargin: 30, netMargin: 20 }],
        }));
        // growth/solvency/cash 데이터 없음 → 해당 축 0점이지만 quality는 계산됨
        expect(sc.quality.score).toBeGreaterThan(0);
    });
});
```

- [ ] **Step 2: 실패 확인** — Run: `yarn vitest run src/__tests__/domain/analysis/financialsScorecard.test.ts` → FAIL

- [ ] **Step 3: 구현** — `src/domain/analysis/financialsScorecard.ts`

각 축 scorer를 순수 함수로 작성하고 `computeFinancialsScorecard`가 조립한다. 핵심 헬퍼:

```typescript
import type {
    AxisScore, FinancialSignal, FinancialsGrade, FinancialsScorecard,
    FinancialsSnapshot, ScoreMetric,
} from '@/domain/types';

const grade = (s: number): FinancialsGrade => s >= 80 ? 'A' : s >= 65 ? 'B' : s >= 50 ? 'C' : s >= 35 ? 'D' : 'F';
/** null을 제외한 평균. 전부 null이면 0. */
const avg = (xs: (number | null)[]): number => {
    const v = xs.filter((x): x is number => x !== null);
    return v.length === 0 ? 0 : v.reduce((a, b) => a + b, 0) / v.length;
};
const clamp = (n: number): number => Math.max(0, Math.min(100, n));
/** 성장률(소수, 0.20=20%)을 구간 점수로. */
const growthBand = (g: number | null): number | null =>
    g == null ? null : g >= 0.20 ? 100 : g >= 0.10 ? 75 : g >= 0.05 ? 55 : g >= 0 ? 40 : 15;
```

각 축 함수(시그니처):
```typescript
function scoreGrowth(s: FinancialsSnapshot): AxisScore
function scoreQuality(s: FinancialsSnapshot): AxisScore
function scoreSolvency(s: FinancialsSnapshot): AxisScore
function scoreCash(s: FinancialsSnapshot): AxisScore
```
- `scoreGrowth`: `fg = s.financialGrowth[0]`; 성장 구간 점수 평균(`avg([growthBand(fg?.revenueGrowth), …])`) × 0.7 + 일관성(financialGrowth 중 revenueGrowth>0 비율 ×100) × 0.3. 시그널: 가속(`fg.revenueGrowth > s.financialGrowth[1]?.revenueGrowth` → `revenue_accel` positive), netIncomeGrowth>revenueGrowth → `operating_leverage` positive, 음수 성장 → `growth_decline` negative. metrics: revenueGrowth·netIncomeGrowth·epsgrowth·fcfGrowth(unit:'pct').
- `scoreQuality`: `inc = s.income[0]`; 마진 수준 점수 + 추세(`income[0].netMargin > income[1]?.netMargin` ? +15 : −15) + accruals(`ratio(cashFlow[0].operatingCashFlow, income[0].netIncome)` ≥1 → +20, <0.8 → −20), clamp. 시그널: `earnings_quality_good`/`accrual_warning`, `margin_expansion`/`margin_contraction`.
- `scoreSolvency`: `bs = s.balance[0]`; currentRatio 구간 + (netDebt<0 ? +20 signal `net_cash`) + debtRatio(=totalLiabilities/totalAssets) 구간, debtGrowth>0.1 → −10 signal `debt_rising`.
- `scoreCash`: fcfMargin 구간 + FCF 양수 비율(`cashFlow` 중 freeCashFlow>0) + 전환율 구간(`ratio(fcf,ocf)`), CapEx 강도(`abs(capex)/revenue`>0.15 → −10 `capex_heavy`). 시그널 `fcf_solid`/`fcf_negative`.

조립:
```typescript
export function computeFinancialsScorecard(s: FinancialsSnapshot): FinancialsScorecard {
    const growth = scoreGrowth(s), quality = scoreQuality(s), solvency = scoreSolvency(s), cash = scoreCash(s);
    const compositeScore = Math.round(avg([growth.score, quality.score, solvency.score, cash.score]));
    return {
        growth, quality, solvency, cash,
        composite: { score: compositeScore, grade: grade(compositeScore), summaryKo: buildSummaryKo(growth, quality, solvency, cash) },
    };
}
```
`buildSummaryKo`는 최고/최저 축 등급으로 룰 기반 한 줄(예: `"현금흐름 견조(${cash.grade}), 성장성 우수(${growth.grade})"`).

> 각 scorer는 입력이 비면 `score:0, grade:'F', signals:[], metrics:[null들]`을 반환(worst case 결정론적). 모든 metric value는 `null` 허용.

- [ ] **Step 4: 통과 확인** — Run 동일 → PASS. 추가로 각 축 경계값 테스트를 보강해 **branch 커버리지 90%** 확보(구간별 1케이스씩).

- [ ] **Step 5: Commit**

```bash
git add src/domain/analysis/financialsScorecard.ts src/__tests__/domain/analysis/financialsScorecard.test.ts
git commit -m "feat(financials): add computeFinancialsScorecard (4-axis deterministic scoring)"
```

---

## Task 6: buildFinancialsAnalysisPrompt

**Files:**
- Create: `src/domain/analysis/financialsPrompt.ts`
- Test: `src/__tests__/domain/analysis/financialsPrompt.test.ts`

`fundamentalPrompt.ts` 패턴. 입력 `(symbol, snapshot, scorecard, skills)`. 스코어카드(점수·시그널)를 프롬프트에 주입(룰+AI 결합). skills는 `category === 'fundamental'` 필터(스펙 결정: 신규 category 대신 fundamental 재사용).

- [ ] **Step 1: 실패 테스트**

```typescript
import { describe, it, expect } from 'vitest';
import { buildFinancialsAnalysisPrompt } from '@/domain/analysis/financialsPrompt';
import { computeFinancialsScorecard } from '@/domain/analysis/financialsScorecard';
import type { FinancialsSnapshot } from '@/domain/types';

const empty: FinancialsSnapshot = { income: [], balance: [], cashFlow: [], incomeGrowth: [], financialGrowth: [], cashFlowGrowth: [] };

describe('buildFinancialsAnalysisPrompt', () => {
    it('includes symbol, scorecard grades, and JSON schema fields', () => {
        const p = buildFinancialsAnalysisPrompt('AAPL', empty, computeFinancialsScorecard(empty), []);
        expect(p).toContain('AAPL');
        expect(p).toContain('axisAssessments');
        expect(p).toContain('overallSentiment');
        expect(p).toMatch(/growth|quality|solvency|cash/);
    });
    it('only injects fundamental-category skills', () => {
        const p = buildFinancialsAnalysisPrompt('AAPL', empty, computeFinancialsScorecard(empty), [
            { name: 'KeepMe', description: '', indicators: [], confidenceWeight: 1, content: 'FIN_SKILL', category: 'fundamental' },
            { name: 'DropMe', description: '', indicators: [], confidenceWeight: 1, content: 'TECH_SKILL', category: 'reversal_bullish' },
        ]);
        expect(p).toContain('FIN_SKILL');
        expect(p).not.toContain('TECH_SKILL');
    });
});
```

- [ ] **Step 2: 실패 확인** → FAIL

- [ ] **Step 3: 구현** — snapshot 섹션(손익/재무상태/현금흐름/성장 표) + scorecard 섹션(4축 점수·등급·시그널) + skills(`category==='fundamental'`) + JSON 출력 스키마(`overallConclusionKo`, `axisAssessments[{axis,sentiment,rationaleKo}]`, `riskFactorsKo`, `overallSentiment`) + "Korean output only" 규칙. 영어 프롬프트.

- [ ] **Step 4: 통과 확인** → PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/analysis/financialsPrompt.ts src/__tests__/domain/analysis/financialsPrompt.test.ts
git commit -m "feat(financials): add buildFinancialsAnalysisPrompt (scorecard-injected)"
```

---

## Task 7: cache key + system prompt + response schema 상수

**Files:**
- Modify: `src/infrastructure/cache/config.ts` (`buildFinancialsCacheKey`, `FINANCIALS_PROMPT_TEMPLATE_VERSION`)
- Modify: `src/domain/analysis/systemPrompt.ts` (`FINANCIALS_SYSTEM_PROMPT`)
- Modify: `src/domain/analysis/responseSchemas.ts` (`FINANCIALS_RESPONSE_SCHEMA`)
- Test: `src/__tests__/infrastructure/cache/config.test.ts`(있으면 보강) 또는 신규

- [ ] **Step 1: 실패 테스트(cache key)**

```typescript
import { describe, it, expect } from 'vitest';
import { buildFinancialsCacheKey } from '@/infrastructure/cache/config';

describe('buildFinancialsCacheKey', () => {
    it('includes schema version, symbol, model, prompt version', () => {
        const k = buildFinancialsCacheKey('AAPL', 'gemini-2.5-flash', 'sk1');
        expect(k).toContain(':analysis:financials:AAPL:gemini-2.5-flash:');
        expect(k.endsWith(':sk1')).toBe(true);
    });
    it('omits fingerprint segment when absent', () => {
        expect(buildFinancialsCacheKey('AAPL', 'gemini-2.5-flash')).not.toMatch(/:sk1$/);
    });
});
```

- [ ] **Step 2: 실패 확인** → FAIL

- [ ] **Step 3: 구현**

`config.ts`:
```typescript
export const FINANCIALS_PROMPT_TEMPLATE_VERSION = 'p1' as const;
export function buildFinancialsCacheKey(symbol: string, modelId: string, skillFingerprint?: string): string {
    const base = `${CACHE_KEY_SCHEMA_VERSION}:analysis:financials:${symbol}:${modelId}:${FINANCIALS_PROMPT_TEMPLATE_VERSION}`;
    return skillFingerprint !== undefined ? `${base}:${skillFingerprint}` : base;
}
export const FINANCIALS_CACHE_TTL_SECONDS = SECONDS_PER_DAY; // 24h (재무는 분기성)
```
`systemPrompt.ts`: `FUNDAMENTAL_SYSTEM_PROMPT` 미러로 `FINANCIALS_SYSTEM_PROMPT`(재무제표 추세·이익의 질 관점, Korean output).
`responseSchemas.ts`: `FINANCIALS_RESPONSE_SCHEMA`(overallConclusionKo, axisAssessments[axis·sentiment·rationaleKo], riskFactorsKo, overallSentiment).

- [ ] **Step 4: 통과 확인** → PASS

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/cache/config.ts src/domain/analysis/systemPrompt.ts src/domain/analysis/responseSchemas.ts src/__tests__/infrastructure/cache/config.test.ts
git commit -m "feat(financials): add cache key, system prompt, response schema constants"
```

---

## Task 8: submitFinancialsAnalysis

**Files:**
- Create: `src/application/financials/submitFinancialsAnalysis.ts`
- Create: `src/application/financials/types.ts`
- Test: `src/__tests__/application/financials/submitFinancialsAnalysis.test.ts`

`submitFundamentalAnalysis.ts` 미러. provider는 `FinancialStatementsProvider`. flow: BYOK gate → usage gate → skill fingerprint → cache key → cache lookup(force 아니면) → skipEnqueueIfMiss → provider fetch(6종 병렬, annual limit) → normalizeFinancialsSnapshot → computeFinancialsScorecard → buildFinancialsAnalysisPrompt → job enqueue(worker POST, `analysisType:'financials'`) → usage record → `{status:'submitted', jobId}`.

- [ ] **Step 1: application types** (`types.ts`)

```typescript
import type { BackgroundTaskOptions } from '@/application/types';
import type { FinancialStatementsProvider } from '@/domain/ports/financialStatementsProvider';
import type { AnalysisUsageOptions } from '@/application/usage/types';
import type { FinancialsAnalysisResponse, ModelId, Tier, TierConfig } from '@/domain/types';
// ... (UserApiKeyRequiredError, AnalysisLimitError 재사용)

export interface SubmitFinancialsAnalysisOptions extends BackgroundTaskOptions {
    symbol: string;
    modelId: ModelId;
    dataProvider: FinancialStatementsProvider;
    tier?: Tier; tierConfig?: TierConfig; usage?: AnalysisUsageOptions;
    now?: Date; userApiKey?: string; skipEnqueueIfMiss?: boolean; force?: boolean;
    period?: 'annual'; limit?: number; // 기본 annual, limit=5
}
export type SubmitFinancialsAnalysisResult =
    | { status: 'cached'; result: FinancialsAnalysisResponse }
    | { status: 'submitted'; jobId: string }
    | { status: 'miss_no_trigger' }
    | { status: 'error'; code: 'usage_limit_exceeded'; error: import('@/domain/types').AnalysisLimitError }
    | { status: 'error'; code: 'fetch_failed'; error?: string }
    | import('@/application/byok/types').UserApiKeyRequiredError;
export type PollFinancialsAnalysisResult =
    | { status: 'processing' }
    | { status: 'done'; result: FinancialsAnalysisResponse }
    | { status: 'error'; error: string };
```

- [ ] **Step 2: 실패 테스트** (mock infra — cache/jobs/skills/fetch; `submitFundamentalAnalysis.test.ts` 패턴)

핵심 케이스(happy + worst):
```
- cache HIT → {status:'cached'} (provider 미호출)
- cache MISS + skipEnqueueIfMiss → {status:'miss_no_trigger'} (provider 미호출)
- cache MISS → provider 6종 호출 → worker POST 1회 → {status:'submitted', jobId}
- usage 초과 → {status:'error', code:'usage_limit_exceeded'}
- BYOK 필요(premium tier 키 없음) → UserApiKeyRequiredError
- provider throw → {status:'error', code:'fetch_failed'}
```
Run: `yarn vitest run src/__tests__/application/financials/submitFinancialsAnalysis.test.ts` → FAIL

- [ ] **Step 3: 구현** — `submitFundamentalAnalysis.ts`를 1:1 미러. `fetchProviderData`는 6 메서드 `Promise.all`(annual, limit) → `normalizeFinancialsSnapshot` → `computeFinancialsScorecard`. prompt에 scorecard 주입. worker body `analysisType:'financials'`, `system:FINANCIALS_SYSTEM_PROMPT`, `responseSchema:FINANCIALS_RESPONSE_SCHEMA`. cache key `buildFinancialsCacheKey`.

> 잡 meta에 `scorecard`를 함께 저장(poll에서 응답에 합치거나, siglens가 별도로 SSR 계산하므로 meta엔 불필요 — 본 plan은 scorecard를 siglens RSC에서 동기 계산하므로 core 잡은 AI 텍스트만 담당. meta엔 cacheKey만).

- [ ] **Step 4: 통과 확인** → PASS (6 케이스)

- [ ] **Step 5: Commit**

```bash
git add src/application/financials/submitFinancialsAnalysis.ts src/application/financials/types.ts src/__tests__/application/financials/submitFinancialsAnalysis.test.ts
git commit -m "feat(financials): add submitFinancialsAnalysis use-case"
```

---

## Task 9: pollFinancialsAnalysis + cancelFinancialsAnalysisJob

**Files:**
- Create: `src/application/financials/pollFinancialsAnalysis.ts`
- Create: `src/application/financials/cancelFinancialsAnalysisJob.ts`
- Test: `src/__tests__/application/financials/pollFinancialsAnalysis.test.ts`

- [ ] **Step 1: 실패 테스트** (`pollFundamentalAnalysis.test.ts` 패턴)

```
- job processing/null → {status:'processing'}
- job error → {status:'error', error} + cleanup
- job done → normalizeFinancialsAnalysisResponse(rawResult) → cache.set(meta.cacheKey, FINANCIALS_CACHE_TTL_SECONDS) → {status:'done', result}
- job done but empty result → warn, 여전히 done
- worst: rawResult가 깨진 JSON → SyntaxError 전파(normalize 계약)
```
Run → FAIL

- [ ] **Step 2: 구현** — `pollFundamentalAnalysis.ts` 미러. normalize는 `normalizeFinancialsAnalysisResponse`. cancel은 `export { cancelAnalysisJob as cancelFinancialsAnalysisJob } from '@/application/market/cancelAnalysisJob';`

- [ ] **Step 3: 통과 확인** → PASS

- [ ] **Step 4: Commit**

```bash
git add src/application/financials/pollFinancialsAnalysis.ts src/application/financials/cancelFinancialsAnalysisJob.ts src/__tests__/application/financials/pollFinancialsAnalysis.test.ts
git commit -m "feat(financials): add poll + cancel financials analysis"
```

---

## Task 10: barrel export + index 테스트 + 빌드 검증

**Files:**
- Modify: `src/index.ts`
- Modify: `src/__tests__/index.test.ts`

- [ ] **Step 1: barrel에 export 추가**

`src/index.ts`:
```typescript
// Tier 1 — financials entrypoints
export { submitFinancialsAnalysis } from './application/financials/submitFinancialsAnalysis';
export { pollFinancialsAnalysis } from './application/financials/pollFinancialsAnalysis';
export { cancelFinancialsAnalysisJob } from './application/financials/cancelFinancialsAnalysisJob';
// Tier 2 — financials domain building blocks
export { computeFinancialsScorecard } from './domain/analysis/financialsScorecard';
export { normalizeFinancialsAnalysisResponse } from './domain/analysis/normalizeFinancials';
export { normalizeFinancialsSnapshot } from './domain/analysis/normalizeFinancialsSnapshot';
export { buildFinancialsAnalysisPrompt } from './domain/analysis/financialsPrompt';
// Tier 4 — financials types + port
export type { FinancialStatementsProvider } from './domain/ports/financialStatementsProvider';
export type {
    StatementPeriod, FinancialsSentiment, FinancialsAxis, FinancialsGrade,
    IncomeStatementRow, BalanceSheetRow, CashFlowRow, IncomeGrowthRow, FinancialGrowthRow, CashFlowGrowthRow,
    FinancialsSnapshot, FinancialSignal, ScoreMetric, AxisScore, FinancialsScorecard,
    FinancialsAxisAssessment, FinancialsAnalysisResponse,
    RawFinancialsAnalysisResponse, RawFinancialsAxisAssessment, NormalizeFinancialsSnapshotInput,
} from './domain/types';
export type {
    SubmitFinancialsAnalysisOptions, SubmitFinancialsAnalysisResult, PollFinancialsAnalysisResult,
} from './application/financials/types';
```

- [ ] **Step 2: index 테스트에 export assertion 추가**

`src/__tests__/index.test.ts`에 import + `expect(...).toBeDefined()`:
```typescript
import {
    submitFinancialsAnalysis, pollFinancialsAnalysis, cancelFinancialsAnalysisJob,
    computeFinancialsScorecard, normalizeFinancialsAnalysisResponse,
    normalizeFinancialsSnapshot, buildFinancialsAnalysisPrompt,
} from '@/index';
it('exports financials API', () => {
    [submitFinancialsAnalysis, pollFinancialsAnalysis, cancelFinancialsAnalysisJob,
     computeFinancialsScorecard, normalizeFinancialsAnalysisResponse,
     normalizeFinancialsSnapshot, buildFinancialsAnalysisPrompt].forEach(f => expect(f).toBeTypeOf('function'));
});
```

- [ ] **Step 3: 전체 검증 (typecheck + 커버리지 90% + 빌드)**

Run:
```bash
yarn typecheck
yarn test:coverage   # financials 신규 파일 lines/functions/branches/statements ≥ 90 확인
yarn build           # tsc + tsc-alias → dist 생성
```
Expected: 모두 PASS, 커버리지 임계 충족. 미달 시 해당 파일 분기 테스트 보강.

- [ ] **Step 4: Commit + 푸시(사용자 승인 후 git-agent)**

```bash
git add src/index.ts src/__tests__/index.test.ts
git commit -m "feat(financials): wire financials domain into public barrel"
```

> **푸시·머지·릴리스는 사용자/ git-agent 담당**(메모리: core publish는 사용자). Phase 2 완료 후 core를 함께 머지 → `yarn build` → siglens `node_modules/@y0ngha/siglens-core` overlay(Phase 3 진입 전).

---

## Self-Review (작성자 체크 결과)

- **스펙 커버리지**: §4.2 (1)~(5) port·Row·scorecard·AI잡·정규화 = Task 1~9. §6 cache key/PROMPT_VERSION = Task 7. ✅ overall/chat 통합(§4.8·4.9)은 **Phase 2**로 분리(이 plan 범위 밖, 의도적).
- **placeholder 스캔**: 4축 산식은 임계값 표 + 함수 시그니처 + 헬퍼 코드로 명세(축별 구현은 표의 규칙을 그대로 코드화). "repeat code" 회피 위해 각 축을 표로 완전 명세함.
- **타입 일관성**: `FinancialsAxis`('growth'|'quality'|'solvency'|'cash')가 scorecard·response·normalize에서 일치. `FinancialsScorecard` 필드명(growth/quality/solvency/cash/composite)이 Task 5·6·8에서 일치.
- **커버리지**: Task 5·8은 분기가 많아 경계값 테스트 보강 필요(Step 4에 명시).

---

## 후속 Phase (별도 plan 문서로 작성 예정)

- **Phase 2** `2026-06-15-financials-phase2-core-overall-chat.md` — `OverallDependencyInputs.financialsScorecard`, `OverallAnalysisResponse.financialsBulletsKo`, `buildOverallAnalysisPrompt` 파라미터·`formatFinancials`, `submitOverallAnalysis` 호출+해시, `CurrentAnalysisContext` financials kind, `buildChatPrompt` case, barrel/테스트.
- **Phase 3** siglens 데이터 계층 — `RawFmp*` 타입, `financialStatementsClient`(6 endpoint, fmpGet revalidate=`FMP_STATEMENTS_REVALIDATE_SECONDS`), `CachedFinancialStatementsProvider`(getOrSetCache 키·TTL·.catch null), `getFinancialStatementsProvider` 팩토리, `FakeFinancialStatementsProvider`.
- **Phase 4** siglens 페이지+UI — `financialData.ts`(staticSymbolCache), `page.tsx`(ISR 24h·generateStaticParams []·getProfileResilient), `widgets/financials/**`(Scorecard/AxisCard/Gauge/PeriodToggle/sections/AiSummary), InfoTooltip 용어.
- **Phase 5** siglens 액션+hook — `submit/poll/cancelFinancialsAnalysisAction`(isBot→skipEnqueueIfMiss, resolveTierAndByok, e2e stub), `useFinancialsAnalysis`, `buildChatState`, `useFinancialsPeriod`(분기 lazy fetch).
- **Phase 6** siglens 통합 — overall `FinancialsSummary`·액션 데이터 수집·hook, chat publish, 탭 등록, SEO(generateMetadata·JsonLd·OG·sitemap·CrossLink), `ISR_REVALIDATE.md`.
- **Phase 7** E2E — Playwright(Tier+resilience, FakeProvider, e2eCachedFinancials, FORCE_FINANCIALS_ERROR_COOKIE).
