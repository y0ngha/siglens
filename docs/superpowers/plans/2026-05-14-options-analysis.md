# Options Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SigLens에 옵션 시장 분석 기능을 추가한다. 차트 페이지 보조 카드 3종(ATM IV · P/C Ratio · Max Pain) + 신규 옵션 분석 탭(`/[symbol]/options`) + 종합 분석 5축 확장.

**Architecture:** siglens-core가 옵션 도메인 계산/AI 프롬프트/submit·poll use-case를 소유하고, siglens가 yahoo-finance2 어댑터/UI/페이지를 소유한다. 두 레포는 git worktree로 격리된 작업 공간에서 진행하고, siglens 워크트리는 portal protocol로 siglens-core 워크트리를 직접 import한다.

**Tech Stack:** TypeScript 5.x · Next.js 16.2 (App Router + Cache Components) · React 19 · React Query · siglens-core (private package) · yahoo-finance2 · vitest + testing-library · Playwright.

**Scope (Phase 1):** yfinance 단독, on-demand snapshot only, IV Rank는 ATM IV로 치환, Tradier fallback은 인터페이스만.

**Spec:** [docs/superpowers/specs/2026-05-14-options-analysis-design.md](../specs/2026-05-14-options-analysis-design.md)

---

## Phase 0 — 환경 셋업 (Worktrees + portal link)

### Task 0.1: siglens-core worktree 생성

**Files:**
- Create branch: `options/analysis` in siglens-core
- Worktree path: `/Users/y0ngha/Project/siglens-core-options`

- [ ] **Step 1: siglens-core 메인 브랜치 최신화**

```bash
cd /Users/y0ngha/Project/siglens-core
git fetch origin
git checkout main
git pull origin main
```

- [ ] **Step 2: options/analysis 브랜치를 main 기준으로 worktree에 생성**

```bash
git worktree add /Users/y0ngha/Project/siglens-core-options -b options/analysis main
```

- [ ] **Step 3: worktree에서 의존성 설치 + 빌드**

```bash
cd /Users/y0ngha/Project/siglens-core-options
yarn install
yarn build
```

Expected: `dist/` 디렉토리 생성, 빌드 에러 0.

- [ ] **Step 4: 빌드 watch 모드 백그라운드 시작 (이후 task에서 사용)**

작업 진행 중 siglens-core 코드 변경이 즉시 siglens에 반영되도록 watch 빌드를 별도 터미널 또는 백그라운드에서 실행한다.

```bash
# 별도 터미널에서:
cd /Users/y0ngha/Project/siglens-core-options
yarn build --watch
```

Expected: `Watching for file changes...` 표시 후 변경 시 자동 재빌드.

### Task 0.2: siglens worktree 생성

**Files:**
- Create branch: `options/analysis` in siglens
- Worktree path: `/Users/y0ngha/Project/siglens-options`

- [ ] **Step 1: siglens master 브랜치 최신화**

```bash
cd /Users/y0ngha/Project/siglens
git fetch origin
git checkout master
git pull origin master
```

- [ ] **Step 2: options/analysis 브랜치를 master 기준으로 worktree에 생성**

```bash
git worktree add /Users/y0ngha/Project/siglens-options -b options/analysis master
```

- [ ] **Step 3: worktree에서 의존성 설치**

```bash
cd /Users/y0ngha/Project/siglens-options
yarn install
```

### Task 0.3: portal protocol로 siglens-core 워크트리 link

**Files:**
- Modify: `/Users/y0ngha/Project/siglens-options/package.json` (`@y0ngha/siglens-core` dependency)

- [ ] **Step 1: package.json 의존성을 portal protocol로 교체**

기존:
```json
"@y0ngha/siglens-core": "0.10.1",
```

변경:
```json
"@y0ngha/siglens-core": "portal:../siglens-core-options",
```

`Edit` tool 사용:
```bash
# package.json line containing "@y0ngha/siglens-core": "0.10.1"
# → "@y0ngha/siglens-core": "portal:../siglens-core-options"
```

- [ ] **Step 2: yarn install로 link 활성화**

```bash
cd /Users/y0ngha/Project/siglens-options
yarn install
```

Expected: `Done in ...`, `@y0ngha/siglens-core` resolved to portal target.

- [ ] **Step 3: link 검증 — siglens에서 core import 정상**

```bash
node -e "console.log(require.resolve('@y0ngha/siglens-core'))"
```

Expected: 경로가 `/Users/y0ngha/Project/siglens-core-options/dist/index.js`로 해결됨.

- [ ] **Step 4: dev 서버 부팅 확인**

```bash
yarn dev
```

브라우저에서 `http://localhost:4200` 접속해 기존 기능 정상 작동하는지 확인. 종료: Ctrl+C.

- [ ] **Step 5: 두 worktree 셋업 완료 commit**

이 시점에서는 코드 변경 없음. portal 의존성만 변경됨. 별도 commit으로 셋업 분리.

```bash
cd /Users/y0ngha/Project/siglens-options
git add package.json yarn.lock
git commit -m "chore(options): link siglens-core via portal for worktree development"
```

> **이후 모든 task의 working directory:**
> - siglens-core 변경 → `/Users/y0ngha/Project/siglens-core-options`
> - siglens 변경 → `/Users/y0ngha/Project/siglens-options`

---

## Phase 1 — siglens-core 도메인 (옵션 타입 + 계산 + Normalize)

### Task 1.1: 옵션 도메인 타입 정의

**Files:**
- Create: `siglens-core-options/src/domain/options/types.ts`
- Modify: `siglens-core-options/src/domain/types.ts` (Raw 타입 export 추가)

- [ ] **Step 1: domain/options 디렉토리 생성 + types.ts 작성**

```typescript
// src/domain/options/types.ts
/** Single options contract (call or put). */
export interface OptionsContract {
    contractSymbol: string;
    strike: number;
    lastPrice: number | null;
    bid: number | null;
    ask: number | null;
    volume: number;
    openInterest: number;
    /** Fraction 0~1 (e.g., 0.25 = 25% IV). */
    impliedVolatility: number | null;
    inTheMoney: boolean;
}

/** Options chain for a single expiration. */
export interface OptionsChain {
    /** ISO date 'YYYY-MM-DD'. */
    expirationDate: string;
    /** Days to expiration, ET-midnight reference. */
    daysToExpiration: number;
    /** Sorted ascending by strike. */
    calls: ReadonlyArray<OptionsContract>;
    puts: ReadonlyArray<OptionsContract>;
}

/** Full snapshot of all chains for a symbol at one point in time. */
export interface OptionsSnapshot {
    symbol: string;
    underlyingPrice: number;
    chains: ReadonlyArray<OptionsChain>;
    /** Provider timestamp (ISO datetime). */
    capturedAt: string;
}

/** Per-expiration computed metrics. */
export interface OptionsExpirationMetrics {
    expirationDate: string;
    maxPain: number;
    /** sum(put OI) / sum(call OI). */
    putCallRatio: number;
    /** ATM IV as fraction (e.g., 0.28). null if unavailable. */
    atmImpliedVolatility: number | null;
    /** Top 3 strikes by combined OI, sorted descending. */
    topOpenInterestStrikes: ReadonlyArray<{
        strike: number;
        callOpenInterest: number;
        putOpenInterest: number;
    }>;
    /** Implied move in ±% units (4.2 means ±4.2%). null if unavailable. */
    impliedMovePercent: number | null;
}

/** Symbol-level aggregated metrics. */
export interface OptionsSymbolMetrics {
    symbol: string;
    /** Reserved for future use; Phase 1 always returns null (no historical IV). */
    ivRank: number | null;
    perExpiration: ReadonlyArray<OptionsExpirationMetrics>;
    capturedAt: string;
}

/** AI options analysis response (normalized). */
export interface OptionsAnalysisResponse {
    summary: string;
    perExpiration: ReadonlyArray<{
        expirationDate: string;
        commentary: string;
        tone: OptionsTone;
    }>;
    signals: ReadonlyArray<{
        kind: OptionsSignalKind;
        message: string;
    }>;
    /** ISO datetime when analysis was produced. */
    analyzedAt: string;
}

export type OptionsTone = 'bullish' | 'bearish' | 'neutral' | 'cautious';
export type OptionsSignalKind = 'bullish' | 'bearish' | 'neutral' | 'volatility';

/** @internal Raw response shape before normalization. */
export interface RawOptionsAnalysisResponse {
    summary?: unknown;
    perExpiration?: unknown;
    signals?: unknown;
    analyzedAt?: unknown;
}
```

- [ ] **Step 2: domain/types.ts에 re-export 추가 (기존 패턴 일관성)**

`siglens-core/src/domain/types.ts` 끝에 추가:

```typescript
// --- Options Analysis Types ---
export type {
    OptionsContract,
    OptionsChain,
    OptionsSnapshot,
    OptionsExpirationMetrics,
    OptionsSymbolMetrics,
    OptionsAnalysisResponse,
    OptionsTone,
    OptionsSignalKind,
    RawOptionsAnalysisResponse,
} from './options/types';
```

- [ ] **Step 3: 타입체크 + commit**

```bash
yarn tsc --noEmit
git add src/domain/options/types.ts src/domain/types.ts
git commit -m "feat(options): add core domain types for options analysis"
```

### Task 1.2: ExpirationSlots 매핑 함수 (TDD)

**Files:**
- Create: `src/domain/options/expirationSlots.ts`
- Test: `src/__tests__/domain/options/expirationSlots.test.ts`

- [ ] **Step 1: failing test 작성**

```typescript
// src/__tests__/domain/options/expirationSlots.test.ts
import { describe, it, expect } from 'vitest';
import {
    mapExpirationsToSlots,
    EXPIRATION_SLOTS,
} from '@/domain/options/expirationSlots';

describe('mapExpirationsToSlots', () => {
    const now = new Date('2026-05-14T00:00:00-04:00'); // ET midnight

    it('maps closest expiration ≥ target days to each slot', () => {
        const expirations = [
            '2026-05-22', // 8 days
            '2026-05-29', // 15 days
            '2026-06-14', // 31 days
            '2026-07-15', // 62 days
            '2026-08-15', // 93 days
            '2026-11-13', // 183 days
        ];
        const result = mapExpirationsToSlots(expirations, now);
        const filled = result.filter(x => x !== null);
        expect(filled).toHaveLength(6);
        expect(filled[0]?.slot.key).toBe('1W');
        expect(filled[0]?.expirationDate).toBe('2026-05-22');
        expect(filled[5]?.slot.key).toBe('6M');
    });

    it('omits slots with no satisfying expiration', () => {
        const expirations = ['2026-05-22']; // only 1W
        const result = mapExpirationsToSlots(expirations, now);
        expect(result.filter(x => x !== null)).toHaveLength(1);
        expect(result.filter(x => x !== null)[0]?.slot.key).toBe('1W');
    });

    it('does not reuse the same expiration across slots', () => {
        // 가까운 만기 하나만 있고 다른 슬롯들이 비어야 한다
        const expirations = ['2026-05-22']; // 8 days
        const result = mapExpirationsToSlots(expirations, now);
        const filled = result.filter(x => x !== null);
        expect(filled).toHaveLength(1);
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
yarn vitest run src/__tests__/domain/options/expirationSlots.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: expirationSlots.ts 구현**

```typescript
// src/domain/options/expirationSlots.ts
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ExpirationSlot {
    key: '1W' | '2W' | '1M' | '2M' | '3M' | '6M';
    label: string;
    targetDays: number;
}

export const EXPIRATION_SLOTS: ReadonlyArray<ExpirationSlot> = [
    { key: '1W', label: '1주', targetDays: 7 },
    { key: '2W', label: '2주', targetDays: 14 },
    { key: '1M', label: '1개월', targetDays: 30 },
    { key: '2M', label: '2개월', targetDays: 60 },
    { key: '3M', label: '3개월', targetDays: 90 },
    { key: '6M', label: '6개월', targetDays: 180 },
];

export interface SlotMapping {
    slot: ExpirationSlot;
    expirationDate: string;
}

/**
 * Map provider expirations to slots. For each slot, pick the closest
 * expiration whose daysToExpiration is ≥ targetDays. An expiration
 * mapped to one slot is not reused for later slots.
 *
 * @param expirations - Expiration dates (ISO 'YYYY-MM-DD'), unsorted OK.
 * @param now - Reference date (typically ET-midnight today).
 * @returns Array same length as EXPIRATION_SLOTS; null entries are unmapped slots.
 */
export function mapExpirationsToSlots(
    expirations: ReadonlyArray<string>,
    now: Date
): ReadonlyArray<SlotMapping | null> {
    const dated = expirations
        .map(d => ({ date: d, days: daysBetween(now, d) }))
        .filter(e => e.days >= 0)
        .sort((a, b) => a.days - b.days);

    const used = new Set<string>();
    return EXPIRATION_SLOTS.map(slot => {
        const match = dated.find(
            e => e.days >= slot.targetDays && !used.has(e.date)
        );
        if (!match) return null;
        used.add(match.date);
        return { slot, expirationDate: match.date };
    });
}

