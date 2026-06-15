# Financials Phase 3 — siglens 데이터 계층 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** siglens에 `FinancialStatementsProvider`(core port) 구현체 — FMP 어댑터·Redis 캐시 데코레이터·팩토리·E2E Fake를 추가한다.

**Architecture:** `fundamentalClient`/`CachedFundamentalProvider`/`getFundamentalDataProvider`/`FakeFundamentalDataProvider` 패턴을 1:1 미러. 2계층 캐시(Next Data Cache `fmpGet` revalidate + Redis `getOrSetCache`)가 **단일 TTL 상수**(`FMP_STATEMENTS_REVALIDATE_SECONDS`=24h) 공유.

**Tech Stack:** Next 16, TS, vitest 90%, Upstash Redis. **선행:** Phase 1·2 완료 + core overlay.

**상위 스펙:** `docs/superpowers/specs/2026-06-15-symbol-financials-tab-design.md` (§4.3, §4.6).

---

## Phase 0: 워크트리 + core overlay

- [ ] **Step 1: siglens 워크트리 생성**

```bash
cd /Users/y0ngha/Project/siglens
git worktree add ../siglens-financials -b feat/financials
cd /Users/y0ngha/Project/siglens-financials
```

- [ ] **Step 2: node_modules (하드링크, symlink 금지 — 메모리)**

```bash
cp -al /Users/y0ngha/Project/siglens/node_modules ./node_modules
rm -rf ./node_modules/node_modules 2>/dev/null || true
```

- [ ] **Step 3: core 빌드 산출물 overlay (릴리스 전 병목 최소화 — 사용자 결정)**

```bash
# Phase 1·2가 머지된 core를 빌드해 dist를 siglens 워크트리 node_modules에 덮어쓴다.
cd /Users/y0ngha/Project/siglens-core-financials && yarn build
rsync -a --delete dist/ /Users/y0ngha/Project/siglens-financials/node_modules/@y0ngha/siglens-core/dist/
cd /Users/y0ngha/Project/siglens-financials
```
> core가 아직 머지 전이면 `feat/financials-domain` 브랜치 빌드를 overlay. 최종 배포는 사용자가 core tag 릴리스 후 `package.json` 핀 갱신.

- [ ] **Step 4: baseline 확인**

Run: `yarn test src/shared/api/fmp` (기존 fmp 테스트 green) + `node -e "require('@y0ngha/siglens-core')"`(overlay 로드 확인 — 신규 export 존재).

---

## Task 1: FMP raw 응답 타입

**Files:**
- Create: `src/shared/api/fmp/financialStatements.types.ts`

- [ ] **Step 1: raw 타입 작성** (실 API 검증 필드 기준, 스펙 부록 A)

```typescript
/** FMP /income-statement raw row (subset 사용). */
export interface RawFmpIncomeStatement {
    fiscalYear?: string; period?: string; date?: string;
    revenue?: number; grossProfit?: number; operatingIncome?: number;
    netIncome?: number; ebitda?: number; eps?: number; epsDiluted?: number;
}
export interface RawFmpBalanceSheet {
    fiscalYear?: string; period?: string; date?: string;
    totalAssets?: number; totalCurrentAssets?: number; totalLiabilities?: number;
    totalCurrentLiabilities?: number; cashAndShortTermInvestments?: number;
    totalDebt?: number; netDebt?: number; totalStockholdersEquity?: number;
}
export interface RawFmpCashFlow {
    fiscalYear?: string; period?: string; date?: string;
    operatingCashFlow?: number; capitalExpenditure?: number; freeCashFlow?: number; dividendsPaid?: number;
}
export interface RawFmpIncomeGrowth {
    fiscalYear?: string; period?: string;
    growthRevenue?: number; growthNetIncome?: number; growthEPS?: number; growthOperatingIncome?: number;
}
export interface RawFmpFinancialGrowth {
    fiscalYear?: string; period?: string;
    revenueGrowth?: number; netIncomeGrowth?: number; epsgrowth?: number; freeCashFlowGrowth?: number;
    operatingCashFlowGrowth?: number; assetGrowth?: number; debtGrowth?: number;
    threeYRevenueGrowthPerShare?: number; fiveYRevenueGrowthPerShare?: number; tenYRevenueGrowthPerShare?: number;
}
export interface RawFmpCashFlowGrowth {
    fiscalYear?: string; period?: string;
    growthOperatingCashFlow?: number; growthFreeCashFlow?: number; growthCapitalExpenditure?: number;
}
```