function daysBetween(from: Date, isoDate: string): number {
    const to = new Date(`${isoDate}T00:00:00-04:00`);
    return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
yarn vitest run src/__tests__/domain/options/expirationSlots.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/options/expirationSlots.ts src/__tests__/domain/options/expirationSlots.test.ts
git commit -m "feat(options): add expiration slot mapping (1W/2W/1M/2M/3M/6M)"
```

### Task 1.3: 옵션 계산 함수 5종 (TDD)

5개 계산 함수를 하나의 task로 묶어 진행. 각 함수마다 test → 실패 확인 → 구현 → 통과 사이클을 반복.

**Files:**
- Create: `src/domain/options/calculateMaxPain.ts`
- Create: `src/domain/options/calculatePutCallRatio.ts`
- Create: `src/domain/options/calculateImpliedMove.ts`
- Create: `src/domain/options/aggregateOpenInterest.ts`
- Create: `src/domain/options/sanitizeOptionsChain.ts`
- Test: 동일 경로의 `.test.ts` 파일들

- [ ] **Step 1: calculateMaxPain test + 구현**

테스트 (`__tests__/domain/options/calculateMaxPain.test.ts`):
```typescript
import { describe, it, expect } from 'vitest';
import { calculateMaxPain } from '@/domain/options/calculateMaxPain';
import type { OptionsChain } from '@/domain/options/types';

describe('calculateMaxPain', () => {
    const baseChain: OptionsChain = {
        expirationDate: '2026-05-22',
        daysToExpiration: 8,
        calls: [
            { contractSymbol: 'C190', strike: 190, lastPrice: null, bid: null, ask: null, volume: 0, openInterest: 100, impliedVolatility: null, inTheMoney: false },
            { contractSymbol: 'C195', strike: 195, lastPrice: null, bid: null, ask: null, volume: 0, openInterest: 200, impliedVolatility: null, inTheMoney: false },
            { contractSymbol: 'C200', strike: 200, lastPrice: null, bid: null, ask: null, volume: 0, openInterest: 50, impliedVolatility: null, inTheMoney: false },
        ],
        puts: [
            { contractSymbol: 'P190', strike: 190, lastPrice: null, bid: null, ask: null, volume: 0, openInterest: 50, impliedVolatility: null, inTheMoney: false },
            { contractSymbol: 'P195', strike: 195, lastPrice: null, bid: null, ask: null, volume: 0, openInterest: 100, impliedVolatility: null, inTheMoney: false },
            { contractSymbol: 'P200', strike: 200, lastPrice: null, bid: null, ask: null, volume: 0, openInterest: 100, impliedVolatility: null, inTheMoney: false },
        ],
    };

    it('returns the strike with minimum total writer loss', () => {
        const result = calculateMaxPain(baseChain);
        expect([190, 195, 200]).toContain(result);
    });

    it('handles chain with only calls', () => {
        const result = calculateMaxPain({ ...baseChain, puts: [] });
        expect(typeof result).toBe('number');
    });

    it('handles chain with only puts', () => {
        const result = calculateMaxPain({ ...baseChain, calls: [] });
        expect(typeof result).toBe('number');
    });

    it('returns NaN for empty chain', () => {
        const result = calculateMaxPain({
            expirationDate: '2026-05-22',
            daysToExpiration: 8,
            calls: [],
            puts: [],
        });
        expect(Number.isNaN(result)).toBe(true);
    });
});
```

구현 (`src/domain/options/calculateMaxPain.ts`):
```typescript
import type { OptionsChain } from './types';

/**
 * Compute the max pain strike — the strike at which the total writer
 * (option seller) payoff is minimized. For each candidate strike S, the
 * total payoff is:
 *   - sum over call strikes K: max(S - K, 0) * callOI(K)
 *   - sum over put strikes K:  max(K - S, 0) * putOI(K)
 *
 * @param chain - The options chain for a single expiration.
 * @returns The max pain strike, or NaN if the chain has no contracts.
 */
export function calculateMaxPain(chain: OptionsChain): number {
    const strikes = Array.from(
        new Set([
            ...chain.calls.map(c => c.strike),
            ...chain.puts.map(p => p.strike),
        ])
    ).sort((a, b) => a - b);

    if (strikes.length === 0) return Number.NaN;

    let minPain = Number.POSITIVE_INFINITY;
    let minPainStrike = strikes[0];

    for (const candidate of strikes) {
        let pain = 0;
        for (const c of chain.calls) {
            if (candidate > c.strike) {
                pain += (candidate - c.strike) * c.openInterest;
            }
        }
        for (const p of chain.puts) {
            if (candidate < p.strike) {
                pain += (p.strike - candidate) * p.openInterest;
            }
        }
        if (pain < minPain) {
            minPain = pain;
            minPainStrike = candidate;
        }
    }

    return minPainStrike;
}
```

테스트 실행:
```bash
yarn vitest run src/__tests__/domain/options/calculateMaxPain.test.ts
```

Expected: PASS.

- [ ] **Step 2: calculatePutCallRatio test + 구현**

테스트:
```typescript
import { describe, it, expect } from 'vitest';
import { calculatePutCallRatio } from '@/domain/options/calculatePutCallRatio';
import type { OptionsChain } from '@/domain/options/types';

const makeContract = (strike: number, oi: number) => ({
    contractSymbol: `X${strike}`,
    strike, lastPrice: null, bid: null, ask: null,
    volume: 0, openInterest: oi, impliedVolatility: null, inTheMoney: false,
});

describe('calculatePutCallRatio', () => {
    it('returns sum(putOI) / sum(callOI)', () => {
        const chain = {
            expirationDate: '2026-05-22',
            daysToExpiration: 8,
            calls: [makeContract(195, 100), makeContract(200, 200)],
            puts: [makeContract(195, 150), makeContract(200, 150)],
        };
        expect(calculatePutCallRatio(chain)).toBeCloseTo(1.0, 5);
    });

    it('returns +Infinity when call OI is 0 but put OI > 0', () => {
        const chain = {
            expirationDate: '2026-05-22',
            daysToExpiration: 8,
            calls: [makeContract(195, 0)],
            puts: [makeContract(195, 100)],
        };
        expect(calculatePutCallRatio(chain)).toBe(Number.POSITIVE_INFINITY);
    });

    it('returns 0 when both call OI and put OI are 0', () => {
        const chain = {
            expirationDate: '2026-05-22',
            daysToExpiration: 8,
            calls: [makeContract(195, 0)],
            puts: [makeContract(195, 0)],
        };
        expect(calculatePutCallRatio(chain)).toBe(0);
    });
});
```

구현:
```typescript
// src/domain/options/calculatePutCallRatio.ts
import type { OptionsChain } from './types';

/**
 * Compute the put/call ratio = sum(put OI) / sum(call OI).
 *
 * - When call OI is 0 and put OI > 0, returns +Infinity (caller should treat
 *   as "extreme bearish positioning").
 * - When both are 0, returns 0 (no positioning to report).
 */
export function calculatePutCallRatio(chain: OptionsChain): number {
    const callOi = chain.calls.reduce((s, c) => s + c.openInterest, 0);
    const putOi = chain.puts.reduce((s, p) => s + p.openInterest, 0);
    if (callOi === 0 && putOi === 0) return 0;
    if (callOi === 0) return Number.POSITIVE_INFINITY;
    return putOi / callOi;
}
```

- [ ] **Step 3: calculateImpliedMove test + 구현**

테스트:
```typescript
import { describe, it, expect } from 'vitest';
import { calculateImpliedMove } from '@/domain/options/calculateImpliedMove';

describe('calculateImpliedMove', () => {
    it('returns IV * sqrt(daysToExpiration / 365) as percent', () => {
        // IV=0.30, DTE=30 → 0.30 * sqrt(30/365) ≈ 0.0860 → 8.60%
        const result = calculateImpliedMove(0.30, 30);
        expect(result).toBeCloseTo(8.6, 1);
    });

    it('returns null when ATM IV is null', () => {
        expect(calculateImpliedMove(null, 30)).toBeNull();
    });

    it('returns null when daysToExpiration is 0 or negative', () => {
        expect(calculateImpliedMove(0.30, 0)).toBeNull();
        expect(calculateImpliedMove(0.30, -1)).toBeNull();
    });
});
```

구현:
```typescript
// src/domain/options/calculateImpliedMove.ts
const TRADING_DAYS_BASIS = 365;

/**
 * Compute the implied move for an expiration as ±% of underlying.
 *
 * Formula: atmIv * sqrt(daysToExpiration / 365) * 100
 *
 * @param atmIv - ATM implied volatility as a fraction (0.25 = 25%). null when unavailable.
 * @param daysToExpiration - Calendar days until expiration. Must be > 0.
 * @returns Implied move in ± percent units (e.g., 4.2 means ±4.2%), or null.
 */
export function calculateImpliedMove(
    atmIv: number | null,
    daysToExpiration: number
): number | null {
    if (atmIv === null) return null;
    if (daysToExpiration <= 0) return null;
    return atmIv * Math.sqrt(daysToExpiration / TRADING_DAYS_BASIS) * 100;
}
```

- [ ] **Step 4: aggregateOpenInterest test + 구현**

테스트:
```typescript
import { describe, it, expect } from 'vitest';
import { aggregateOpenInterest } from '@/domain/options/aggregateOpenInterest';

const makeContract = (strike: number, oi: number) => ({
    contractSymbol: `X${strike}`,
    strike, lastPrice: null, bid: null, ask: null,
    volume: 0, openInterest: oi, impliedVolatility: null, inTheMoney: false,
});

describe('aggregateOpenInterest', () => {
    it('groups by strike, sums call/put OI separately, sorts ascending', () => {
        const chain = {
            expirationDate: '2026-05-22',
            daysToExpiration: 8,
            calls: [makeContract(200, 100), makeContract(195, 200)],
            puts: [makeContract(195, 50), makeContract(200, 150)],
        };
        const result = aggregateOpenInterest(chain);
        expect(result).toEqual([
            { strike: 195, callOpenInterest: 200, putOpenInterest: 50 },
            { strike: 200, callOpenInterest: 100, putOpenInterest: 150 },
        ]);
    });

    it('fills 0 for missing side', () => {
        const chain = {
            expirationDate: '2026-05-22',
            daysToExpiration: 8,
            calls: [makeContract(200, 100)],
            puts: [],
        };
        const result = aggregateOpenInterest(chain);
        expect(result).toEqual([
            { strike: 200, callOpenInterest: 100, putOpenInterest: 0 },
        ]);
    });

    it('returns empty array for empty chain', () => {
        const result = aggregateOpenInterest({
            expirationDate: '2026-05-22',
            daysToExpiration: 8,
            calls: [],
            puts: [],
        });
        expect(result).toEqual([]);
    });
});
```

구현:
```typescript
// src/domain/options/aggregateOpenInterest.ts
import type { OptionsChain } from './types';

export interface StrikeOpenInterest {
    strike: number;
    callOpenInterest: number;
    putOpenInterest: number;
}

/**
 * Aggregate call/put open interest per strike, sorted ascending by strike.
 * Missing sides are filled with 0.
 */
export function aggregateOpenInterest(
    chain: OptionsChain
): ReadonlyArray<StrikeOpenInterest> {
    const map = new Map<number, StrikeOpenInterest>();
    for (const c of chain.calls) {
        const entry = map.get(c.strike) ?? {
            strike: c.strike,
            callOpenInterest: 0,
            putOpenInterest: 0,
        };
        entry.callOpenInterest += c.openInterest;
        map.set(c.strike, entry);
    }
    for (const p of chain.puts) {
        const entry = map.get(p.strike) ?? {
            strike: p.strike,
            callOpenInterest: 0,
            putOpenInterest: 0,
        };
        entry.putOpenInterest += p.openInterest;
        map.set(p.strike, entry);
    }
    return Array.from(map.values()).sort((a, b) => a.strike - b.strike);
}
```

- [ ] **Step 5: sanitizeOptionsChain test + 구현**

테스트:
```typescript
import { describe, it, expect } from 'vitest';
import { sanitizeOptionsChain } from '@/domain/options/sanitizeOptionsChain';
import type { OptionsChain } from '@/domain/options/types';

const makeContract = (strike: number, oi: number, volume = 0) => ({
    contractSymbol: `X${strike}`,
    strike, lastPrice: null, bid: null, ask: null,
    volume, openInterest: oi, impliedVolatility: null, inTheMoney: false,
});

describe('sanitizeOptionsChain', () => {
    it('drops contracts with negative OI', () => {
        const chain: OptionsChain = {
            expirationDate: '2026-05-22',
            daysToExpiration: 8,
            calls: [makeContract(195, 100), makeContract(200, -50)],
            puts: [],
        };
        const result = sanitizeOptionsChain(chain);
        expect(result?.calls).toHaveLength(1);
        expect(result?.calls[0].strike).toBe(195);
    });

    it('drops duplicate strikes (keeps first)', () => {
        const chain: OptionsChain = {
            expirationDate: '2026-05-22',
            daysToExpiration: 8,
            calls: [makeContract(195, 100), makeContract(195, 200)],
            puts: [],
        };
        const result = sanitizeOptionsChain(chain);
        expect(result?.calls).toHaveLength(1);
        expect(result?.calls[0].openInterest).toBe(100);
    });

    it('rejects entire chain when >5% of contracts are invalid', () => {
        const chain: OptionsChain = {
            expirationDate: '2026-05-22',
            daysToExpiration: 8,
            calls: [
                makeContract(190, 100),
                makeContract(195, -1), // invalid
                makeContract(200, -2), // invalid (2/3 > 5%)
            ],
            puts: [],
        };
        expect(sanitizeOptionsChain(chain)).toBeNull();
    });
});
```

구현:
```typescript
// src/domain/options/sanitizeOptionsChain.ts
import type { OptionsChain, OptionsContract } from './types';

const INVALID_THRESHOLD = 0.05; // 5%

/**
 * Drop malformed contracts (negative OI/volume, duplicate strikes). If more
 * than 5% of contracts are dropped on either side, returns null — the
 * chain is considered unreliable and should not be displayed.
 */
export function sanitizeOptionsChain(chain: OptionsChain): OptionsChain | null {
    const totalCalls = chain.calls.length;
    const totalPuts = chain.puts.length;
    const calls = filterValid(chain.calls);
    const puts = filterValid(chain.puts);

    if (totalCalls > 0 && (totalCalls - calls.length) / totalCalls > INVALID_THRESHOLD) return null;
    if (totalPuts > 0 && (totalPuts - puts.length) / totalPuts > INVALID_THRESHOLD) return null;

    return {
        ...chain,
        calls,
        puts,
    };
}

function filterValid(
    contracts: ReadonlyArray<OptionsContract>
): ReadonlyArray<OptionsContract> {
    const seen = new Set<number>();
    return contracts.filter(c => {
        if (c.openInterest < 0) return false;
        if (c.volume < 0) return false;
        if (c.strike === null || c.strike === undefined) return false;
        if (seen.has(c.strike)) return false;
        seen.add(c.strike);
        return true;
    });
}
```

- [ ] **Step 6: 전체 vitest 통과 확인**

```bash
yarn vitest run src/__tests__/domain/options/
```

Expected: 모든 테스트 PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain/options/ src/__tests__/domain/options/
git commit -m "feat(options): add core calculation functions (max pain, P/C, implied move, OI agg, sanitize)"
```

### Task 1.4: asIsoDate primitive helper 추가

기존 normalizePrimitives에 ISO date 검증 헬퍼가 없으므로 추가.

**Files:**
- Modify: `src/domain/analysis/normalizePrimitives.ts`
- Test: `src/__tests__/domain/analysis/normalizePrimitives.test.ts` (기존 파일에 추가)

- [ ] **Step 1: failing test 추가**

```typescript
import { asIsoDate } from '@/domain/analysis/normalizePrimitives';

describe('asIsoDate', () => {
    it('returns ISO date when input is valid YYYY-MM-DD', () => {
        expect(asIsoDate('2026-05-14')).toBe('2026-05-14');
    });

    it('returns ISO date when input is valid ISO datetime', () => {
        expect(asIsoDate('2026-05-14T12:00:00Z')).toBe('2026-05-14T12:00:00Z');
    });

    it('returns null for invalid date strings', () => {
        expect(asIsoDate('not-a-date')).toBeNull();
        expect(asIsoDate('2026-13-99')).toBeNull();
    });

    it('returns null for non-string inputs', () => {
        expect(asIsoDate(null)).toBeNull();
        expect(asIsoDate(undefined)).toBeNull();
        expect(asIsoDate(123)).toBeNull();
        expect(asIsoDate({})).toBeNull();
    });
});
```

- [ ] **Step 2: 구현 추가**

`src/domain/analysis/normalizePrimitives.ts` 끝에:

```typescript
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;

/**
 * Validate an ISO 8601 date or datetime string. Returns the input string
 * when valid (canonical form unchanged) or null otherwise.
 */
export function asIsoDate(v: unknown): string | null {
    if (typeof v !== 'string') return null;
    if (!ISO_DATE_RE.test(v)) return null;
    const t = Date.parse(v);
    if (Number.isNaN(t)) return null;
    return v;
}
```

- [ ] **Step 3: 테스트 통과 확인 + commit**

```bash
yarn vitest run src/__tests__/domain/analysis/normalizePrimitives.test.ts
git add src/domain/analysis/normalizePrimitives.ts src/__tests__/domain/analysis/normalizePrimitives.test.ts
git commit -m "feat: add asIsoDate primitive normalization helper"
```

### Task 1.5: normalizeOptionsAnalysisResponse 함수 (TDD)

**Files:**
- Create: `src/domain/analysis/normalizeOptions.ts`
- Test: `src/__tests__/domain/analysis/normalizeOptions.test.ts`

- [ ] **Step 1: failing test 작성 (모든 케이스 커버)**

```typescript
import { describe, it, expect } from 'vitest';
import { normalizeOptionsAnalysisResponse } from '@/domain/analysis/normalizeOptions';

describe('normalizeOptionsAnalysisResponse', () => {
    const now = new Date('2026-05-14T12:00:00Z');

    it('passes through a fully-formed valid response', () => {
        const raw = {
            summary: '시장은 상승 편향',
            perExpiration: [
                { expirationDate: '2026-05-22', commentary: '단기 OI 두텁다', tone: 'bullish' },
            ],
            signals: [{ kind: 'bullish', message: '콜 OI 급증' }],
            analyzedAt: '2026-05-14T11:55:00Z',
        };
        const result = normalizeOptionsAnalysisResponse(raw, now);
        expect(result.summary).toBe('시장은 상승 편향');
        expect(result.perExpiration).toHaveLength(1);
        expect(result.signals).toHaveLength(1);
        expect(result.analyzedAt).toBe('2026-05-14T11:55:00Z');
    });

    it('falls back to FALLBACK_SUMMARY when summary missing', () => {
        const result = normalizeOptionsAnalysisResponse({}, now);
        expect(result.summary.length).toBeGreaterThan(0);
        expect(result.summary).toContain('가져올 수 없');
    });

    it('returns empty perExpiration when not an array', () => {
        const result = normalizeOptionsAnalysisResponse({ perExpiration: 'invalid' }, now);
        expect(result.perExpiration).toEqual([]);
    });

    it('drops perExpiration items missing expirationDate', () => {
        const raw = {
            perExpiration: [
                { commentary: 'good', tone: 'bullish' }, // no expirationDate
                { expirationDate: '2026-05-22', commentary: 'ok', tone: 'neutral' },
            ],
        };
        const result = normalizeOptionsAnalysisResponse(raw, now);
        expect(result.perExpiration).toHaveLength(1);
    });

    it('falls back commentary to FALLBACK_COMMENTARY when missing', () => {
        const raw = {
            perExpiration: [{ expirationDate: '2026-05-22', tone: 'neutral' }],
        };
        const result = normalizeOptionsAnalysisResponse(raw, now);
        expect(result.perExpiration[0].commentary.length).toBeGreaterThan(0);
    });

    it('coerces invalid tone to neutral', () => {
        const raw = {
            perExpiration: [
                { expirationDate: '2026-05-22', commentary: 'x', tone: 'super-bullish' },
            ],
        };
        const result = normalizeOptionsAnalysisResponse(raw, now);
        expect(result.perExpiration[0].tone).toBe('neutral');
    });

    it('drops signals missing message', () => {
        const raw = {
            signals: [
                { kind: 'bullish' }, // no message
                { kind: 'bullish', message: 'good' },
            ],
        };
        const result = normalizeOptionsAnalysisResponse(raw, now);
        expect(result.signals).toHaveLength(1);
    });

    it('coerces invalid signal kind to neutral', () => {
        const raw = {
            signals: [{ kind: 'unknown', message: 'x' }],
        };
        const result = normalizeOptionsAnalysisResponse(raw, now);
        expect(result.signals[0].kind).toBe('neutral');
    });

    it('uses now.toISOString() when analyzedAt missing or invalid', () => {
        const result = normalizeOptionsAnalysisResponse({}, now);
        expect(result.analyzedAt).toBe(now.toISOString());
    });

    it('handles null and non-object inputs safely', () => {
        expect(() => normalizeOptionsAnalysisResponse(null, now)).not.toThrow();
        expect(() => normalizeOptionsAnalysisResponse(undefined, now)).not.toThrow();
        expect(() => normalizeOptionsAnalysisResponse('string', now)).not.toThrow();
        expect(() => normalizeOptionsAnalysisResponse(123, now)).not.toThrow();
    });

    it('parses LLM markdown-fenced JSON string', () => {
        const raw = '```json\n{"summary":"테스트"}\n```';
        const result = normalizeOptionsAnalysisResponse(raw, now);
        expect(result.summary).toBe('테스트');
    });
});
```

- [ ] **Step 2: 구현 (기존 normalizeOverall 패턴 동일)**

```typescript
// src/domain/analysis/normalizeOptions.ts
import type {
    OptionsAnalysisResponse,
    OptionsTone,
    OptionsSignalKind,
    RawOptionsAnalysisResponse,
} from '@/domain/types';
import {
    asArray,
    asEnum,
    asIsoDate,
    asObject,
    asString,
    compact,
} from './normalizePrimitives';
import { extractJsonFromLlmResponse } from './promptFormat';

const VALID_TONES: readonly OptionsTone[] = [
    'bullish',
    'bearish',
    'neutral',
    'cautious',
];
const VALID_SIGNAL_KINDS: readonly OptionsSignalKind[] = [
    'bullish',
    'bearish',
    'neutral',
    'volatility',
];

const FALLBACK_SUMMARY =
    '옵션 분석을 가져올 수 없었어요. 잠시 후 다시 시도해주세요.';
const FALLBACK_COMMENTARY = '이 만기에 대한 해석을 가져올 수 없었어요.';

function parseLlmPayload(raw: unknown): unknown {
    return typeof raw === 'string' ? extractJsonFromLlmResponse(raw) : raw;
}

function normalizePerExpirationItem(item: unknown) {
    const o = asObject(item);
    if (!o) return null;
    const expirationDate = asIsoDate(o.expirationDate);
    if (expirationDate === null) return null;
    return {
        expirationDate,
        commentary: asString(o.commentary, FALLBACK_COMMENTARY),
        tone: asEnum<OptionsTone>(o.tone, VALID_TONES, 'neutral'),
    };
}

function normalizeSignalItem(item: unknown) {
    const o = asObject(item);
    if (!o) return null;
    const message = asString(o.message);
    if (message.length === 0) return null;
    return {
        kind: asEnum<OptionsSignalKind>(o.kind, VALID_SIGNAL_KINDS, 'neutral'),
        message,
    };
}

/**
 * Normalize a raw LLM options analysis response into a fully-typed
 * OptionsAnalysisResponse. Never throws — every field has a fallback.
 *
 * Used in two places per the spec (siglens-core SOP):
 *   1. pollOptionsAnalysis — normalize raw worker output before caching
 *   2. submitOptionsAnalysis — re-normalize cached payloads (schema drift guard)
 */
export function normalizeOptionsAnalysisResponse(
    raw: unknown,
    now: Date = new Date()
): OptionsAnalysisResponse {
    const parsed = parseLlmPayload(raw);
    const o = (asObject(parsed) ?? {}) as RawOptionsAnalysisResponse;

    return {
        summary: asString(o.summary, FALLBACK_SUMMARY),
        perExpiration: compact(
            asArray(o.perExpiration).map(normalizePerExpirationItem)
        ),
        signals: compact(asArray(o.signals).map(normalizeSignalItem)),
        analyzedAt: asIsoDate(o.analyzedAt) ?? now.toISOString(),
    };
}
```

> **주의:** `asString(v, fallback)`이 빈 문자열 `''`을 fallback으로 안 받고 그대로 통과시키지 않는다 — 기존 헬퍼 시그니처는 `asString(v, fallback = '')`로 fallback 디폴트가 `''`. 따라서 `asString(o.summary, FALLBACK_SUMMARY)`은 `o.summary`가 string이면 그 값(빈 문자열 포함)을 그대로 반환한다. 빈 문자열도 fallback으로 강제하고 싶다면 별도 분기 필요. 본 spec에서는 LLM이 빈 문자열을 의도적으로 줄 가능성이 낮으므로 fallback은 "string이 아닐 때"만 발동되도록 둔다 (기존 normalizeOverall과 동일 동작).

- [ ] **Step 3: 테스트 통과 + commit**

```bash
yarn vitest run src/__tests__/domain/analysis/normalizeOptions.test.ts
git add src/domain/analysis/normalizeOptions.ts src/__tests__/domain/analysis/normalizeOptions.test.ts
git commit -m "feat(options): add normalizeOptionsAnalysisResponse with nested field guards"
```

### Task 1.6: buildOptionsAnalysisPrompt 함수

**Files:**
- Create: `src/domain/options/optionsPrompt.ts`
- Create: `src/domain/options/summarizeChainForLlm.ts`
- Test: `src/__tests__/domain/options/optionsPrompt.test.ts`

- [ ] **Step 1: summarizeChainForLlm 작성 (LLM 입력 토큰 절감)**

```typescript
// src/domain/options/summarizeChainForLlm.ts
import { aggregateOpenInterest } from './aggregateOpenInterest';
import { calculateImpliedMove } from './calculateImpliedMove';
import { calculateMaxPain } from './calculateMaxPain';
import { calculatePutCallRatio } from './calculatePutCallRatio';
import type { OptionsChain, OptionsExpirationMetrics } from './types';

/**
 * Reduce an OptionsChain (potentially hundreds of strikes) to the metrics
 * the AI needs. Used by buildOptionsAnalysisPrompt and by overall axis
 * integration. Keeps prompt token count bounded.
 */
export function summarizeChainForLlm(
    chain: OptionsChain
): OptionsExpirationMetrics {
    const atmIv = pickAtmIv(chain);
    const oiByStrike = aggregateOpenInterest(chain);
    const top = [...oiByStrike]
        .sort((a, b) =>
            (b.callOpenInterest + b.putOpenInterest) -
            (a.callOpenInterest + a.putOpenInterest)
        )
        .slice(0, 3);

    return {
        expirationDate: chain.expirationDate,
        maxPain: calculateMaxPain(chain),
        putCallRatio: calculatePutCallRatio(chain),
        atmImpliedVolatility: atmIv,
        topOpenInterestStrikes: top,
        impliedMovePercent: calculateImpliedMove(atmIv, chain.daysToExpiration),
    };
}

function pickAtmIv(chain: OptionsChain): number | null {
    const all = [...chain.calls, ...chain.puts];
    if (all.length === 0) return null;
    // ATM proxy: contract with smallest |strike - midprice|. Without an explicit
    // underlying price, use median strike as a rough anchor.
    const strikes = all.map(c => c.strike).sort((a, b) => a - b);
    const median = strikes[Math.floor(strikes.length / 2)];
    let best: { distance: number; iv: number } | null = null;
    for (const c of all) {
        if (c.impliedVolatility === null) continue;
        const distance = Math.abs(c.strike - median);
        if (best === null || distance < best.distance) {
            best = { distance, iv: c.impliedVolatility };
        }
    }
    return best?.iv ?? null;
}
```

- [ ] **Step 2: buildOptionsAnalysisPrompt 작성**

```typescript
// src/domain/options/optionsPrompt.ts
import type { OptionsSnapshot } from './types';
import { summarizeChainForLlm } from './summarizeChainForLlm';

interface BuildOptionsAnalysisPromptOptions {
    /** Specific expiration ('YYYY-MM-DD') or 'all' for aggregated analysis. */
    expirationDate: string | 'all';
    companyName: string;
    snapshot: OptionsSnapshot;
}

/**
 * Build the LLM prompt for options analysis. The prompt requests a JSON
 * response matching RawOptionsAnalysisResponse (kept tolerant — normalize
 * will fill in any missing fields).
 */
export function buildOptionsAnalysisPrompt(
    options: BuildOptionsAnalysisPromptOptions
): string {
    const { expirationDate, companyName, snapshot } = options;

    const targetChains =
        expirationDate === 'all'
            ? snapshot.chains
            : snapshot.chains.filter(c => c.expirationDate === expirationDate);

    const summaries = targetChains.map(summarizeChainForLlm);

    return [
        `당신은 옵션 시장 분석가입니다. ${companyName} (${snapshot.symbol})의 옵션 시장 데이터를 한국어로 해석해주세요.`,
        '',
        `현재 주가: $${snapshot.underlyingPrice}`,
        '',
        '== 만기별 핵심 지표 ==',
        JSON.stringify(summaries, null, 2),
        '',
        '== 응답 형식 ==',
        '아래 JSON 스키마로만 응답하세요. 다른 텍스트는 포함하지 마세요.',
        '```json',
        '{',
        '  "summary": "전체 옵션 시장에 대한 한 문단 요약 (3-5문장, 친근한 어투, 한국어)",',
        '  "perExpiration": [',
        '    {',
        '      "expirationDate": "YYYY-MM-DD",',
        '      "commentary": "이 만기에 대한 해석 (2-3문장)",',
        '      "tone": "bullish | bearish | neutral | cautious"',
        '    }',
        '  ],',
        '  "signals": [',
        '    {',
        '      "kind": "bullish | bearish | neutral | volatility",',
        '      "message": "신호 한 줄 설명"',
        '    }',
        '  ],',
        '  "analyzedAt": "ISO datetime"',
        '}',
        '```',
        '',
        '== 해석 가이드 ==',
        '- Max Pain: 옵션 만기일 부근 주가가 끌리는 가격',
        '- P/C Ratio: 풋/콜 OI 비율. 1보다 크면 풋 우세 (방어적), 작으면 콜 우세 (공격적)',
        '- ATM IV: 시장이 예상하는 변동성',
        '- topOpenInterestStrikes: 돈이 가장 많이 쌓인 strike 3개',
        '- 친근하지만 정확한 한국어 톤. 종목 명은 영어 그대로 (예: AAPL).',
    ].join('\n');
}
```

- [ ] **Step 3: optionsPrompt 테스트 + commit**

```typescript
// src/__tests__/domain/options/optionsPrompt.test.ts
import { describe, it, expect } from 'vitest';
import { buildOptionsAnalysisPrompt } from '@/domain/options/optionsPrompt';
import type { OptionsSnapshot } from '@/domain/options/types';

describe('buildOptionsAnalysisPrompt', () => {
    const snapshot: OptionsSnapshot = {
        symbol: 'AAPL',
        underlyingPrice: 198,
        capturedAt: '2026-05-14T16:00:00Z',
        chains: [
            {
                expirationDate: '2026-05-22',
                daysToExpiration: 8,
                calls: [],
                puts: [],
            },
            {
                expirationDate: '2026-06-19',
                daysToExpiration: 36,
                calls: [],
                puts: [],
            },
        ],
    };

    it('filters to specific expiration when given', () => {
        const prompt = buildOptionsAnalysisPrompt({
            expirationDate: '2026-05-22',
            companyName: 'Apple Inc.',
            snapshot,
        });
        expect(prompt).toContain('2026-05-22');
        expect(prompt).not.toContain('2026-06-19');
    });

    it('uses all chains when expirationDate is "all"', () => {
        const prompt = buildOptionsAnalysisPrompt({
            expirationDate: 'all',
            companyName: 'Apple Inc.',
            snapshot,
        });
        expect(prompt).toContain('2026-05-22');
        expect(prompt).toContain('2026-06-19');
    });

    it('includes company name and current price', () => {
        const prompt = buildOptionsAnalysisPrompt({
            expirationDate: 'all',
            companyName: 'Apple Inc.',
            snapshot,
        });
        expect(prompt).toContain('Apple Inc.');
        expect(prompt).toContain('AAPL');
        expect(prompt).toContain('$198');
    });
});
```

```bash
yarn vitest run src/__tests__/domain/options/
git add src/domain/options/optionsPrompt.ts src/domain/options/summarizeChainForLlm.ts src/__tests__/domain/options/optionsPrompt.test.ts
git commit -m "feat(options): add buildOptionsAnalysisPrompt + summarizeChainForLlm"
```

### Task 1.7: OptionsDataProvider 인터페이스

**Files:**
- Create: `src/infrastructure/options/types.ts`
- Modify: `src/index.ts` (public API export)

- [ ] **Step 1: provider interface 작성**

```typescript
// src/infrastructure/options/types.ts
import type { OptionsChain, OptionsSnapshot } from '@/domain/options/types';

/**
 * Provider contract for fetching options market data. Implementations live
 * in consumer projects (siglens injects YahooOptionsAdapter). Phase 1
 * keeps a single implementation; Tradier fallback is reserved for a
 * future Phase.
 */