- [ ] **Step 2: typecheck + Commit**

```bash
git add src/shared/api/fmp/financialStatements.types.ts
git commit -m "feat(financials): add FMP raw statement types"
```

---

## Task 2: TTL 상수

**Files:**
- Modify: `src/shared/config/time.ts`

- [ ] **Step 1: 상수 추가** — `src/shared/config/time.ts`:
```typescript
/** 재무제표는 분기(~45일) 단위라 길게. fmpGet revalidate + Redis TTL이 공유. */
export const FMP_STATEMENTS_REVALIDATE_SECONDS = SECONDS_PER_DAY; // 24h
```
- [ ] **Step 2: Commit**
```bash
git add src/shared/config/time.ts
git commit -m "feat(financials): add FMP_STATEMENTS_REVALIDATE_SECONDS (24h)"
```

---

## Task 3: FmpFinancialStatementsClient (어댑터)

**Files:**
- Create: `src/shared/api/fmp/financialStatementsClient.ts`
- Test: `src/shared/api/fmp/__tests__/financialStatementsClient.test.ts`

`fundamentalClient.ts` 패턴. `fmpGet`(revalidate=`FMP_STATEMENTS_REVALIDATE_SECONDS`), `toFiniteNumber`, raw→domain 매핑. 6 메서드.

- [ ] **Step 1: 실패 테스트** (fetch mock — happy + worst)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
// fmpGet을 mock하거나 global.fetch mock (기존 fundamentalClient 테스트 방식 따름)
import { FmpFinancialStatementsClient } from '../financialStatementsClient';

describe('FmpFinancialStatementsClient', () => {
    it('maps income statement raw → domain rows', async () => {
        // mock fmpGet → [{ fiscalYear:'2025', revenue:1000, grossProfit:400, ... }]
        const client = new FmpFinancialStatementsClient();
        const rows = await client.getIncomeStatements('AAPL', 'annual', 5);
        expect(rows[0].revenue).toBe(1000);
        expect(rows[0].grossProfit).toBe(400);
    });
    it('returns [] on empty FMP response', async () => {
        // mock fmpGet → []
        expect(await client.getBalanceSheets('AAPL', 'annual', 5)).toEqual([]);
    });
    it('coerces non-finite to null (worst)', async () => {
        // mock fmpGet → [{ revenue: NaN }]
        const rows = await client.getIncomeStatements('AAPL', 'annual', 5);
        expect(rows[0].revenue).toBeNull();
    });
    it('propagates FMP throw (no swallow)', async () => {
        // mock fmpGet → throw FmpHttpError(429)
        await expect(client.getCashFlowStatements('AAPL', 'annual', 5)).rejects.toThrow();
    });
});
```
Run: `yarn test src/shared/api/fmp/__tests__/financialStatementsClient.test.ts` → FAIL

- [ ] **Step 2: 구현** (대표 메서드 — 나머지 5개 동일 구조)

```typescript
import { fmpGet as fmpGetRaw } from './httpClient';
import { FMP_STATEMENTS_REVALIDATE_SECONDS } from '@/shared/config/time';
import type { FinancialStatementsProvider } from '@y0ngha/siglens-core';
import type { IncomeStatementRow, /* ... */ StatementPeriod } from '@y0ngha/siglens-core';
import type { RawFmpIncomeStatement /* ... */ } from './financialStatements.types';

function fmpGet<T>(path: string, q: Record<string, string> = {}): Promise<T> {
    return fmpGetRaw<T>(path, q, { revalidate: FMP_STATEMENTS_REVALIDATE_SECONDS });
}
const num = (v: number | undefined): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;

export class FmpFinancialStatementsClient implements FinancialStatementsProvider {
    async getIncomeStatements(symbol: string, period: StatementPeriod, limit: number): Promise<IncomeStatementRow[]> {
        const arr = await fmpGet<RawFmpIncomeStatement[]>('income-statement', { symbol, period, limit: String(limit) });
        return arr.map(r => ({
            fiscalYear: r.fiscalYear ?? '', period: r.period ?? '', date: r.date ?? '',
            revenue: num(r.revenue), grossProfit: num(r.grossProfit), operatingIncome: num(r.operatingIncome),
            netIncome: num(r.netIncome), ebitda: num(r.ebitda), eps: num(r.eps), epsDiluted: num(r.epsDiluted),
            grossMargin: null, operatingMargin: null, netMargin: null, // 파생은 core normalize가 채움
        }));
    }
    // getBalanceSheets('balance-sheet-statement'), getCashFlowStatements('cash-flow-statement'),
    // getIncomeStatementGrowths('income-statement-growth'), getFinancialGrowths('financial-growth'),
    // getCashFlowGrowths('cash-flow-statement-growth') — 동일 구조로 각 raw→Row 매핑.
}
```
> 6 메서드 각각 endpoint·필드 매핑은 Task 1 raw 타입 + Phase 1 Row 타입에 1:1 대응. 파생 필드(margin/currentRatio/fcfMargin)는 `null`로 두고 core `normalizeFinancialsSnapshot`이 계산.

- [ ] **Step 3: 통과 확인** → PASS (6 메서드 happy + worst 케이스). 각 endpoint별 매핑 테스트 추가로 커버리지 90%.

- [ ] **Step 4: Commit**

```bash
git add src/shared/api/fmp/financialStatementsClient.ts src/shared/api/fmp/__tests__/financialStatementsClient.test.ts
git commit -m "feat(financials): add FmpFinancialStatementsClient (6 endpoints)"
```

---

## Task 4: CachedFinancialStatementsProvider (Redis 데코)

**Files:**
- Create: `src/shared/api/fmp/CachedFinancialStatementsProvider.ts`
- Test: `src/shared/api/fmp/__tests__/CachedFinancialStatementsProvider.test.ts`

`CachedFundamentalProvider` 패턴: `cache(() => getOrSetCache(key, TTL, fetcher).catch(() => null로 graceful))`. 키 `financials:<kind>:{SYM}:{period}`.

- [ ] **Step 1: 실패 테스트**

```typescript
it('caches with financials:income:{SYM}:{period} key and TTL', async () => {
    // getOrSetCache mock → 키·TTL 인자 검증
});
it('returns [] (not throw) when inner throws — no cache poison', async () => {
    // inner.getIncomeStatements throws → 결과 [] (graceful), getOrSetCache.set 미호출
});
it('uppercases symbol in key', async () => { /* aapl → AAPL */ });
```
Run → FAIL

- [ ] **Step 2: 구현**

```typescript
import { cache } from 'react';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { FMP_STATEMENTS_REVALIDATE_SECONDS } from '@/shared/config/time';
import type { FinancialStatementsProvider, IncomeStatementRow, StatementPeriod /* ... */ } from '@y0ngha/siglens-core';

const TTL = FMP_STATEMENTS_REVALIDATE_SECONDS;
const sym = (s: string) => s.toUpperCase();

export class CachedFinancialStatementsProvider implements FinancialStatementsProvider {
    constructor(private readonly inner: FinancialStatementsProvider) {}