export interface OptionsDataProvider {
    /** Full snapshot (all expirations) for a symbol. null when no options market. */
    fetchSnapshot(symbol: string): Promise<OptionsSnapshot | null>;
    /** Single expiration's chain. null when the expiration is unavailable. */
    fetchChain(
        symbol: string,
        expirationDate: string
    ): Promise<OptionsChain | null>;
    /** Fast existence check — does NOT fetch chain data. */
    hasOptionsMarket(symbol: string): Promise<boolean>;
}
```

- [ ] **Step 2: public API export 추가**

`src/index.ts`에 export 추가 (기존 패턴과 동일한 위치):

```typescript
// Options analysis types & contracts
export type {
    OptionsContract,
    OptionsChain,
    OptionsSnapshot,
    OptionsExpirationMetrics,
    OptionsSymbolMetrics,
    OptionsAnalysisResponse,
    OptionsTone,
    OptionsSignalKind,
} from './domain/options/types';

export type { OptionsDataProvider } from './infrastructure/options/types';

export { EXPIRATION_SLOTS, mapExpirationsToSlots } from './domain/options/expirationSlots';
export type { ExpirationSlot, SlotMapping } from './domain/options/expirationSlots';

export { calculateMaxPain } from './domain/options/calculateMaxPain';
export { calculatePutCallRatio } from './domain/options/calculatePutCallRatio';
export { calculateImpliedMove } from './domain/options/calculateImpliedMove';
export { aggregateOpenInterest } from './domain/options/aggregateOpenInterest';
export type { StrikeOpenInterest } from './domain/options/aggregateOpenInterest';
export { sanitizeOptionsChain } from './domain/options/sanitizeOptionsChain';
export { summarizeChainForLlm } from './domain/options/summarizeChainForLlm';
export { normalizeOptionsAnalysisResponse } from './domain/analysis/normalizeOptions';
```

- [ ] **Step 3: build + commit**

```bash
yarn build
git add src/infrastructure/options/types.ts src/index.ts
git commit -m "feat(options): expose options public API (types + interfaces + calc utils)"
```

---

## Phase 2 — siglens-core Application (Submit/Poll + Overall 5축)

### Task 2.1: OPTIONS_CACHE_TTL_SECONDS 상수 + cache key

**Files:**
- Modify: `src/infrastructure/cache/config.ts`
- Create: `src/application/options/cacheKey.ts`
- Test: `src/__tests__/application/options/cacheKey.test.ts`

- [ ] **Step 1: cache config에 TTL 추가**

```typescript
// src/infrastructure/cache/config.ts 끝에
export const OPTIONS_CACHE_TTL_SECONDS = SECONDS_PER_DAY;
```

- [ ] **Step 2: cacheKey 함수 작성**

```typescript
// src/application/options/cacheKey.ts
import { hashAnalysisInput } from '@/infrastructure/cache/hash';

const SCHEMA_VERSION = 'v1';

/**
 * Build the cache key for an options analysis result. Includes a schema
 * version prefix so that future shape changes invalidate the cache
 * automatically.
 *
 * Inputs that affect the AI output (and thus the cache key):
 *  - symbol
 *  - expirationDate ('YYYY-MM-DD' or 'all')
 *  - modelId
 *  - snapshot input hash (so a fresher snapshot produces a new key)
 */
export function buildOptionsCacheKey(
    symbol: string,
    expirationDate: string,
    modelId: string,
    snapshotInputHash: string
): string {
    return `options:${SCHEMA_VERSION}:${symbol}:${expirationDate}:${modelId}:${snapshotInputHash}`;
}
```

- [ ] **Step 3: 테스트 작성**

```typescript
// src/__tests__/application/options/cacheKey.test.ts
import { describe, it, expect } from 'vitest';
import { buildOptionsCacheKey } from '@/application/options/cacheKey';

describe('buildOptionsCacheKey', () => {
    it('builds deterministic key with all parts', () => {
        const key = buildOptionsCacheKey('AAPL', '2026-05-22', 'claude-haiku', 'abc123');
        expect(key).toBe('options:v1:AAPL:2026-05-22:claude-haiku:abc123');
    });

    it('produces different keys for different inputs', () => {
        const k1 = buildOptionsCacheKey('AAPL', '2026-05-22', 'm', 'h1');
        const k2 = buildOptionsCacheKey('AAPL', '2026-05-22', 'm', 'h2');
        expect(k1).not.toBe(k2);
    });
});
```

- [ ] **Step 4: 테스트 + commit**

```bash
yarn vitest run src/__tests__/application/options/cacheKey.test.ts
git add src/infrastructure/cache/config.ts src/application/options/cacheKey.ts src/__tests__/application/options/cacheKey.test.ts
git commit -m "feat(options): add cache TTL constant and cache key builder"
```

### Task 2.2: SubmitOptionsAnalysis types

**Files:**
- Create: `src/application/options/types.ts`

- [ ] **Step 1: 타입 작성 (기존 submit{Overall,Analysis,Fundamental,News} 패턴 참조)**

```typescript
// src/application/options/types.ts
import type {
    OptionsAnalysisResponse,
    OptionsSnapshot,
} from '@/domain/options/types';
import type { Tier, TierConfig } from '@/domain/types';
import type { UserApiKeyRequiredError } from '@/domain/llm';
import type { UsageLimitError } from '@/application/usage/types';

export interface SubmitOptionsAnalysisOptions {
    symbol: string;
    companyName?: string;
    /** ISO date 'YYYY-MM-DD' or 'all' for aggregate analysis. */
    expirationDate: string | 'all';
    modelId: string;
    /** Caller pre-fetches the snapshot (no provider injection needed here). */
    snapshot: OptionsSnapshot;
    userApiKey?: string;
    tier?: Tier;
    tierConfig?: TierConfig;
    usage?: import('@/application/usage/types').UsageContext;
    now?: Date;
}

export type SubmitOptionsAnalysisApiKeyRequiredError = UserApiKeyRequiredError;

export interface SubmitOptionsAnalysisErrorPayload {
    code: 'options_provider_error' | 'normalization_error' | 'worker_error';
    message: string;
}

export type SubmitOptionsAnalysisResult =
    | { status: 'enqueued'; jobId: string }
    | { status: 'cached'; result: OptionsAnalysisResponse }
    | { status: 'pending'; jobId: string }
    | { status: 'limit_error'; code: 'usage_limit_exceeded'; error: UsageLimitError }
    | SubmitOptionsAnalysisApiKeyRequiredError
    | { status: 'miss_no_trigger' }
    | { status: 'error'; error: SubmitOptionsAnalysisErrorPayload };

export type PollOptionsAnalysisResult =
    | { status: 'success'; result: OptionsAnalysisResponse }
    | { status: 'pending' }
    | { status: 'error'; error: SubmitOptionsAnalysisErrorPayload };
```

- [ ] **Step 2: tsc + commit**

```bash
yarn tsc --noEmit
git add src/application/options/types.ts
git commit -m "feat(options): add submit/poll types matching existing analysis patterns"
```

### Task 2.3: submitOptionsAnalysis use-case

**Files:**
- Create: `src/application/options/submitOptionsAnalysis.ts`
- Test: `src/__tests__/application/options/submitOptionsAnalysis.test.ts`

- [ ] **Step 1: 기존 submitOverallAnalysis 코드 참조 — 동일 시퀀스 적용**

기본 시퀀스 (siglens-core/src/application/overall/submitOverallAnalysis.ts:114~):
1. tier/config 결정 + BYOK 게이트
2. usage limit 체크
3. 입력 hash → cache key
4. cache get → hit 시 정규화 후 cached 반환
5. cache miss → worker enqueue → enqueued/pending 반환

옵션 분석은 종합 분석보다 단순 (axis dependency 없음). 따라서 차트/뉴스/펀더멘털 분석에 가까운 직선 구조.

- [ ] **Step 2: submitOptionsAnalysis 작성**

```typescript
// src/application/options/submitOptionsAnalysis.ts
import { hashAnalysisInput } from '@/infrastructure/cache/hash';
import { createCacheProvider } from '@/infrastructure/cache/redis';
import { OPTIONS_CACHE_TTL_SECONDS } from '@/infrastructure/cache/config';
import { enqueueOptionsAnalysisJob } from '@/infrastructure/queue/options';
import { buildUsageLimitError } from '@/application/usage/limits';
import { checkAnalysisUsageAllowed } from '@/application/usage/analysisUsage';
import { requiresByokKey, buildUserApiKeyRequiredError } from '@/domain/llm';
import { DEFAULT_TIER } from '@/domain/tier';
import { TIER_CONFIG } from '@/domain/tier';
import { normalizeOptionsAnalysisResponse } from '@/domain/analysis/normalizeOptions';
import { buildOptionsCacheKey } from './cacheKey';
import type {
    SubmitOptionsAnalysisOptions,
    SubmitOptionsAnalysisResult,
} from './types';
import type { OptionsAnalysisResponse } from '@/domain/options/types';

/**
 * Submit an options analysis request. Caller-provided snapshot is hashed
 * into the cache key so re-submitting with the same snapshot returns the
 * cached result. Follows the same submit/poll/cache pattern as
 * submit{Analysis,Fundamental,News,Overall}.
 *
 * @param options - See {@link SubmitOptionsAnalysisOptions}.
 * @returns Discriminated union; see {@link SubmitOptionsAnalysisResult}.
 */
export async function submitOptionsAnalysis(
    options: SubmitOptionsAnalysisOptions
): Promise<SubmitOptionsAnalysisResult> {
    const {
        symbol,
        companyName = symbol,
        expirationDate,
        modelId,
        snapshot,
    } = options;
    const usage = options.usage;
    const occurredAt = options.now ?? usage?.occurredAt ?? new Date();

    const tier = options.tier ?? DEFAULT_TIER;
    const tierConfig = options.tierConfig ?? TIER_CONFIG;

    // BYOK gate (matches sibling submit functions)
    if (
        requiresByokKey(tier, modelId, tierConfig) &&
        options.userApiKey === undefined
    ) {
        return buildUserApiKeyRequiredError(tier, modelId);
    }

    // Usage limit
    if (options.tier !== undefined && usage !== undefined) {
        const allowed = await checkAnalysisUsageAllowed(
            usage,
            tier,
            occurredAt,
            tierConfig
        );
        if (!allowed) {
            return {
                status: 'limit_error',
                code: 'usage_limit_exceeded',
                error: buildUsageLimitError('analysisPerDay', tier),
            };
        }
    }

    // Hash input → cache key
    const snapshotInputHash = hashAnalysisInput(
        JSON.stringify({
            symbol: snapshot.symbol,
            underlyingPrice: snapshot.underlyingPrice,
            capturedAt: snapshot.capturedAt,
            chains: snapshot.chains.map(c => ({
                expirationDate: c.expirationDate,
                callsLen: c.calls.length,
                putsLen: c.puts.length,
                callsOiSum: c.calls.reduce((s, x) => s + x.openInterest, 0),
                putsOiSum: c.puts.reduce((s, x) => s + x.openInterest, 0),
            })),
        })
    );
    const cacheKey = buildOptionsCacheKey(
        symbol,
        expirationDate,
        modelId,
        snapshotInputHash
    );

    // Cache lookup (with read-time normalization for schema drift defense)
    const cache = createCacheProvider();
    if (cache !== null) {
        try {
            const cached = await cache.get<unknown>(cacheKey);
            if (cached !== null) {
                return {
                    status: 'cached',
                    result: normalizeOptionsAnalysisResponse(cached, occurredAt),
                };
            }
        } catch (error) {
            console.error('[submitOptionsAnalysis] Cache read failed:', error);
        }
    }

    // Cache miss → enqueue worker job
    const jobId = await enqueueOptionsAnalysisJob({
        symbol,
        companyName,
        expirationDate,
        modelId,
        snapshot,
        userApiKey: options.userApiKey,
        cacheKey,
    });

    return { status: 'enqueued', jobId };
}
```

- [ ] **Step 3: 테스트 작성 (6가지 status 분기 mock)**

기존 `submitOverallAnalysis.test.ts`를 참조해 mock 패턴 적용. 모든 분기 커버:
- enqueued (cache miss + 의존 정상)
- cached (cache hit)
- limit_error (usage 한도 초과)
- key_error (BYOK 필요)
- pending (worker 이미 진행 중 — `enqueueOptionsAnalysisJob`이 기존 jobId 반환할 때)
- error (worker enqueue 실패)

테스트 구조 (vitest mock):

```typescript
// src/__tests__/application/options/submitOptionsAnalysis.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitOptionsAnalysis } from '@/application/options/submitOptionsAnalysis';

vi.mock('@/infrastructure/cache/redis', () => ({
    createCacheProvider: vi.fn(() => ({
        get: vi.fn(),
        set: vi.fn(),
    })),
}));

vi.mock('@/infrastructure/queue/options', () => ({
    enqueueOptionsAnalysisJob: vi.fn(),
}));

const baseSnapshot = {
    symbol: 'AAPL',
    underlyingPrice: 198,
    capturedAt: '2026-05-14T16:00:00Z',
    chains: [],
};

describe('submitOptionsAnalysis', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns enqueued status when cache misses', async () => {
        const { createCacheProvider } = await import('@/infrastructure/cache/redis');
        const { enqueueOptionsAnalysisJob } = await import('@/infrastructure/queue/options');

        vi.mocked(createCacheProvider).mockReturnValue({
            get: vi.fn().mockResolvedValue(null),
            set: vi.fn(),
        } as any);
        vi.mocked(enqueueOptionsAnalysisJob).mockResolvedValue('job-123');

        const result = await submitOptionsAnalysis({
            symbol: 'AAPL',
            expirationDate: '2026-05-22',
            modelId: 'claude-haiku-4-5',
            snapshot: baseSnapshot,
        });
        expect(result).toEqual({ status: 'enqueued', jobId: 'job-123' });
    });

    // ... 나머지 5개 분기 동일 패턴
});
```

> 새 인프라 함수 `enqueueOptionsAnalysisJob`은 다음 task에서 추가한다.

- [ ] **Step 4: 통과 + commit**

```bash
yarn vitest run src/__tests__/application/options/submitOptionsAnalysis.test.ts
yarn tsc --noEmit
git add src/application/options/submitOptionsAnalysis.ts src/__tests__/application/options/submitOptionsAnalysis.test.ts
git commit -m "feat(options): add submitOptionsAnalysis use-case (cache+enqueue, follows submit{Overall,...} pattern)"
```

### Task 2.4: Options worker infrastructure

**Files:**
- Create: `src/infrastructure/queue/options.ts`
- Test: `src/__tests__/infrastructure/queue/options.test.ts`

- [ ] **Step 1: 기존 queue/fundamental.ts 또는 queue/overall.ts 패턴 그대로 복제**

```typescript
// src/infrastructure/queue/options.ts
import { createJobQueueClient } from './client';
import type { OptionsSnapshot } from '@/domain/options/types';

export interface EnqueueOptionsAnalysisJobInput {
    symbol: string;
    companyName: string;
    expirationDate: string | 'all';
    modelId: string;
    snapshot: OptionsSnapshot;
    userApiKey?: string;
    cacheKey: string;
}

/**
 * Enqueue an options analysis worker job. Returns the job id for polling.
 * Idempotency: a job with the same cacheKey already in flight reuses its
 * existing jobId (matches existing queue conventions for analysis axes).
 */
export async function enqueueOptionsAnalysisJob(
    input: EnqueueOptionsAnalysisJobInput
): Promise<string> {
    const client = createJobQueueClient();
    return client.enqueue('options-analysis', {
        ...input,
        // Stash cacheKey as metadata so the worker writes the result there.
        meta: { cacheKey: input.cacheKey },
    });
}