    getIncomeStatements = cache((symbol: string, period: StatementPeriod, limit: number): Promise<IncomeStatementRow[]> =>
        getOrSetCache(`financials:income:${sym(symbol)}:${period}`, TTL, () => this.inner.getIncomeStatements(symbol, period, limit))
            .catch(error => { console.error('[CachedFinancials] income failed:', error); return []; })
    );
    // getBalanceSheets → financials:balance, getCashFlowStatements → financials:cashflow,
    // getIncomeStatementGrowths → financials:income-growth, getFinancialGrowths → financials:financial-growth,
    // getCashFlowGrowths → financials:cashflow-growth — 동일 패턴, graceful [].
}
```
> 배열 반환 메서드라 graceful fallback은 `[]`(null 아님). `getOrSetCache` envelope이 빈 배열도 캐싱(poison 방지는 throw 시 set 미호출로 달성).

- [ ] **Step 3: 통과 확인** → PASS

- [ ] **Step 4: Commit**

```bash
git add src/shared/api/fmp/CachedFinancialStatementsProvider.ts src/shared/api/fmp/__tests__/CachedFinancialStatementsProvider.test.ts
git commit -m "feat(financials): add CachedFinancialStatementsProvider (Redis decorator)"
```

---

## Task 5: 팩토리 + E2E Fake

**Files:**
- Create: `src/shared/api/fmp/getFinancialStatementsProvider.ts`
- Create: `src/shared/api/fmp/FakeFinancialStatementsProvider.ts`
- Test: `src/shared/api/fmp/__tests__/getFinancialStatementsProvider.test.ts`

- [ ] **Step 1: 실패 테스트**

```typescript
it('returns Fake in E2E mode', () => {
    vi.stubEnv('E2E_TEST', '1');
    expect(getFinancialStatementsProvider().constructor.name).toBe('FakeFinancialStatementsProvider');
});
it('returns Cached in prod and is singleton', () => {
    // 같은 인스턴스 반환
});
```
Run → FAIL

- [ ] **Step 2: 구현** (`getFundamentalDataProvider` 패턴)

```typescript
// getFinancialStatementsProvider.ts
import { isE2E } from './e2eEnv';
import { CachedFinancialStatementsProvider } from './CachedFinancialStatementsProvider';
import { FmpFinancialStatementsClient } from './financialStatementsClient';
import type { FinancialStatementsProvider } from '@y0ngha/siglens-core';

let cached: FinancialStatementsProvider | null = null;
export function getFinancialStatementsProvider(): FinancialStatementsProvider {
    if (cached !== null) return cached;
    if (isE2E()) {
        const { FakeFinancialStatementsProvider } = require('./FakeFinancialStatementsProvider') as typeof import('./FakeFinancialStatementsProvider');
        cached = new FakeFinancialStatementsProvider();
        return cached;
    }
    cached = new CachedFinancialStatementsProvider(new FmpFinancialStatementsClient());
    return cached;
}
```
`FakeFinancialStatementsProvider`: 결정론적 픽스처(최소 2년치 income/balance/cashFlow + growth 1행)로 6 메서드 구현 — E2E에서 스코어카드·표가 렌더되도록 실데이터 반환(fundamental Fake는 profile만 채웠지만, financials는 표·점수가 본 콘텐츠라 충분한 행 필요).

- [ ] **Step 3: 통과 확인** → PASS

- [ ] **Step 4: Commit**

```bash
git add src/shared/api/fmp/getFinancialStatementsProvider.ts src/shared/api/fmp/FakeFinancialStatementsProvider.ts src/shared/api/fmp/__tests__/getFinancialStatementsProvider.test.ts
git commit -m "feat(financials): add provider factory + E2E fake"
```

---

## Task 6: 검증

- [ ] **Step 1: lint + test + 부분 빌드**

Run:
```bash
yarn lint src/shared/api/fmp
yarn test src/shared/api/fmp   # 신규 3개 스위트 + 기존 회귀 없음, 커버리지 ≥90%
```
Expected: PASS.

- [ ] **Step 2: Commit (있으면 lint fix)**

> Phase 4(페이지·UI)에서 이 provider를 `financialData.ts`로 소비.

---

## Self-Review

- 스펙 §4.3(어댑터/캐시/팩토리/Fake) + §4.6(2계층 단일 TTL, 키 규칙, graceful) 전부 Task로 커버.
- 타입: core overlay의 `FinancialStatementsProvider`·Row 타입 import. Phase 1 export와 일치.
- worst case: 빈 응답 `[]`, NaN→null, FMP throw 전파(어댑터)→graceful `[]`(데코) 분리 테스트.
- 캐시 키 6종(`financials:income|balance|cashflow|income-growth|financial-growth|cashflow-growth:{SYM}:{period}`).