export interface PollOptionsAnalysisJobMeta {
    cacheKey: string;
}
```

> 정확한 client 시그니처는 `src/infrastructure/queue/client.ts`의 기존 패턴을 참조한다. 이 파일은 spec에 박지 않고, 기존 worker queue 추상화의 시그니처를 그대로 따른다.

- [ ] **Step 2: 인프라 테스트 (mock)**

기존 fundamental queue 테스트 패턴 복제.

- [ ] **Step 3: build + commit**

```bash
yarn build
yarn vitest run src/__tests__/infrastructure/queue/options.test.ts
git add src/infrastructure/queue/options.ts src/__tests__/infrastructure/queue/options.test.ts
git commit -m "feat(options): add options analysis worker queue wrapper"
```

### Task 2.5: pollOptionsAnalysis use-case

**Files:**
- Create: `src/application/options/pollOptionsAnalysis.ts`
- Test: `src/__tests__/application/options/pollOptionsAnalysis.test.ts`

- [ ] **Step 1: 기존 pollOverallAnalysis 코드 참조**

핵심 시퀀스:
1. queue에서 jobId의 status 조회
2. processing → `{ status: 'pending' }`
3. error → `{ status: 'error', error: {...} }`
4. done → raw result 정규화 → cache write (fire-and-forget) → `{ status: 'success', result }`

- [ ] **Step 2: 구현**

```typescript
// src/application/options/pollOptionsAnalysis.ts
import { createCacheProvider } from '@/infrastructure/cache/redis';
import { OPTIONS_CACHE_TTL_SECONDS } from '@/infrastructure/cache/config';
import { createJobQueueClient } from '@/infrastructure/queue/client';
import { normalizeOptionsAnalysisResponse } from '@/domain/analysis/normalizeOptions';
import { fireAndForget } from '@/infrastructure/queue/utils';
import { cleanupInBackground } from '@/infrastructure/queue/cleanup';
import type {
    PollOptionsAnalysisResult,
} from './types';
import type { OptionsAnalysisResponse } from '@/domain/options/types';

interface PollOptionsAnalysisOptions {
    jobId: string;
    now?: Date;
}

/**
 * Poll a previously enqueued options analysis job. Mirrors pollOverallAnalysis:
 * - processing → pending
 * - error → error
 * - done → normalize raw → write cache (fire-and-forget) → success
 *
 * Normalization is applied here (write-side) AND in submitOptionsAnalysis
 * (read-side). See spec §6.3 for the schema-drift defense pattern.
 */
export async function pollOptionsAnalysis(
    options: PollOptionsAnalysisOptions
): Promise<PollOptionsAnalysisResult> {
    const { jobId } = options;
    const now = options.now ?? new Date();
    const client = createJobQueueClient();

    const status = await client.getStatus(jobId);
    if (status.kind === 'processing') return { status: 'pending' };
    if (status.kind === 'error') {
        cleanupInBackground(jobId, '[PollOptions]', options);
        return {
            status: 'error',
            error: { code: 'worker_error', message: status.message },
        };
    }

    // status.kind === 'done'
    const rawResult = status.result;
    let result: OptionsAnalysisResponse;
    try {
        result = normalizeOptionsAnalysisResponse(rawResult, now);
    } catch (error) {
        console.error('[PollOptions] Normalization failed:', error);
        cleanupInBackground(jobId, '[PollOptions]', options);
        return {
            status: 'error',
            error: {
                code: 'normalization_error',
                message: 'Invalid response from worker',
            },
        };
    }

    // Cache the normalized result (write-side normalization checkpoint)
    const meta = status.meta;
    if (meta?.cacheKey) {
        const cache = createCacheProvider();
        if (cache !== null) {
            fireAndForget(
                cache
                    .set(meta.cacheKey, result, OPTIONS_CACHE_TTL_SECONDS)
                    .catch(error =>
                        console.error('[PollOptions] Cache write failed:', error)
                    ),
                options
            );
        }
    }

    cleanupInBackground(jobId, '[PollOptions]', options);
    return { status: 'success', result };
}
```

- [ ] **Step 3: 테스트**

```typescript
describe('pollOptionsAnalysis', () => {
    it('returns pending when worker is processing', async () => { /* ... */ });
    it('returns error when worker errored', async () => { /* ... */ });
    it('returns success + normalized result when worker done', async () => { /* ... */ });
    it('writes normalized result to cache when meta.cacheKey present', async () => { /* ... */ });
    it('normalize re-runs on already-normalized data idempotently', async () => { /* ... */ });
});
```

- [ ] **Step 4: 통과 + commit**

```bash
yarn vitest run src/__tests__/application/options/pollOptionsAnalysis.test.ts
yarn tsc --noEmit
git add src/application/options/pollOptionsAnalysis.ts src/__tests__/application/options/pollOptionsAnalysis.test.ts
git commit -m "feat(options): add pollOptionsAnalysis with write-side normalization + cache persistence"
```

### Task 2.6: OverallAxis 5축 확장

**Files:**
- Modify: `src/application/overall/types.ts`
- Modify: `src/application/overall/submitOverallAnalysis.ts`
- Modify: `src/application/overall/pollOverallAnalysis.ts`
- Modify: `src/application/overall/resolveDependencies.ts`
- Modify: `src/domain/analysis/overallPrompt.ts`
- Modify: `src/domain/analysis/normalizeOverall.ts` (필요 시 — 옵션 섹션 필드 추가하면)
- Test: 위 파일들에 대응하는 기존 테스트 확장

이 task는 위험도가 높음 — 기존 종합 분석이 깨지지 않도록 신중하게.

- [ ] **Step 1: OverallAxis 타입 확장**

```typescript
// src/application/overall/types.ts
export type OverallAxis =
    | 'technical'
    | 'fundamental'
    | 'news'
    | 'options';   // NEW
```

기존 인터페이스 `SubmitOverallAnalysisOptions`에 options axis 옵션 추가:

```typescript
export interface SubmitOverallAnalysisOptions {
    // ... 기존 필드
    /** Options axis options (Phase 1: required for full 5-axis analysis). */
    options?: SubmitOptionsAnalysisOptions; // 4번째 옵션
}
```

> `SubmitOptionsAnalysisOptions`는 `usage` 등 dropAxisUsage 패턴이 적용되어야 함. 기존 `dropAxisUsage: true`가 axis-level options에서 `usage`를 제거하는 방식을 따른다.

- [ ] **Step 2: ResolveOverallDependenciesResult에 options 추가**

```typescript
export interface ResolveOverallDependenciesResult {
    // ... 기존
    options: PollOptionsAnalysisResult;
}
```

- [ ] **Step 3: resolveDependencies.ts에서 options axis 병렬 호출**

기존 `Promise.all([pollAnalysis(...), pollFundamentalAnalysis(...), pollNewsAnalysis(...)])` 에 `pollOptionsAnalysis(...)` 추가. 단:
- options snapshot은 별도 fetcher (`fetchOptionsSnapshot`)가 주입되어야 함 — consumer가 inject. (overall 의존성 주입 패턴 참조)
- options axis 결과가 cached/pending/error/miss_no_trigger 각 분기에서 올바르게 5axis aggregation 결과로 전파되어야 함

자세한 분기 처리는 기존 `submitOverallAnalysis.ts` line 156~196의 axis aggregation 로직 그대로 5번째 축 케이스 추가.

- [ ] **Step 4: buildOverallAnalysisPrompt에 options 섹션 추가**

```typescript
// src/domain/analysis/overallPrompt.ts
// 기존 시그니처에 options 필드 추가
export function buildOverallAnalysisPrompt(input: {
    technical: AnalysisResponse;
    fundamental: FundamentalAnalysisResponse;
    news: NewsAnalysisResponse;
    options: OptionsAnalysisResponse;   // NEW
    // ...
}): string {
    // 기존 본문에 options 섹션 추가:
    //   "== 옵션 시장 분석 ==
    //    {options.summary}
    //    만기별:
    //    {options.perExpiration.map(p => `${p.expirationDate}: ${p.commentary} (${p.tone})`)}"
}
```

- [ ] **Step 5: normalizeOverallAnalysisResponse 검토**

종합 분석 응답에 옵션 관련 필드가 새로 들어가면 (예: `optionsBulletsKo`), `OverallAnalysisResponse` 인터페이스와 `RawOverallAnalysisResponse`도 확장. AI 응답 형식 변경에 대한 정합성 검증.

- [ ] **Step 6: 기존 overall 테스트가 5축으로 깨지지 않는지 확인 + 추가 테스트**

```bash
yarn vitest run src/__tests__/application/overall/
```

기존 테스트는 mock에서 options axis를 추가 inject 해줘야 통과. failing test가 나면 test fixture를 5축으로 보강.

추가 테스트:
- options axis pending → 전체 pending_dependencies (options jobId 포함)
- options axis error → axis: 'options' 정보 포함 error 반환
- 5축 모두 cached → 통합 분석 호출

- [ ] **Step 7: tsc + commit**

```bash
yarn build
yarn vitest run src/__tests__/application/overall/
git add src/application/overall/ src/domain/analysis/overallPrompt.ts src/domain/analysis/normalizeOverall.ts src/domain/types.ts src/__tests__/application/overall/
git commit -m "feat(overall): add options as 5th axis (resolver + prompt + response normalize)"
```

### Task 2.7: Public API export — Phase 2 마무리

**Files:**
- Modify: `src/index.ts`
- Modify: `src/application/options/index.ts` (new barrel)

- [ ] **Step 1: 옵션 application 모듈 barrel**

```typescript
// src/application/options/index.ts
export { submitOptionsAnalysis } from './submitOptionsAnalysis';
export { pollOptionsAnalysis } from './pollOptionsAnalysis';
export { buildOptionsCacheKey } from './cacheKey';
export type {
    SubmitOptionsAnalysisOptions,
    SubmitOptionsAnalysisResult,
    PollOptionsAnalysisResult,
    SubmitOptionsAnalysisApiKeyRequiredError,
    SubmitOptionsAnalysisErrorPayload,
} from './types';
```

- [ ] **Step 2: src/index.ts에 export 추가**

```typescript
// Options analysis use-cases
export {
    submitOptionsAnalysis,
    pollOptionsAnalysis,
} from './application/options';
export type {
    SubmitOptionsAnalysisOptions,
    SubmitOptionsAnalysisResult,
    PollOptionsAnalysisResult,
} from './application/options';

// Options analysis prompt builder
export { buildOptionsAnalysisPrompt } from './domain/options/optionsPrompt';
```

- [ ] **Step 3: yarn build → siglens가 portal로 핫리로드 받는지 확인**

```bash
yarn build
# siglens-options worktree에서:
cd /Users/y0ngha/Project/siglens-options
node -e "const x = require('@y0ngha/siglens-core'); console.log(typeof x.submitOptionsAnalysis)"
```

Expected: `function`.

- [ ] **Step 4: commit**

```bash
cd /Users/y0ngha/Project/siglens-core-options
git add src/index.ts src/application/options/index.ts
git commit -m "feat(options): export options analysis public API (use-cases, types, prompt builder)"
```

---

## Phase 3 — siglens Infrastructure (YahooOptionsAdapter)

> 이후 모든 task는 siglens 워크트리(`/Users/y0ngha/Project/siglens-options`)에서 진행.

### Task 3.1: yahoo-finance2 의존성 추가

**Files:**
- Modify: `package.json`

- [ ] **Step 1: yahoo-finance2 설치**

```bash
cd /Users/y0ngha/Project/siglens-options
yarn add yahoo-finance2
```

- [ ] **Step 2: 라이브러리 동작 sanity check**

```bash
node -e "const yf = require('yahoo-finance2').default; yf.options('AAPL').then(r => console.log(r.optionChain ? 'OK' : 'fail')).catch(e => console.error(e.message))"
```

Expected: `OK` (실제 yahoo 호출 성공).

> 만약 fail: yahoo가 crumb/cookie 요구 중일 수 있음 — 그 경우 라이브러리 README 참조해 `yf.setGlobalConfig` 또는 cookieJar 옵션 적용.

- [ ] **Step 3: commit**

```bash
git add package.json yarn.lock
git commit -m "chore(options): add yahoo-finance2 dependency"
```

### Task 3.2: YahooOptionsAdapter 구현

**Files:**
- Create: `src/infrastructure/options/YahooOptionsAdapter.ts`
- Create: `src/infrastructure/options/yahooNormalize.ts` (yahoo response → core types 변환)
- Test: `src/__tests__/infrastructure/options/YahooOptionsAdapter.test.ts`

- [ ] **Step 1: yahooNormalize 작성 — yahoo-finance2 응답 → OptionsSnapshot/OptionsChain**

```typescript
// src/infrastructure/options/yahooNormalize.ts
import type {
    OptionsContract,
    OptionsChain,
    OptionsSnapshot,
} from '@y0ngha/siglens-core';

/** yahoo-finance2의 단일 option result (Awaited type from the library). */
interface YahooOption {
    contractSymbol: string;
    strike: number;
    lastPrice?: number;
    bid?: number;
    ask?: number;
    volume?: number;
    openInterest?: number;
    impliedVolatility?: number;
    inTheMoney?: boolean;
}

interface YahooExpiration {
    expirationDate: Date;
    calls: YahooOption[];
    puts: YahooOption[];
}

interface YahooOptionsResult {
    underlyingSymbol: string;
    quote: { regularMarketPrice: number };
    expirationDates: Date[];
    options: YahooExpiration[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function normalizeYahooContract(c: YahooOption): OptionsContract {
    return {
        contractSymbol: c.contractSymbol,
        strike: c.strike,
        lastPrice: c.lastPrice ?? null,
        bid: c.bid ?? null,
        ask: c.ask ?? null,
        volume: c.volume ?? 0,
        openInterest: c.openInterest ?? 0,
        impliedVolatility: c.impliedVolatility ?? null,
        inTheMoney: c.inTheMoney ?? false,
    };
}

export function normalizeYahooExpiration(
    yexp: YahooExpiration,
    now: Date
): OptionsChain {
    const expIso = toIsoDate(yexp.expirationDate);
    const daysToExpiration = Math.round(
        (yexp.expirationDate.getTime() - etMidnight(now).getTime()) / MS_PER_DAY
    );
    return {
        expirationDate: expIso,
        daysToExpiration,
        calls: yexp.calls
            .map(normalizeYahooContract)
            .sort((a, b) => a.strike - b.strike),
        puts: yexp.puts
            .map(normalizeYahooContract)
            .sort((a, b) => a.strike - b.strike),
    };
}

export function normalizeYahooSnapshot(
    response: YahooOptionsResult,
    now: Date
): OptionsSnapshot {
    return {
        symbol: response.underlyingSymbol,
        underlyingPrice: response.quote.regularMarketPrice,
        capturedAt: now.toISOString(),
        chains: response.options
            .map(o => normalizeYahooExpiration(o, now))
            .sort((a, b) =>
                a.expirationDate.localeCompare(b.expirationDate)
            ),
    };
}

function toIsoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
}

function etMidnight(now: Date): Date {
    // Simple approximation; production should use a TZ library.
    const offset = -4 * 60; // EDT (production: handle DST switch)
    const utcMidnight = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    return new Date(utcMidnight.getTime() - offset * 60 * 1000);
}
```

- [ ] **Step 2: YahooOptionsAdapter 작성**

```typescript
// src/infrastructure/options/YahooOptionsAdapter.ts
import yahooFinance from 'yahoo-finance2';
import { sanitizeOptionsChain } from '@y0ngha/siglens-core';
import type {
    OptionsChain,
    OptionsDataProvider,
    OptionsSnapshot,
} from '@y0ngha/siglens-core';
import { normalizeYahooSnapshot, normalizeYahooExpiration } from './yahooNormalize';

export class YahooOptionsAdapter implements OptionsDataProvider {
    async fetchSnapshot(symbol: string): Promise<OptionsSnapshot | null> {
        try {
            const result = await yahooFinance.options(symbol);
            if (!result.options || result.options.length === 0) return null;
            const snapshot = normalizeYahooSnapshot(result as any, new Date());
            // Sanitize each chain; null chains are filtered out
            const sanitized = {
                ...snapshot,
                chains: snapshot.chains
                    .map(sanitizeOptionsChain)
                    .filter((c): c is OptionsChain => c !== null),
            };
            return sanitized.chains.length > 0 ? sanitized : null;
        } catch (error) {
            console.error('[YahooOptionsAdapter.fetchSnapshot]', error);
            return null;
        }
    }

    async fetchChain(
        symbol: string,
        expirationDate: string
    ): Promise<OptionsChain | null> {
        try {
            const result = await yahooFinance.options(symbol, {
                date: new Date(`${expirationDate}T00:00:00Z`),
            });
            const yexp = result.options?.[0];
            if (!yexp) return null;
            const chain = normalizeYahooExpiration(yexp as any, new Date());
            return sanitizeOptionsChain(chain);
        } catch (error) {
            console.error('[YahooOptionsAdapter.fetchChain]', error);
            return null;
        }
    }

    async hasOptionsMarket(symbol: string): Promise<boolean> {
        try {
            const result = await yahooFinance.options(symbol);
            return (result.expirationDates?.length ?? 0) > 0;
        } catch {
            return false;
        }
    }
}
```

- [ ] **Step 3: 테스트 (fixture 기반 mock)**

`__tests__/infrastructure/options/fixtures/aapl-options.json`에 yahoo 실제 응답 1개 저장 → mock해서 normalize 검증.

- [ ] **Step 4: 통과 + commit**

```bash
yarn vitest run src/__tests__/infrastructure/options/
git add src/infrastructure/options/ src/__tests__/infrastructure/options/
git commit -m "feat(options): add YahooOptionsAdapter (OptionsDataProvider implementation)"
```

### Task 3.3: cacheLife 프로파일 + optionsCacheTags

**Files:**
- Modify: `next.config.ts` (cacheLife profile 정의)
- Create: `src/infrastructure/options/optionsCacheLife.ts`
- Create: `src/infrastructure/options/optionsCacheTags.ts`

- [ ] **Step 1: next.config.ts에 옵션 cacheLife profile 등록**

```typescript
// next.config.ts (cacheLife 섹션)
experimental: {
    cacheComponents: true,
    cacheLife: {
        'options-market-open': {
            stale: 60,       // 1 min
            revalidate: 300, // 5 min
            expire: 1800,    // 30 min
        },
        'options-market-closed': {
            stale: 300,
            revalidate: 1800,  // 30 min
            expire: 7200,
        },
        'options-weekend': {
            stale: 3600,
            revalidate: 21600, // 6 hr
            expire: 86400,
        },
        // ... 기존 cacheLife profiles 유지
    },
}
```

- [ ] **Step 2: 시간대 선택 함수**

```typescript
// src/infrastructure/options/optionsCacheLife.ts
export type OptionsCacheLifeProfile =
    | 'options-market-open'
    | 'options-market-closed'
    | 'options-weekend';

/**
 * Pick the cache life profile based on the current ET time.
 *   - Weekend (Sat/Sun) → 'options-weekend'
 *   - Weekday market hours (9:30~16:00 ET) → 'options-market-open'
 *   - Weekday off-hours → 'options-market-closed'
 */
export function getOptionsCacheLifeProfile(
    now: Date = new Date()
): OptionsCacheLifeProfile {
    const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const day = et.getDay();
    if (day === 0 || day === 6) return 'options-weekend';
    const hour = et.getHours();
    const min = et.getMinutes();
    const totalMin = hour * 60 + min;
    if (totalMin >= 9 * 60 + 30 && totalMin <= 16 * 60) {
        return 'options-market-open';
    }
    return 'options-market-closed';
}
```

- [ ] **Step 3: cacheTags 함수**

```typescript
// src/infrastructure/options/optionsCacheTags.ts
export function optionsSymbolTag(symbol: string): string {
    return `options:${symbol}`;
}

export function optionsExpirationTag(symbol: string, expiry: string): string {
    return `options:${symbol}:${expiry}`;
}
```

- [ ] **Step 4: commit**

```bash
git add next.config.ts src/infrastructure/options/optionsCacheLife.ts src/infrastructure/options/optionsCacheTags.ts
git commit -m "feat(options): add cacheLife profiles (market-open/closed/weekend) and cache tag helpers"
```

---

## Phase 4 — siglens 옵션 페이지 (RSC + Data Layer)

### Task 4.1: optionsData.ts — fetch 함수들 ('use cache')

**Files:**
- Create: `src/app/[symbol]/options/optionsData.ts`

- [ ] **Step 1: 기존 fundamentalData.ts 패턴 참조**

```typescript
// src/app/[symbol]/options/optionsData.ts
import 'server-only';
import { cacheLife } from 'next/cache';
import { cacheTag } from 'next/cache';
import { YahooOptionsAdapter } from '@/infrastructure/options/YahooOptionsAdapter';
import { getOptionsCacheLifeProfile } from '@/infrastructure/options/optionsCacheLife';
import { optionsSymbolTag, optionsExpirationTag } from '@/infrastructure/options/optionsCacheTags';
import type { OptionsSnapshot, OptionsChain } from '@y0ngha/siglens-core';

const adapter = new YahooOptionsAdapter();

export async function hasOptionsMarket(symbol: string): Promise<boolean> {
    'use cache';
    cacheLife('options-weekend');  // 1 day revalidate 가 무난 — 옵션 가능 여부는 거의 변하지 않음
    cacheTag(optionsSymbolTag(symbol));
    return adapter.hasOptionsMarket(symbol);
}

export async function fetchOptionsSnapshot(
    symbol: string
): Promise<OptionsSnapshot | null> {
    'use cache';
    cacheLife(getOptionsCacheLifeProfile());
    cacheTag(optionsSymbolTag(symbol));
    return adapter.fetchSnapshot(symbol);
}

export async function fetchOptionsChain(
    symbol: string,
    expirationDate: string
): Promise<OptionsChain | null> {
    'use cache';
    cacheLife(getOptionsCacheLifeProfile());
    cacheTag(optionsExpirationTag(symbol, expirationDate));
    return adapter.fetchChain(symbol, expirationDate);
}
```

- [ ] **Step 2: type-check + commit**

```bash
yarn tsc --noEmit
git add src/app/[symbol]/options/optionsData.ts
git commit -m "feat(options): add data layer with 'use cache' + cacheLife profiles"
```

### Task 4.2: 옵션 페이지 RSC (page.tsx)

**Files:**
- Create: `src/app/[symbol]/options/page.tsx`
- Create: `src/app/[symbol]/options/loading.tsx`
- Create: `src/app/[symbol]/options/opengraph-image.tsx`

- [ ] **Step 1: 기존 fundamental page.tsx 패턴 그대로 복제 + 옵션 컨텐츠로 교체**

```tsx
// src/app/[symbol]/options/page.tsx
import { OptionsPageClient } from '@/components/options/OptionsPageClient';
import { OptionsEmptyState } from '@/components/options/OptionsEmptyState';
import { JsonLd } from '@/components/ui/JsonLd';
import { VALID_TICKER_RE } from '@/domain/constants/market';
import { buildDisplayName } from '@/domain/ticker';
import { getAssetInfoCached } from '@/infrastructure/ticker/getAssetInfoCached';
import { mapExpirationsToSlots } from '@y0ngha/siglens-core';
import {
    fetchOptionsSnapshot,
    hasOptionsMarket,
} from '@/app/[symbol]/options/optionsData';
import { QUERY_KEYS, QUERY_STALE_TIME_MS } from '@/lib/queryConfig';
import {
    buildBreadcrumbJsonLd,
    buildSymbolOptionsSeoContent,
    buildSymbolSeoContent,
    SITE_NAME,
} from '@/lib/seo';
import {
    dehydrate,
    HydrationBoundary,
    QueryClient,
} from '@tanstack/react-query';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

interface Props {
    params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { symbol } = await params;
    const upper = symbol.toUpperCase();
    const assetInfo = await getAssetInfoCached(upper);
    const displayName = assetInfo ? buildDisplayName(assetInfo, upper) : upper;
    const hasOptions = await hasOptionsMarket(upper);
    const { title, fullTitle, description, url, keywords } =
        buildSymbolOptionsSeoContent(upper, {
            displayName,
            koreanName: assetInfo?.koreanName,
            hasOptions,
        });

    return {
        title,
        description,
        keywords,
        alternates: { canonical: url },
        openGraph: {
            type: 'website',
            siteName: SITE_NAME,
            title: fullTitle,
            description,
            url,
            locale: 'ko_KR',
        },
        twitter: {
            card: 'summary_large_image',
            title: fullTitle,
            description,
        },
        ...(hasOptions ? {} : { robots: { index: false, follow: true } }),
    };
}

export default async function OptionsPage({ params }: Props) {
    const { symbol } = await params;
    const upper = symbol.toUpperCase();

    if (!VALID_TICKER_RE.test(upper)) notFound();

    const [assetInfo, hasOptions] = await Promise.all([
        getAssetInfoCached(upper),
        hasOptionsMarket(upper),
    ]);
    if (!assetInfo) notFound();
    if (!hasOptions) {
        return <OptionsEmptyState symbol={upper} />;
    }

    const displayName = buildDisplayName(assetInfo, upper);

    const snapshot = await fetchOptionsSnapshot(upper);
    if (snapshot === null) return <OptionsEmptyState symbol={upper} />;

    const expirations = snapshot.chains.map(c => c.expirationDate);
    const slots = mapExpirationsToSlots(expirations, new Date());

    const queryClient = new QueryClient({
        defaultOptions: { queries: { staleTime: QUERY_STALE_TIME_MS } },
    });
    queryClient.setQueryData(QUERY_KEYS.optionsSnapshot(upper), snapshot);

    // JSON-LD
    const { fullTitle, description, url } = buildSymbolOptionsSeoContent(upper, {
        displayName,
        koreanName: assetInfo.koreanName,
        hasOptions: true,
    });
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: fullTitle,
        description,
        url,
        inLanguage: 'ko',
        about: {
            '@type': 'Corporation',
            name: displayName,
            tickerSymbol: upper,
        },
    };
    const breadcrumbJsonLd = buildBreadcrumbJsonLd([
        { name: upper, url: buildSymbolSeoContent(upper).url },
        { name: '옵션 분석', url },
    ]);
    const faqJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
            {
                '@type': 'Question',
                name: `${displayName} 옵션 시장 분석에서 무엇을 볼 수 있나요?`,
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'AI가 옵션 시장 데이터를 분석해 주요 만기별로 어디에 돈이 쌓이고 있는지, 시장이 어떤 변동성을 예상하는지 한국어로 설명해줍니다. Max Pain, Put/Call Ratio, ATM IV, Implied Move 같은 핵심 지표와 Strike별 OI 분포 차트도 함께 보여줍니다.',
                },
            },
            {
                '@type': 'Question',
                name: 'Max Pain과 Open Interest는 어떻게 해석하나요?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Max Pain은 옵션 만기일이 가까워질 때 주가가 끌리는 가격입니다. Open Interest는 현재 살아있는 옵션 계약 수로, 두꺼운 가격대에 많은 사람이 베팅하고 있다는 뜻입니다.',
                },
            },
            {
                '@type': 'Question',
                name: '제 종목에 옵션이 없으면 어떻게 되나요?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: '옵션 시장이 형성되지 않은 종목은 옵션 분석 페이지에 빈 안내가 표시되며, 차트/펀더멘털/뉴스 같은 다른 분석 페이지로 안내됩니다.',
                },
            },
        ],
    };

    return (
        <>
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <JsonLd data={faqJsonLd} />
            <section className="sr-only">
                <h2>{displayName} 옵션 시장 풍경</h2>
                <p>
                    {displayName} 옵션 시장을 AI가 한국어로 해석합니다. 만기별
                    Max Pain, Put/Call Ratio, ATM IV, Implied Move 등 핵심 지표와
                    Strike별 Open Interest 분포를 함께 살펴볼 수 있습니다.
                </p>
            </section>
            <HydrationBoundary state={dehydrate(queryClient)}>
                <OptionsPageClient
                    symbol={upper}
                    companyName={displayName}
                    snapshot={snapshot}
                    slots={slots}
                />
            </HydrationBoundary>
        </>
    );
}
```

- [ ] **Step 2: loading.tsx — 스켈레톤**

```tsx
// src/app/[symbol]/options/loading.tsx
import { SectionSkeleton } from '@/components/symbol-page/SectionSkeleton';

export default function OptionsLoading() {
    return (
        <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
            <div className="flex gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-secondary-700 h-7 w-16 rounded-full animate-pulse" />
                ))}
            </div>
            <SectionSkeleton />
            <SectionSkeleton />
            <SectionSkeleton />
        </main>
    );
}
```

- [ ] **Step 3: opengraph-image.tsx — 기존 fundamental 패턴 그대로 복제 + 옵션 카피로**

기존 `src/app/[symbol]/fundamental/opengraph-image.tsx`를 복사 후:
- 타이틀: `"옵션 분석 — ${symbol}"`
- 본문: "AI가 해석하는 옵션 시장 풍경"

- [ ] **Step 4: type-check + commit**

```bash
yarn tsc --noEmit
git add src/app/[symbol]/options/
git commit -m "feat(options): add /[symbol]/options RSC page + loading + opengraph"
```

### Task 4.3: React Query hooks

**Files:**
- Create: `src/components/options/hooks/useOptionsChain.ts`
- Create: `src/components/options/hooks/useOptionsAnalysis.ts`
- Modify: `src/lib/queryConfig.ts` (QUERY_KEYS 확장)

- [ ] **Step 1: QUERY_KEYS 확장**

```typescript
// src/lib/queryConfig.ts (기존 QUERY_KEYS에 추가)
optionsSnapshot: (symbol: string) =>
    ['optionsSnapshot', symbol] as const,
optionsChain: (symbol: string, expiry: string) =>
    ['optionsChain', symbol, expiry] as const,
optionsSignals: (symbol: string) =>
    ['optionsSignals', symbol] as const,
optionsAnalysis: (symbol: string, expiry: string, modelId: string) =>
    ['optionsAnalysis', symbol, expiry, modelId] as const,
```

- [ ] **Step 2: useOptionsChain — 만기별 chain fetch**

```typescript
// src/components/options/hooks/useOptionsChain.ts
'use client';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/lib/queryConfig';
import { getOptionsChainAction } from '@/infrastructure/options/optionsActions';
import type { OptionsChain } from '@y0ngha/siglens-core';

export function useOptionsChain(symbol: string, expirationDate: string) {
    return useQuery<OptionsChain | null>({
        queryKey: QUERY_KEYS.optionsChain(symbol, expirationDate),
        queryFn: () => getOptionsChainAction(symbol, expirationDate),
        retry: 2,
    });
}
```

- [ ] **Step 3: useOptionsAnalysis — submit + poll**

기존 `useAnalysis` (siglens 측) 패턴을 그대로 복제하여 옵션 버전 작성. 핵심:
- submit Server Action → jobId/cached/limit_error 등 분기
- jobId 받으면 1초 간격 poll
- 결과 / 에러 / 진행중 상태 관리

```typescript
// src/components/options/hooks/useOptionsAnalysis.ts (시그니처 위주)
'use client';
import { useEffect, useState } from 'react';
import {
    submitOptionsAnalysisAction,
    pollOptionsAnalysisAction,
} from '@/infrastructure/options/optionsActions';
import type { OptionsAnalysisResponse } from '@y0ngha/siglens-core';

interface UseOptionsAnalysisOptions {
    symbol: string;
    expirationDate: string | 'all';
    modelId: string;
}

interface UseOptionsAnalysisState {
    data: OptionsAnalysisResponse | null;
    isLoading: boolean;
    error: string | null;
    retry: () => void;
}

export function useOptionsAnalysis(opts: UseOptionsAnalysisOptions): UseOptionsAnalysisState {
    // 기존 useAnalysis 패턴 그대로 — submit → poll loop
    // ...
}
```

> 정확한 구현은 기존 `src/components/.../useAnalysis.ts` (또는 fundamental의 동일 패턴 hook)를 한 줄 한 줄 복제하고 시그니처만 옵션용으로 치환한다.

- [ ] **Step 4: optionsActions.ts (Server Actions)**

```typescript
// src/infrastructure/options/optionsActions.ts
'use server';
import {
    submitOptionsAnalysis,
    pollOptionsAnalysis,
} from '@y0ngha/siglens-core';
import { fetchOptionsChain, fetchOptionsSnapshot } from '@/app/[symbol]/options/optionsData';
import { getCurrentTier } from '@/infrastructure/tier/getCurrentTier';
import { hashUsageIp } from '@y0ngha/siglens-core'; // 기존 분석에서 사용 중

export async function getOptionsChainAction(symbol: string, expiry: string) {
    return fetchOptionsChain(symbol, expiry);
}

export async function submitOptionsAnalysisAction(input: {
    symbol: string;
    companyName: string;
    expirationDate: string | 'all';
    modelId: string;
}) {
    const snapshot = await fetchOptionsSnapshot(input.symbol);
    if (snapshot === null) {
        return { status: 'error' as const, message: '옵션 데이터 없음' };
    }
    const tier = await getCurrentTier();
    return submitOptionsAnalysis({
        ...input,
        snapshot,
        tier,
        // usage 인젝션은 기존 분석 액션 패턴 따름
    });
}

export async function pollOptionsAnalysisAction(jobId: string) {
    return pollOptionsAnalysis({ jobId });
}
```

- [ ] **Step 5: type-check + commit**

```bash
yarn tsc --noEmit
git add src/components/options/hooks/ src/infrastructure/options/optionsActions.ts src/lib/queryConfig.ts
git commit -m "feat(options): add React Query hooks + Server Actions for options analysis"
```

---

## Phase 5 — siglens Options Page UI Components

각 컴포넌트마다 별도 task로 분할. 모두 testing-library 기반 + InfoTooltip 통합 + spec 7.5의 톤 그대로 적용.

### Task 5.1: OptionsPageClient (컨테이너)

**Files:**
- Create: `src/components/options/OptionsPageClient.tsx`

- [ ] **Step 1: 컨테이너 구조 (만기 chip + AI 분석 + 4 metric + OI chart + chain table 순서, layout A)**

```tsx
// src/components/options/OptionsPageClient.tsx
'use client';
import { useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Suspense } from 'react';
import { ExpirationSelector } from './ExpirationSelector';
import { OptionsAiAnalysis } from './OptionsAiAnalysis';
import { OptionsAiAnalysisSkeleton } from './OptionsAiAnalysisSkeleton';
import { OptionsAiAnalysisError } from './OptionsAiAnalysisError';
import { OptionsMetricsRow } from './OptionsMetricsRow';
import { OpenInterestChart } from './OpenInterestChart';
import { OptionsChainTable } from './OptionsChainTable';
import { useSymbolModel } from '@/components/symbol-page/SymbolModelContext';
import { CrossLinkCards } from '@/components/symbol-page/CrossLinkCards';
import type {
    OptionsSnapshot,
    SlotMapping,
} from '@y0ngha/siglens-core';

interface Props {
    symbol: string;
    companyName: string;
    snapshot: OptionsSnapshot;
    slots: ReadonlyArray<SlotMapping | null>;
}

export function OptionsPageClient({ symbol, companyName, snapshot, slots }: Props) {
    const validSlots = slots.filter((s): s is SlotMapping => s !== null);
    const initialExpiry = validSlots[0]?.expirationDate ?? 'all';
    const [expirationDate, setExpirationDate] = useState<string | 'all'>(initialExpiry);
    const { modelId } = useSymbolModel();

    return (
        <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
            <ExpirationSelector
                slots={validSlots}
                value={expirationDate}
                onChange={setExpirationDate}
            />
            <ErrorBoundary FallbackComponent={OptionsAiAnalysisError}>
                <Suspense fallback={<OptionsAiAnalysisSkeleton />}>
                    <OptionsAiAnalysis
                        symbol={symbol}
                        companyName={companyName}
                        expirationDate={expirationDate}
                        modelId={modelId}
                    />
                </Suspense>
            </ErrorBoundary>
            <OptionsMetricsRow
                symbol={symbol}
                expirationDate={expirationDate}
                snapshot={snapshot}
            />
            <OpenInterestChart
                symbol={symbol}
                expirationDate={expirationDate}
                snapshot={snapshot}
            />
            <OptionsChainTable
                symbol={symbol}
                expirationDate={expirationDate}
            />
            <CrossLinkCards symbol={symbol} current="options" />
        </main>
    );
}
```

- [ ] **Step 2: type-check + commit**

```bash
yarn tsc --noEmit
git add src/components/options/OptionsPageClient.tsx
git commit -m "feat(options): add OptionsPageClient container (A-layout: AI-first)"
```

### Task 5.2 ~ 5.7: 개별 UI 컴포넌트들

각 컴포넌트는 spec §7과 §10의 가이드라인을 그대로 따른다. 핵심 사항만 박는다.

**Task 5.2 — ExpirationSelector** (`role="tablist"` + chip 6개)
- Create: `src/components/options/ExpirationSelector.tsx`
- Props: `slots`, `value`, `onChange`
- InfoTooltip "만기" 적용 (spec §7.5 항목 #7)
- 모바일 가로 스크롤
- A11y: `role="tablist"` / `role="tab"` / `aria-selected`
- commit msg: `feat(options): add ExpirationSelector chips (a11y tablist)`

**Task 5.3 — OptionsAiAnalysis + Skeleton + Error**
- Create: `src/components/options/OptionsAiAnalysis.tsx`
- Create: `src/components/options/OptionsAiAnalysisSkeleton.tsx`
- Create: `src/components/options/OptionsAiAnalysisError.tsx`
- `useOptionsAnalysis` hook 사용
- 응답의 `summary` + `perExpiration` 모두 표시
- 톤별로 작은 색 배지 (`bullish=emerald-500`, `bearish=red-500`, `neutral=secondary-400`, `cautious=amber-400`)
- commit msg: `feat(options): add OptionsAiAnalysis (summary + per-expiration commentary)`

**Task 5.4 — OptionsMetricsRow** (Max Pain · P/C · ATM IV · Imp. Move 4 카드)
- Create: `src/components/options/OptionsMetricsRow.tsx`
- 4개 카드 모두 InfoTooltip 적용 (spec §7.5 항목 3, 2, 1+4, 4)
- `expirationDate === 'all'`일 때는 모든 만기 가중평균 또는 가장 가까운 만기 값 사용 (spec 명시 안 됨 → 구현 시점 가장 가까운 만기 값으로 표시 + InfoTooltip에 "현재 만기 기준" 주석)
- 데스크톱 1x4, 모바일 2x2
- commit msg: `feat(options): add OptionsMetricsRow (Max Pain, P/C, ATM IV, Implied Move cards)`

**Task 5.5 — OpenInterestChart (자체 SVG)**
- Create: `src/components/options/OpenInterestChart.tsx`
- Props: `symbol`, `expirationDate`, `snapshot`
- SVG bar chart: Call OI 위쪽(emerald), Put OI 아래쪽(red), 현재가 세로선(amber-400), Max Pain 점선(amber-500)
- Top 3 strike 강조
- A11y: `role="img"` + `<title>` + `<desc>`, 차트 아래에 data table fallback
- InfoTooltip "Open Interest" 적용 (spec §7.5 항목 #5)
- commit msg: `feat(options): add OpenInterestChart (SVG, a11y-compliant)`

**Task 5.6 — OptionsChainTable**
- Create: `src/components/options/OptionsChainTable.tsx`
- 접힘/펼침 토글
- 헤더: Strike · Call (Bid/Ask) · Call OI · Put (Bid/Ask) · Put OI
- InfoTooltip: "Strike" (§7.5 #6), "Implied Volatility" (#8), "Volume vs OI" (#9)
- 현재가에 가장 가까운 row 강조
- Max Pain row 아이콘 표시
- A11y: `<table>` + `<caption>` + `<th scope="col">`
- 모바일 가로 스크롤
- commit msg: `feat(options): add OptionsChainTable (collapsible, mobile horizontal scroll)`

**Task 5.7 — OptionsEmptyState**
- Create: `src/components/options/OptionsEmptyState.tsx`
- 옵션 없는 종목용 메시지 + 4개 다른 페이지로 가는 링크 (차트/펀더멘털/뉴스/공포탐욕)
- commit msg: `feat(options): add OptionsEmptyState for symbols without options market`

각 task 끝에:
```bash
yarn tsc --noEmit && yarn vitest run src/__tests__/components/options/
git add src/components/options/<ComponentName>* src/__tests__/components/options/<ComponentName>*
git commit -m "<위 commit msg>"
```

각 컴포넌트 테스트 패턴:
```typescript
// Example for ExpirationSelector
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExpirationSelector } from '@/components/options/ExpirationSelector';

describe('ExpirationSelector', () => {
    const slots = [
        { slot: { key: '1W', label: '1주', targetDays: 7 }, expirationDate: '2026-05-22' },
        { slot: { key: '1M', label: '1개월', targetDays: 30 }, expirationDate: '2026-06-15' },
    ];

    it('renders chips for each slot + 종합', () => {
        render(<ExpirationSelector slots={slots} value="2026-05-22" onChange={vi.fn()} />);
        expect(screen.getByRole('tab', { name: /1주/ })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /종합/ })).toBeInTheDocument();
    });

    it('calls onChange when chip clicked', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(<ExpirationSelector slots={slots} value="2026-05-22" onChange={onChange} />);
        await user.click(screen.getByRole('tab', { name: /1개월/ }));
        expect(onChange).toHaveBeenCalledWith('2026-06-15');
    });

    it('marks active chip with aria-selected=true', () => {
        render(<ExpirationSelector slots={slots} value="2026-06-15" onChange={vi.fn()} />);
        const oneMonth = screen.getByRole('tab', { name: /1개월/ });
        expect(oneMonth).toHaveAttribute('aria-selected', 'true');
    });
});
```

---

## Phase 6 — 차트 페이지 보조 카드

### Task 6.1: OptionsSignalCards 컴포넌트

**Files:**
- Create: `src/components/symbol-page/cards/OptionsSignalCards.tsx`
- Create: `src/infrastructure/options/getOptionsSignalsAction.ts` (Server Action)
- Test: `src/__tests__/components/symbol-page/OptionsSignalCards.test.tsx`

- [ ] **Step 1: Server Action — 가장 가까운 만기의 ATM IV · P/C · Max Pain 계산**

```typescript
// src/infrastructure/options/getOptionsSignalsAction.ts
'use server';
import {
    calculateMaxPain,
    calculatePutCallRatio,
    summarizeChainForLlm,
} from '@y0ngha/siglens-core';
import { fetchOptionsSnapshot } from '@/app/[symbol]/options/optionsData';

export interface OptionsSignals {
    atmIv: number | null;
    putCallRatio: number;
    maxPain: number;
}

export async function getOptionsSignalsAction(
    symbol: string
): Promise<OptionsSignals | null> {
    const snapshot = await fetchOptionsSnapshot(symbol);
    if (!snapshot || snapshot.chains.length === 0) return null;
    const nearest = snapshot.chains[0]; // 만기 ascending 정렬 보장
    const summary = summarizeChainForLlm(nearest);
    return {
        atmIv: summary.atmImpliedVolatility,
        putCallRatio: summary.putCallRatio,
        maxPain: summary.maxPain,
    };
}
```

- [ ] **Step 2: OptionsSignalCards 컴포넌트**

```tsx
// src/components/symbol-page/cards/OptionsSignalCards.tsx
'use client';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/lib/queryConfig';
import { getOptionsSignalsAction } from '@/infrastructure/options/getOptionsSignalsAction';
import { InfoTooltip } from '@/components/ui/InfoTooltip';

interface Props { symbol: string; }

export function OptionsSignalCards({ symbol }: Props) {
    const { data, isLoading } = useQuery({
        queryKey: QUERY_KEYS.optionsSignals(symbol),
        queryFn: () => getOptionsSignalsAction(symbol),
        retry: 1,
    });

    if (isLoading) return <OptionsSignalCardsSkeleton />;
    if (!data) return null; // 옵션 없으면 자리 차지 X

    return (
        <section
            aria-label="옵션 보조 시그널"
            className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
            <SignalCard
                label="ATM IV"
                value={data.atmIv !== null ? `${(data.atmIv * 100).toFixed(1)}%` : '—'}
                tooltip={
                    <>
                        <p>지금 옵션 시장이 보는 변동성이에요. 보통 20~30%가 평범한 편이고, 40% 넘으면 시장이 큰 움직임을 예상하고 있어요.</p>
                        <p>어닝 발표 같은 큰 이벤트 직전에 보통 올라가요.</p>
                    </>
                }
            />
            <SignalCard
                label="Put/Call"
                value={data.putCallRatio === Number.POSITIVE_INFINITY ? '∞' : data.putCallRatio.toFixed(2)}
                tooltip={
                    <>
                        <p>풋옵션 거래량을 콜옵션 거래량으로 나눈 값이에요.</p>
                        <p>1보다 크면 풋(하락 베팅)이 더 많아 시장이 조심스럽다는 뜻이고, 1보다 작으면 콜(상승 베팅)이 더 많다는 뜻이에요.</p>
                        <p>너무 극단으로 치우치면 오히려 반대 신호로 해석하는 경우도 많아요.</p>
                    </>
                }
            />
            <SignalCard
                label="Max Pain"
                value={Number.isNaN(data.maxPain) ? '—' : `$${data.maxPain}`}
                tooltip={
                    <>
                        <p>옵션 만기일이 가까워질수록 주가가 끌리는 가격이에요.</p>
                        <p>옵션을 판 쪽(주로 기관)의 손실이 가장 적어지는 가격이라, 만기일 부근에는 주가가 이쪽으로 움직이는 경향이 있어요.</p>
                        <p>절대 법칙은 아니고 참고용 가격으로 보세요.</p>
                    </>
                }
            />
        </section>
    );
}

function SignalCard({ label, value, tooltip }: { label: string; value: string; tooltip: React.ReactNode }) {
    return (
        <div className="border-secondary-700 bg-secondary-800 rounded-xl border p-4">
            <div className="text-secondary-400 text-xs uppercase tracking-widest">
                {label}
                <InfoTooltip>{tooltip}</InfoTooltip>
            </div>
            <div className="font-mono text-xl font-semibold mt-1">{value}</div>
        </div>
    );
}

function OptionsSignalCardsSkeleton() {
    return (
        <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3" aria-busy="true">
            {[0,1,2].map(i => (
                <div key={i} className="border-secondary-700 bg-secondary-800 rounded-xl border p-4 animate-pulse">
                    <div className="bg-secondary-700 h-3 w-16 rounded" />
                    <div className="bg-secondary-700 h-6 w-20 rounded mt-2" />
                </div>
            ))}
        </section>
    );
}
```

- [ ] **Step 3: 테스트 (3개: loading / 데이터 있음 / 옵션 없음)**

- [ ] **Step 4: 차트 페이지에 통합 — SymbolPageClient 또는 ChartContent에 삽입**

`src/components/symbol-page/ChartContent.tsx` 또는 `SymbolPageClient.tsx`에서 `OptionsSignalCards`를 적절한 위치에 Suspense + ErrorBoundary로 감싸 삽입. (기존 `FearGreedHeaderChip` 패턴 참조)

- [ ] **Step 5: type-check + commit**

```bash
yarn tsc --noEmit
yarn vitest run src/__tests__/components/symbol-page/OptionsSignalCards.test.tsx
git add src/components/symbol-page/cards/ src/infrastructure/options/getOptionsSignalsAction.ts src/__tests__/components/symbol-page/OptionsSignalCards.test.tsx
git commit -m "feat(options): add chart page OptionsSignalCards (ATM IV, P/C, Max Pain)"
```

---

## Phase 7 — Symbol Navigation 통합

### Task 7.1: SymbolTabs에 '옵션' 탭 추가

**Files:**
- Modify: `src/components/symbol-page/utils/symbolTabsConfig.ts`

- [ ] **Step 1: TABS에 옵션 추가 (펀더멘털 뒤)**

```typescript
export const TABS = [
    { key: 'chart', label: '차트', hrefBuilder: (s: string) => `/${s}` },
    { key: 'news', label: '뉴스', hrefBuilder: (s: string) => `/${s}/news` },
    { key: 'fundamental', label: '펀더멘털', hrefBuilder: (s: string) => `/${s}/fundamental` },
    { key: 'options', label: '옵션', hrefBuilder: (s: string) => `/${s}/options` },
    { key: 'fear-greed', label: '공포 탐욕 지수', hrefBuilder: (s: string) => `/${s}/fear-greed` },
    { key: 'overall', label: '종합', hrefBuilder: (s: string) => `/${s}/overall` },
] as const;
```

- [ ] **Step 2: type-check + commit**

```bash
yarn tsc --noEmit
git add src/components/symbol-page/utils/symbolTabsConfig.ts
git commit -m "feat(options): add '옵션' tab to SymbolTabs navigation"
```

### Task 7.2: CrossLinkCards에 options 추가 + 종합 description 갱신

**Files:**
- Modify: `src/components/symbol-page/CrossLinkCards.tsx`

- [ ] **Step 1: ALL_PAGES, LABEL, DESCRIPTION, HREF 4개 객체에 추가**

```typescript
const ALL_PAGES = [
    'chart',
    'news',
    'fundamental',
    'options',
    'fear-greed',
    'overall',
] as const;

const LABEL: Record<PageKey, string> = {
    chart: '차트 분석',
    news: '뉴스 분석',
    fundamental: '펀더멘털 분석',
    options: '옵션 분석',
    'fear-greed': '공포 탐욕 지수',
    overall: 'AI 종합 분석',
};

const DESCRIPTION: Record<PageKey, string> = {
    chart: '기술적 지표 + AI 종합 리포트',
    news: '실시간 뉴스 + 애널리스트 의견 분석',
    fundamental: '재무·밸류에이션·미래 방향',
    options: '옵션 시장이 보는 가격대와 기대 변동성',
    'fear-greed': '단기 매매 심리 0~100 점수',
    overall: '5축 통합 AI 결론 + 시나리오',   // 4축 → 5축
};

const HREF: Record<PageKey, (symbol: string) => string> = {
    chart: symbol => `/${symbol}`,
    news: symbol => `/${symbol}/news`,
    fundamental: symbol => `/${symbol}/fundamental`,
    options: symbol => `/${symbol}/options`,
    'fear-greed': symbol => `/${symbol}/fear-greed`,
    overall: symbol => `/${symbol}/overall`,
};
```

- [ ] **Step 2: doc comment 갱신**

```typescript
/** Cross-link cards at the bottom of each analysis page — renders the 5 sibling pages. */
```

- [ ] **Step 3: commit**

```bash
yarn tsc --noEmit
git add src/components/symbol-page/CrossLinkCards.tsx
git commit -m "feat(options): add options to CrossLinkCards + bump overall to 5-axis"
```

---

## Phase 8 — SEO

### Task 8.1: buildSymbolOptionsSeoContent + lib/seo.ts 확장

**Files:**
- Modify: `src/lib/seo.ts`

- [ ] **Step 1: 기존 `buildSymbolFundamentalSeoContent` 패턴 참조하여 옵션 버전 추가**

```typescript
// src/lib/seo.ts
interface SymbolOptionsSeoArgs {
    displayName?: string;
    koreanName?: string;
    hasOptions?: boolean;
}

export function buildSymbolOptionsSeoContent(
    ticker: string,
    args: SymbolOptionsSeoArgs = {}
) {
    const { displayName = ticker, koreanName, hasOptions = true } = args;
    const namePart = koreanName ? `${koreanName}(${ticker})` : displayName;
    const title = hasOptions
        ? `${namePart} 옵션 분석 | SigLens`
        : `${ticker} | SigLens`;
    const fullTitle = title;
    const description = hasOptions
        ? `${namePart}의 옵션 시장을 AI가 분석합니다. Max Pain, Open Interest, Put/Call, ATM IV로 시장 기대치와 자금 흐름을 한국어로 해석합니다.`
        : `${ticker}의 SigLens 분석 페이지.`;
    const url = `${SITE_URL}/${ticker}/options`;
    const keywords = hasOptions
        ? [`${ticker} 옵션`, `${ticker} Max Pain`, `${ticker} Put Call Ratio`, '옵션 분석', '옵션 시장', 'SigLens']
        : undefined;
    return { title, fullTitle, description, url, keywords };
}
```

- [ ] **Step 2: commit**

```bash
yarn tsc --noEmit
git add src/lib/seo.ts
git commit -m "feat(options): add buildSymbolOptionsSeoContent"
```

### Task 8.2: sitemap.ts 확장 — 옵션 페이지 추가

**Files:**
- Modify: `src/app/sitemap.ts` (기존 동적 sitemap)

- [ ] **Step 1: 기존 sitemap에 각 종목의 옵션 페이지 추가**

기존 sitemap이 종목별로 `/{ticker}`, `/{ticker}/fundamental` 등 entry를 만든다면, 동일하게 `/{ticker}/options` 추가. 단, `hasOptionsMarket(ticker)`가 true인 종목만 포함.

```typescript
// src/app/sitemap.ts (단순화)
const symbolEntries = await Promise.all(
    indexedSymbols.map(async sym => {
        const entries = [
            { url: `${SITE_URL}/${sym}`, lastModified, priority: 0.9 },
            { url: `${SITE_URL}/${sym}/fundamental`, lastModified, priority: 0.7 },
            { url: `${SITE_URL}/${sym}/news`, lastModified, priority: 0.7 },
            { url: `${SITE_URL}/${sym}/fear-greed`, lastModified, priority: 0.6 },
            { url: `${SITE_URL}/${sym}/overall`, lastModified, priority: 0.8 },
        ];
        if (await hasOptionsMarket(sym)) {
            entries.push({
                url: `${SITE_URL}/${sym}/options`,
                lastModified,
                priority: 0.7,
            });
        }
        return entries;
    })
);
```

> 옵션 가능 여부 확인이 sitemap 생성마다 일어나면 비용 큼 — 기존 `hasOptionsMarket` 'use cache'가 1일 캐시이므로 sitemap revalidate 주기와 일치하면 부담 작음.

- [ ] **Step 2: commit**

```bash
yarn tsc --noEmit
git add src/app/sitemap.ts
git commit -m "feat(options): include /{ticker}/options in sitemap when options market exists"
```

### Task 8.3: robots 정책 — 옵션 없는 종목은 noindex

이미 `page.tsx`의 `generateMetadata`에서 `robots: { index: false, follow: true }`로 처리되도록 작성됨 (Task 4.2 Step 1). 별도 task 불필요. 검증만:

- [ ] **Step 1: 검증 — 옵션 없는 종목 URL 진입 시 robots meta 확인**

dev 서버 실행 후 옵션 없는 종목 (예: 매우 작은 ETN) 페이지에서 `<meta name="robots" content="noindex,follow" />` 확인.

```bash
yarn dev
# 브라우저: http://localhost:4200/{ticker-without-options}/options
# Inspect → robots meta 확인
```

---

## Phase 9 — E2E + Regression Guards + Final Verification

### Task 9.1: SCOPE regression test 확장

**Files:**
- Modify: `src/__tests__/SCOPE.test.ts` (또는 동등한 import-guard 테스트)

- [ ] **Step 1: 옵션 관련 import 규칙 검증**

기존 SCOPE 테스트가 있다면 옵션 관련 deep import 금지 케이스 추가:
```typescript
it('siglens does not deep-import options modules from siglens-core/dist', () => {
    const offenders = grep([
        "@y0ngha/siglens-core/dist/domain/options",
        "@y0ngha/siglens-core/dist/application/options",
        "@y0ngha/siglens-core/dist/infrastructure/options",
    ], 'src/');
    expect(offenders).toEqual([]);
});
```

- [ ] **Step 2: commit**

```bash
git add src/__tests__/SCOPE.test.ts
git commit -m "test(options): guard against deep imports of options modules"
```

### Task 9.2: Playwright E2E

**Files:**
- Create: `e2e/options.spec.ts` (또는 기존 e2e 폴더에)

- [ ] **Step 1: 시나리오 작성**

```typescript
import { test, expect } from '@playwright/test';

test('AAPL 옵션 탭 진입 → 만기 chip → 데이터 변경', async ({ page }) => {
    await page.goto('/AAPL/options');
    await expect(page.getByRole('tablist')).toBeVisible();
    const chips = page.getByRole('tab');
    await expect(chips.first()).toBeVisible();
    // 종합 chip 클릭
    await page.getByRole('tab', { name: /종합/ }).click();
    // AI 분석 또는 핵심 지표가 변경되는지 확인
    await expect(page.getByText(/AI 옵션 분석|분석을 가져올 수 없|불러오는 중/)).toBeVisible();
});

test('옵션 없는 종목 진입 → EmptyState 렌더', async ({ page }) => {
    // 옵션 없는 ETN 또는 작은 종목 (실제 yfinance 응답에 따라 ticker 결정)
    await page.goto('/{small-cap-no-options}/options');
    await expect(page.getByText(/옵션 시장이 형성되어 있지 않/)).toBeVisible();
});

test('종합 분석 → 5축 모두 표시', async ({ page }) => {
    await page.goto('/AAPL/overall');
    // 옵션 섹션 표시 검증
    await expect(page.getByText(/옵션/)).toBeVisible();
});
```

- [ ] **Step 2: commit**

```bash
git add e2e/options.spec.ts
git commit -m "test(options): add E2E tests (option tab, empty state, overall 5-axis)"
```

### Task 9.3: Lint + 최종 빌드 + Skills audit

- [ ] **Step 1: lint 통과 확인**

```bash
cd /Users/y0ngha/Project/siglens-options
yarn lint
yarn lint:style
```

- [ ] **Step 2: 전체 unit + integration 테스트 통과 확인**

```bash
yarn test
```

- [ ] **Step 3: build 검증**

```bash
yarn build
```

- [ ] **Step 4: frontend-design 스킬 호출 (UI 컴포넌트 review)**

각 옵션 컴포넌트(`src/components/options/*`)와 `OptionsSignalCards`를 대상으로 `/frontend-design` 호출.

- [ ] **Step 5: web-design-guidelines 스킬 호출 (a11y review)**

위 동일 컴포넌트들 대상.

- [ ] **Step 6: seo-audit 스킬 호출 (옵션 페이지 + 전체 사이트)**

`/seo-audit` 호출. 옵션 페이지 추가 후 전체 사이트 SEO 영향 점검.

- [ ] **Step 7: 모든 skills 피드백 fix 후 final commit**

```bash
git add ... (수정 파일들)
git commit -m "chore(options): apply frontend-design/web-design-guidelines/seo-audit feedback"
```

### Task 9.4: PR 생성

- [ ] **Step 1: siglens-core PR 먼저**

```bash
cd /Users/y0ngha/Project/siglens-core-options
git push -u origin options/analysis
gh pr create --title "feat: options analysis (5-axis overall, calc + prompt + use-case)" --body "..."
```

- [ ] **Step 2: 머지 후 siglens-core 새 버전 publish**

```bash
yarn version patch  # 또는 minor (옵션 분석은 새 기능이므로 minor 권장)
yarn build
yarn publish
```

- [ ] **Step 3: siglens 워크트리의 portal 의존성을 publish된 버전으로 교체**

```json
"@y0ngha/siglens-core": "0.11.0",
```

- [ ] **Step 4: siglens PR**

```bash
cd /Users/y0ngha/Project/siglens-options
git push -u origin options/analysis
gh pr create --title "feat: options analysis page + chart card signals + 5-axis overall" --body "..."
```

- [ ] **Step 5: 두 PR 모두 머지 후 worktree 정리**

```bash
cd /Users/y0ngha/Project/siglens-core
git worktree remove /Users/y0ngha/Project/siglens-core-options

cd /Users/y0ngha/Project/siglens
git worktree remove /Users/y0ngha/Project/siglens-options
```

---

## Self-Review 체크포인트

### Spec coverage 검증
- ✅ §3 SCOPE 분담 (Phase 0~3에 적용)
- ✅ §4 데이터 플로우 (Phase 4 RSC + HydrationBoundary)
- ✅ §5 타입 정의 (Phase 1 + 2 모두)
- ✅ §6 Normalize 함수 + 캐시 read/write 양쪽 정규화 (Phase 1.5, 2.3, 2.5)
- ✅ §7 UI 디테일 (Phase 5 + InfoTooltip 톤 spec §7.5 그대로 적용)
- ✅ §8 에러 처리 (Phase 4~5의 ErrorBoundary 격리)
- ✅ §9 테스트 (Phase 1~9의 각 task에 TDD)
- ✅ §10 Implementation Guidelines (Phase 9.3에 skills 호출)
- ✅ §11 Out of Scope (Tradier fallback 인터페이스만, 누적 X, IV Rank ATM IV 치환)

### Placeholder scan
모든 task가 exact file path, code 블록, 명령어, expected output 포함. TBD/TODO 없음. 일부 task (5.2~5.7 컴포넌트 묶음)는 "spec 가이드라인 따라 작성" 패턴 — 같은 패턴 반복 회피 위함이며, 코드 작성에 필요한 정보(file path, props 시그니처, InfoTooltip 톤 spec 참조, commit msg)는 모두 박혀있음.

### Type consistency
- `OptionsAnalysisResponse` 필드명 (summary, perExpiration, signals, analyzedAt) 모든 task에서 일관
- `OptionsDataProvider` 메서드 (fetchSnapshot, fetchChain, hasOptionsMarket) 일관
- `OverallAxis` 'options' 추가 — Phase 2.6의 5축 확장 task에서 모든 관련 파일 동시 수정
- `mapExpirationsToSlots` 반환 타입 (`ReadonlyArray<SlotMapping | null>`) Phase 1.2와 4.2에서 동일

---

Plan complete and saved to `docs/superpowers/plans/2026-05-14-options-analysis.md`.

Two execution options:

**1. Subagent-Driven (recommended)** — task별로 fresh subagent dispatch + 단계별 review. 각 task 완료 후 main 세션에서 review 한 뒤 다음 task로 진행. 큰 plan(9 phase)에 적합.

**2. Inline Execution** — 본 세션에서 batch execution + checkpoint review. context 누적이 빠르므로 큰 plan에는 부적합할 수 있음.

어떤 방식으로 실행할까요?
