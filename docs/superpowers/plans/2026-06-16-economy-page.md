# `/economy` 미국 거시 흐름 페이지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 신규 정적 라우트 `/economy`에서 미국 거시 국면을 거시 AI 브리핑 + 카테고리별 경제지표(검증 11종) + 경제 캘린더 3축으로 제공한다.

**Architecture:** 도메인 로직(정규화·필터·2s10s 파생·브리핑 프롬프트/정규화)은 `@y0ngha/siglens-core`에, 외부 I/O(FMP fetch)·캐시·ISR·봇·UI는 siglens 앱에 둔다(`docs/architecture/SCOPE.md`). 브리핑·캐시·ISR은 `/market`(per-market) 레시피를 평행 적용한다. core를 먼저 구현·빌드해 siglens `node_modules/@y0ngha/siglens-core/`에 overlay한 뒤 siglens 작업을 진행한다.

**Tech Stack:** TypeScript · Next.js 16 App Router(ISR) · React 19 · @tanstack/react-query · Upstash Redis(`getOrSetCache`) · `unstable_cache` · FMP `/stable/*` · Vitest · Playwright.

**확정 스펙:** `docs/superpowers/specs/2026-06-16-us-economy-market-flow-design.md`(커밋 `60422bd`). 부록 A=FMP 실측, 부록 B=코드베이스 패턴 핀.

---

## 작업 환경 / 전제

- 워크트리: `/Users/y0ngha/Project/siglens/.claude/worktrees/feat+economy-page`(브랜치 `feat/economy-page`).
- core 워크트리/소스: `/Users/y0ngha/Project/siglens-core`(현 버전 `0.23.0`, barrel-only import). 별도 feature 브랜치 권장.
- **Phase 0(FMP 검증)은 완료됨** — 스펙 부록 A에 결과 기록(가용 11종, PCE/PPI/ISM PMI `Invalid name`, treasury·calendar 필드 확정). 이 플랜은 그 결과를 전제로 한다.
- **Cross-repo 작업 프로토콜(사용자 확정):** core 먼저 구현+단위테스트+`yarn build` → `dist/`를 siglens `node_modules/@y0ngha/siglens-core/`에 overlay 덮어쓰기 → siglens 작업. **core 정식 배포(GitHub Packages + `v*` tag)는 사용자가 직접** 수행하며 Claude는 publish 명령을 실행하지 않는다. 배포 후 siglens `package.json` 버전 핀 갱신 + clean install로 CI 정합.

---

## 검증된 데이터 형태 (FMP 실측 — 부록 A)

```jsonc
// GET /stable/economic-indicators?name=federalFunds
[ { "name": "federalFunds", "date": "2026-05-01", "value": 3.63 }, ... ]  // 최신→과거

// GET /stable/treasury-rates  (latest 다건, 최신 먼저)
[ { "date": "2026-06-15", "month1": 3.69, ..., "year2": 4.07, "year10": 4.47, "year30": 4.97 }, ... ]

// GET /stable/economic-calendar?from=YYYY-MM-DD&to=YYYY-MM-DD  (전 국가 — US 필터 필수)
[ { "date": "2026-06-16 23:50:00", "country": "JP"|"US", "event": "...", "currency": "USD",
    "previous": -9.4, "estimate": 0.9, "actual": null, "change": null,
    "impact": "Low"|"Medium"|"High", "changePercentage": 0, "unit": "%" }, ... ]
```

**채택 지표 11종(카테고리):**
- 금리: `federalFunds`(economic-indicators) · `year2`·`year10`(treasury-rates) → 2s10s 파생
- 물가: `inflationRate` · `CPI`
- 성장·경기: `GDP` · `industrialProductionTotalIndex` · `smoothedUSRecessionProbabilities`
- 고용: `unemploymentRate` · `totalNonfarmPayroll` · `initialClaims`

---

## File Structure

### Part A — `@y0ngha/siglens-core` (도메인)

| 파일 | 책임 |
|---|---|
| Create `src/domain/economy/types.ts` | `EconomicIndicatorSeries`, `TreasuryRateSnapshot`, `EconomicCalendarEvent`, `CalendarImpact`, `EconomySnapshot`, `MacroBriefingResponse` 등 도메인 타입 |
| Create `src/domain/economy/normalizeEconomicIndicators.ts` | FMP indicator wire→`EconomicIndicatorSeries` |
| Create `src/domain/economy/normalizeTreasuryRates.ts` | treasury wire→`TreasuryRateSnapshot` + `computeYieldSpread` |
| Create `src/domain/economy/normalizeEconomicCalendar.ts` | calendar wire→`EconomicCalendarEvent[]` + `filterUsCalendar` |
| Create `src/domain/economy/normalizeMacroBriefing.ts` | LLM raw→`MacroBriefingResponse`(방어적) |
| Create `src/domain/economy/macroBriefingPrompt.ts` | `buildMacroBriefingPrompt(snapshot)` |
| Create `src/application/economy/submitMacroBriefing.ts` | 워커 `/briefing` 잡 제출(`submitBriefing` 미러) |
| Create `src/application/economy/pollMacroBriefing.ts` | 잡 폴링(`pollBriefing` 미러) |
| Create `src/application/economy/peekMacroBriefingCache.ts` | read-only peek(`peekBriefingCache` 미러) |
| Modify `src/infrastructure/cache/config.ts` | `buildMacroBriefingCacheKey` 추가 |
| Modify `src/index.ts` | 위 public API + 타입 barrel export |
| Create `src/__tests__/domain/economy/*.test.ts` | normalize/compute/prompt 단위 테스트 |
| Create `src/__tests__/application/economy/*.test.ts` | submit/poll 단위 테스트 |

### Part B — siglens 앱

| 파일 | 책임 |
|---|---|
| Create `src/shared/config/economyIndicators.ts` | 지표 레지스트리(name·카테고리·라벨·단위·정밀도) |
| Create `src/shared/api/fmp/FmpEconomyProvider.ts` | FMP fetch + core normalize 위임 |
| Create `src/shared/api/fmp/FakeEconomyProvider.ts` | E2E 결정적 fixture |
| Create `src/shared/api/economy/getEconomyProvider.ts` | factory(E2E 분기) + `EconomyProvider` 포트 |
| Create `src/entities/economy/api/economySnapshotCache.ts` | React.cache + `getOrSetCache`(Redis) |
| Create `src/entities/economy/api/economySnapshotStaticCache.ts` | `unstable_cache`(ISR) |
| Create `src/entities/economy/api/macroBriefingStaticCache.ts` | `peekMacroBriefingStatic`(SSR seed) |
| Create `src/entities/economy/lib/EmptyResultError.ts` | sentinel(빈결과 캐시 오염 방지) |
| Create `src/entities/economy/lib/economyCompleteness.ts` | `isEmptyEconomySnapshot` |
| Create `src/entities/economy/actions/submitMacroBriefingAction.ts` | `'use server'` submit(isBot 게이트) |
| Create `src/entities/economy/actions/pollMacroBriefingAction.ts` | `'use server'` poll |
| Create `src/entities/economy/index.ts` | barrel(server-only 제외 규칙 준수) |
| Create `src/widgets/economy/MacroBriefing.tsx` 등 | 위젯 3종 + 훅 + degrade |
| Create `src/app/economy/page.tsx` | RSC + metadata + JSON-LD + revalidate |
| Create `src/app/economy/EconomyDegraded.tsx` | 200/noindex degrade |
| Create `src/app/economy/opengraph-image.tsx` | `force-static` OG |
| Create `e2e/economy.spec.ts` | Playwright happy/worst |

---

# Part A — siglens-core 도메인 (먼저)

> 작업 디렉토리: `/Users/y0ngha/Project/siglens-core`. 기존 패턴 참조: `src/domain/analysis/normalizeFinancials.ts`, `src/domain/analysis/normalizePrimitives.ts`, `src/application/market/{submitBriefing,pollBriefing,peekBriefingCache}.ts`, barrel `src/index.ts`. 테스트: Vitest(`src/__tests__/...`).

## Task A1: 경제 도메인 타입 정의

**Files:**
- Create: `src/domain/economy/types.ts`

- [ ] **Step 1: 타입 파일 작성**

```ts
// src/domain/economy/types.ts

/** 캘린더 이벤트 중요도. FMP `impact` = 'Low' | 'Medium' | 'High'. */
export type CalendarImpact = 'Low' | 'Medium' | 'High';

/** 한 지표의 단일 추세 포인트(시계열 1점). */
export interface EconomicIndicatorPoint {
    /** ISO 날짜(YYYY-MM-DD). */
    date: string;
    value: number;
}

/**
 * 한 경제지표(예: federalFunds)의 정규화 결과.
 * latest = 가장 최근 발표값, previous = 직전 발표값, trend = 최신→과거 N포인트.
 */
export interface EconomicIndicatorSeries {
    /** FMP `name`(예: 'federalFunds'). 레지스트리 키와 일치. */
    name: string;
    latest: EconomicIndicatorPoint | null;
    previous: EconomicIndicatorPoint | null;
    /** 미니 추세용 최신→과거 정렬 포인트(최대 N개). */
    trend: EconomicIndicatorPoint[];
}

/** treasury-rates 최신 1행에서 추출한 주요 만기 수익률. */
export interface TreasuryRateSnapshot {
    date: string;
    year2: number | null;
    year10: number | null;
}

/** 경제 캘린더 단일 이벤트(US 필터 후). */
export interface EconomicCalendarEvent {
    /** ISO 일시(원본 'YYYY-MM-DD HH:mm:ss' 보존). */
    date: string;
    event: string;
    impact: CalendarImpact;
    actual: number | null;
    estimate: number | null;
    previous: number | null;
    unit: string;
}

/** 페이지·브리핑 입력이 되는 거시 스냅샷 번들. */
export interface EconomySnapshot {
    indicators: EconomicIndicatorSeries[];
    treasury: TreasuryRateSnapshot | null;
    /** 다가오는 US 이벤트(날짜 오름차순). */
    calendar: EconomicCalendarEvent[];
}

/** AI 거시 브리핑 정규화 결과. summary는 필수(빈 문자열이면 호출부가 error 처리). */
export interface MacroBriefingResponse {
    /** 1~2문단 거시 국면 요약(한국어). */
    summary: string;
    /** 핵심 포인트 불릿(0개 가능). */
    highlights: string[];
    /** 'expansion' | 'slowdown' | 'contraction' | 'recovery' | 'neutral' 중 하나. */
    regime: MacroRegime;
}

export type MacroRegime =
    | 'expansion'
    | 'slowdown'
    | 'contraction'
    | 'recovery'
    | 'neutral';
```

- [ ] **Step 2: 커밋**

```bash
git add src/domain/economy/types.ts
git commit -m "feat(economy): 거시 도메인 타입 정의"
```

## Task A2: 경제지표 정규화 (`normalizeEconomicIndicators`)

**Files:**
- Create: `src/domain/economy/normalizeEconomicIndicators.ts`
- Test: `src/__tests__/domain/economy/normalizeEconomicIndicators.test.ts`

먼저 기존 coercer 확인: `src/domain/analysis/normalizePrimitives.ts`의 `asNumber`/`asString`/`asArray`/`asObject` 시그니처를 읽고 재사용한다(중복 구현 금지).

- [ ] **Step 1: 실패 테스트 작성**

```ts
// src/__tests__/domain/economy/normalizeEconomicIndicators.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeEconomicIndicatorSeries } from '@/domain/economy/normalizeEconomicIndicators';

const RAW = [
    { name: 'federalFunds', date: '2026-05-01', value: 3.63 },
    { name: 'federalFunds', date: '2026-04-01', value: 3.58 },
    { name: 'federalFunds', date: '2026-03-01', value: 3.55 },
];

describe('normalizeEconomicIndicatorSeries', () => {
    it('latest=가장 최근, previous=직전, trend는 최신→과거 N개', () => {
        const s = normalizeEconomicIndicatorSeries('federalFunds', RAW, 2);
        expect(s.name).toBe('federalFunds');
        expect(s.latest).toEqual({ date: '2026-05-01', value: 3.63 });
        expect(s.previous).toEqual({ date: '2026-04-01', value: 3.58 });
        expect(s.trend).toHaveLength(2);
        expect(s.trend[0]).toEqual({ date: '2026-05-01', value: 3.63 });
    });

    it('빈 배열이면 latest/previous=null, trend=[]', () => {
        const s = normalizeEconomicIndicatorSeries('federalFunds', [], 5);
        expect(s.latest).toBeNull();
        expect(s.previous).toBeNull();
        expect(s.trend).toEqual([]);
    });

    it('포인트 1개면 previous=null', () => {
        const s = normalizeEconomicIndicatorSeries('cpi', [RAW[0]], 5);
        expect(s.latest).not.toBeNull();
        expect(s.previous).toBeNull();
    });

    it('value가 숫자가 아닌 항목은 drop', () => {
        const s = normalizeEconomicIndicatorSeries(
            'x',
            [{ date: '2026-05-01', value: 'NaN' }, RAW[1]],
            5
        );
        expect(s.latest).toEqual({ date: '2026-04-01', value: 3.58 });
    });
});
```

- [ ] **Step 2: 실패 확인**

Run: `yarn vitest run src/__tests__/domain/economy/normalizeEconomicIndicators.test.ts`
Expected: FAIL — `normalizeEconomicIndicatorSeries`가 없음.

- [ ] **Step 3: 구현**

```ts
// src/domain/economy/normalizeEconomicIndicators.ts
import { asArray, asNumber, asObject, asString } from '@/domain/analysis/normalizePrimitives';
import type {
    EconomicIndicatorPoint,
    EconomicIndicatorSeries,
} from './types';

/**
 * FMP `/economic-indicators?name=<N>` 응답(최신→과거)을 정규화한다.
 * value가 유한수가 아닌 포인트는 drop. 입력은 이미 최신→과거 정렬이라 가정하되,
 * 방어적으로 date 내림차순 재정렬한다.
 */
export function normalizeEconomicIndicatorSeries(
    name: string,
    raw: unknown,
    trendLength: number
): EconomicIndicatorSeries {
    const points: EconomicIndicatorPoint[] = asArray(raw)
        .map(item => {
            const obj = asObject(item);
            if (obj === null) return null;
            const value = asNumber(obj.value);
            const date = asString(obj.date, '');
            if (value === undefined || date === '') return null;
            return { date, value };
        })
        .filter((p): p is EconomicIndicatorPoint => p !== null)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

    return {
        name,
        latest: points[0] ?? null,
        previous: points[1] ?? null,
        trend: points.slice(0, trendLength),
    };
}
```

> ⚠️ `asNumber`의 실제 반환(`number | undefined` vs `null`)을 Step에서 읽은 `normalizePrimitives.ts`에 맞춰 비교 연산자를 조정한다(위는 `undefined` 가정). 불일치 시 `=== undefined`를 `== null`로 바꾼다.

- [ ] **Step 4: 통과 확인**

Run: `yarn vitest run src/__tests__/domain/economy/normalizeEconomicIndicators.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/domain/economy/normalizeEconomicIndicators.ts src/__tests__/domain/economy/normalizeEconomicIndicators.test.ts
git commit -m "feat(economy): 경제지표 시계열 정규화"
```

## Task A3: 국채 정규화 + 2s10s 스프레드

**Files:**
- Create: `src/domain/economy/normalizeTreasuryRates.ts`
- Test: `src/__tests__/domain/economy/normalizeTreasuryRates.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
// src/__tests__/domain/economy/normalizeTreasuryRates.test.ts
import { describe, it, expect } from 'vitest';
import {
    normalizeTreasuryRates,
    computeYieldSpread,
} from '@/domain/economy/normalizeTreasuryRates';

describe('normalizeTreasuryRates', () => {
    it('최신 1행에서 year2/year10 추출', () => {
        const snap = normalizeTreasuryRates([
            { date: '2026-06-15', year2: 4.07, year10: 4.47 },
            { date: '2026-06-12', year2: 4.09, year10: 4.48 },
        ]);
        expect(snap).toEqual({ date: '2026-06-15', year2: 4.07, year10: 4.47 });
    });

    it('빈 배열이면 null', () => {
        expect(normalizeTreasuryRates([])).toBeNull();
    });

    it('year2/year10 결측이면 해당 필드 null', () => {
        const snap = normalizeTreasuryRates([{ date: '2026-06-15', year10: 4.47 }]);
        expect(snap?.year2).toBeNull();
        expect(snap?.year10).toBe(4.47);
    });
});

describe('computeYieldSpread', () => {
    it('2s10s = year10 - year2', () => {
        expect(computeYieldSpread({ date: 'x', year2: 4.07, year10: 4.47 })).toBeCloseTo(0.4);
    });
    it('한쪽 null이면 null', () => {
        expect(computeYieldSpread({ date: 'x', year2: null, year10: 4.47 })).toBeNull();
        expect(computeYieldSpread(null)).toBeNull();
    });
});
```

- [ ] **Step 2: 실패 확인**

Run: `yarn vitest run src/__tests__/domain/economy/normalizeTreasuryRates.test.ts` → FAIL

- [ ] **Step 3: 구현**

```ts
// src/domain/economy/normalizeTreasuryRates.ts
import { asArray, asNumber, asObject, asString } from '@/domain/analysis/normalizePrimitives';
import type { TreasuryRateSnapshot } from './types';

const numOrNull = (v: unknown): number | null => {
    const n = asNumber(v);
    return n === undefined ? null : n;
};

/** treasury-rates 응답(최신 먼저)에서 가장 최근 행의 2Y/10Y를 추출. */
export function normalizeTreasuryRates(raw: unknown): TreasuryRateSnapshot | null {
    const rows = asArray(raw);
    const first = asObject(rows[0]);
    if (first === null) return null;
    const date = asString(first.date, '');
    if (date === '') return null;
    return { date, year2: numOrNull(first.year2), year10: numOrNull(first.year10) };
}

/** 2s10s 스프레드(%p). 음수 = 역전(경기침체 신호). 결측이면 null. */
export function computeYieldSpread(snap: TreasuryRateSnapshot | null): number | null {
    if (snap === null || snap.year2 === null || snap.year10 === null) return null;
    return snap.year10 - snap.year2;
}
```

- [ ] **Step 4: 통과 확인** → `yarn vitest run ...normalizeTreasuryRates.test.ts` PASS
- [ ] **Step 5: 커밋** — `git commit -m "feat(economy): 국채 정규화 + 2s10s 스프레드"`

## Task A4: 경제 캘린더 정규화 + US 필터

**Files:**
- Create: `src/domain/economy/normalizeEconomicCalendar.ts`
- Test: `src/__tests__/domain/economy/normalizeEconomicCalendar.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
// src/__tests__/domain/economy/normalizeEconomicCalendar.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeEconomicCalendar } from '@/domain/economy/normalizeEconomicCalendar';

const RAW = [
    { date: '2026-06-18 12:30:00', country: 'US', event: 'CPI YoY', impact: 'High',
      previous: 2.4, estimate: 2.3, actual: null, unit: '%' },
    { date: '2026-06-16 23:50:00', country: 'JP', event: 'Machinery Orders', impact: 'Medium',
      previous: -9.4, estimate: 0.9, actual: null, unit: '%' },
    { date: '2026-06-17 14:00:00', country: 'US', event: 'Fed Rate Decision', impact: 'High',
      previous: 3.63, estimate: 3.63, actual: null, unit: '%' },
];

describe('normalizeEconomicCalendar', () => {
    it('US만 남기고 날짜 오름차순 정렬', () => {
        const out = normalizeEconomicCalendar(RAW);
        expect(out).toHaveLength(2);
        expect(out[0].event).toBe('Fed Rate Decision'); // 06-17 < 06-18
        expect(out[1].event).toBe('CPI YoY');
        expect(out.every(e => e.impact === 'High')).toBe(true);
    });

    it('impact가 Low/Medium/High 외면 Low로 강제', () => {
        const out = normalizeEconomicCalendar([
            { ...RAW[0], impact: 'garbage' },
        ]);
        expect(out[0].impact).toBe('Low');
    });

    it('빈/비배열 입력이면 []', () => {
        expect(normalizeEconomicCalendar(null)).toEqual([]);
        expect(normalizeEconomicCalendar([])).toEqual([]);
    });
});
```

- [ ] **Step 2: 실패 확인** → FAIL
- [ ] **Step 3: 구현**

```ts
// src/domain/economy/normalizeEconomicCalendar.ts
import { asArray, asEnum, asNumber, asObject, asString } from '@/domain/analysis/normalizePrimitives';
import type { CalendarImpact, EconomicCalendarEvent } from './types';

const IMPACTS: CalendarImpact[] = ['Low', 'Medium', 'High'];
const numOrNull = (v: unknown): number | null => {
    const n = asNumber(v);
    return n === undefined ? null : n;
};

/**
 * FMP economic-calendar 응답(전 국가)을 US만 필터해 정규화한다.
 * 날짜 오름차순(다가오는 순). impact는 Low/Medium/High enum 강제.
 */
export function normalizeEconomicCalendar(raw: unknown): EconomicCalendarEvent[] {
    return asArray(raw)
        .map(item => {
            const obj = asObject(item);
            if (obj === null) return null;
            if (asString(obj.country, '') !== 'US') return null;
            const date = asString(obj.date, '');
            const event = asString(obj.event, '');
            if (date === '' || event === '') return null;
            return {
                date,
                event,
                impact: asEnum<CalendarImpact>(obj.impact, IMPACTS, 'Low'),
                actual: numOrNull(obj.actual),
                estimate: numOrNull(obj.estimate),
                previous: numOrNull(obj.previous),
                unit: asString(obj.unit, ''),
            } satisfies EconomicCalendarEvent;
        })
        .filter((e): e is EconomicCalendarEvent => e !== null)
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
```

> ⚠️ `asEnum`의 실제 시그니처(`asEnum(v, valid, fallback)`)를 `normalizePrimitives.ts`에서 확인해 인자 순서를 맞춘다.

- [ ] **Step 4: 통과 확인** → PASS
- [ ] **Step 5: 커밋** — `git commit -m "feat(economy): 경제 캘린더 정규화 + US 필터"`

## Task A5: 거시 브리핑 프롬프트 빌더

**Files:**
- Create: `src/domain/economy/macroBriefingPrompt.ts`
- Test: `src/__tests__/domain/economy/macroBriefingPrompt.test.ts`

참조: `src/domain/analysis/marketBriefingPrompt.ts`(`buildMarketBriefingPrompt`)의 톤·구조를 평행 적용.

- [ ] **Step 1: 실패 테스트**

```ts
// src/__tests__/domain/economy/macroBriefingPrompt.test.ts
import { describe, it, expect } from 'vitest';
import { buildMacroBriefingPrompt } from '@/domain/economy/macroBriefingPrompt';
import type { EconomySnapshot } from '@/domain/economy/types';

const SNAP: EconomySnapshot = {
    indicators: [
        { name: 'federalFunds', latest: { date: '2026-05-01', value: 3.63 },
          previous: { date: '2026-04-01', value: 3.58 }, trend: [] },
        { name: 'inflationRate', latest: { date: '2026-06-15', value: 2.32 },
          previous: null, trend: [] },
    ],
    treasury: { date: '2026-06-15', year2: 4.07, year10: 4.47 },
    calendar: [
        { date: '2026-06-17 14:00:00', event: 'Fed Rate Decision', impact: 'High',
          actual: null, estimate: 3.63, previous: 3.63, unit: '%' },
    ],
};

describe('buildMacroBriefingPrompt', () => {
    it('지표·2s10s·임박 캘린더를 프롬프트 텍스트에 포함', () => {
        const p = buildMacroBriefingPrompt(SNAP);
        expect(p).toContain('federalFunds');
        expect(p).toContain('3.63');
        expect(p).toContain('Fed Rate Decision');
        expect(p).toContain('0.4'); // 2s10s = 4.47 - 4.07
    });

    it('빈 스냅샷에도 throw 없이 문자열 반환', () => {
        const p = buildMacroBriefingPrompt({ indicators: [], treasury: null, calendar: [] });
        expect(typeof p).toBe('string');
        expect(p.length).toBeGreaterThan(0);
    });
});
```

- [ ] **Step 2: 실패 확인** → FAIL
- [ ] **Step 3: 구현** — `buildMacroBriefingPrompt(snapshot: EconomySnapshot): string`. 지표 목록(name/latest/previous), 2s10s(`computeYieldSpread`), 임박 캘린더(상위 N High/Medium)를 한국어 system instruction과 함께 직렬화. 출력 JSON 스키마(`summary`/`highlights`/`regime`)를 프롬프트에 명시. (구체 텍스트는 `marketBriefingPrompt.ts` 톤 차용 — house style 한국어, JSON-only 응답 강제.)

```ts
// src/domain/economy/macroBriefingPrompt.ts
import { computeYieldSpread } from './normalizeTreasuryRates';
import type { EconomySnapshot } from './types';

const MAX_CALENDAR_IN_PROMPT = 6;

export function buildMacroBriefingPrompt(snapshot: EconomySnapshot): string {
    const indicatorLines = snapshot.indicators
        .map(i => {
            const l = i.latest ? `${i.latest.value} (${i.latest.date})` : 'N/A';
            const p = i.previous ? ` ← ${i.previous.value}` : '';
            return `- ${i.name}: ${l}${p}`;
        })
        .join('\n');
    const spread = computeYieldSpread(snapshot.treasury);
    const spreadLine =
        spread === null ? '2s10s: N/A' : `2s10s 스프레드: ${spread.toFixed(2)}%p`;
    const calLines = snapshot.calendar
        .slice(0, MAX_CALENDAR_IN_PROMPT)
        .map(e => `- ${e.date} ${e.event} (impact=${e.impact}, est=${e.estimate ?? 'N/A'})`)
        .join('\n');

    return [
        '당신은 미국 거시경제 애널리스트입니다. 아래 지표·국채·임박 이벤트를 종합해',
        '현재 미국 거시 국면을 한국어로 분석하세요.',
        '',
        '## 경제지표',
        indicatorLines || '(없음)',
        spreadLine,
        '',
        '## 임박 경제 이벤트',
        calLines || '(없음)',
        '',
        '## 출력(JSON만)',
        '{ "summary": "1~2문단 한국어 요약", "highlights": ["핵심 포인트", ...],',
        '  "regime": "expansion|slowdown|contraction|recovery|neutral" }',
    ].join('\n');
}
```

- [ ] **Step 4: 통과 확인** → PASS
- [ ] **Step 5: 커밋** — `git commit -m "feat(economy): 거시 브리핑 프롬프트 빌더"`

## Task A6: 거시 브리핑 정규화 (`normalizeMacroBriefing`)

**Files:**
- Create: `src/domain/economy/normalizeMacroBriefing.ts`
- Test: `src/__tests__/domain/economy/normalizeMacroBriefing.test.ts`

참조: `src/domain/analysis/normalizeMarketBriefing.ts`(방어적 정규화 패턴).

- [ ] **Step 1: 실패 테스트**

```ts
// src/__tests__/domain/economy/normalizeMacroBriefing.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeMacroBriefing } from '@/domain/economy/normalizeMacroBriefing';

describe('normalizeMacroBriefing', () => {
    it('정상 객체를 그대로 타입화', () => {
        const out = normalizeMacroBriefing({
            summary: '금리 동결 국면', highlights: ['2s10s 역전 해소'], regime: 'recovery',
        });
        expect(out.summary).toBe('금리 동결 국면');
        expect(out.highlights).toEqual(['2s10s 역전 해소']);
        expect(out.regime).toBe('recovery');
    });

    it('JSON 문자열도 파싱', () => {
        const out = normalizeMacroBriefing('{"summary":"x","highlights":[],"regime":"neutral"}');
        expect(out.summary).toBe('x');
    });

    it('regime 비정상이면 neutral, highlights 결측이면 []', () => {
        const out = normalizeMacroBriefing({ summary: 'x', regime: 'bogus' });
        expect(out.regime).toBe('neutral');
        expect(out.highlights).toEqual([]);
    });

    it('summary 결측이면 빈 문자열(호출부가 error 처리)', () => {
        const out = normalizeMacroBriefing({});
        expect(out.summary).toBe('');
    });
});
```

- [ ] **Step 2: 실패 확인** → FAIL
- [ ] **Step 3: 구현** — `normalizeMarketBriefing.ts` 패턴 차용: `unknown`(string이면 `JSON.parse` try/catch) → `asObject` → `asString(summary,'')`, `asArray(highlights).map(asString)`, `asEnum(regime, REGIMES, 'neutral')`.

```ts
// src/domain/economy/normalizeMacroBriefing.ts
import { asArray, asEnum, asObject, asString } from '@/domain/analysis/normalizePrimitives';
import type { MacroBriefingResponse, MacroRegime } from './types';

const REGIMES: MacroRegime[] = [
    'expansion', 'slowdown', 'contraction', 'recovery', 'neutral',
];

export function normalizeMacroBriefing(raw: unknown): MacroBriefingResponse {
    let value: unknown = raw;
    if (typeof raw === 'string') {
        try {
            value = JSON.parse(raw);
        } catch {
            value = {};
        }
    }
    const obj = asObject(value) ?? {};
    return {
        summary: asString(obj.summary, ''),
        highlights: asArray(obj.highlights)
            .map(h => asString(h, ''))
            .filter(h => h !== ''),
        regime: asEnum<MacroRegime>(obj.regime, REGIMES, 'neutral'),
    };
}
```

- [ ] **Step 4: 통과 확인** → PASS
- [ ] **Step 5: 커밋** — `git commit -m "feat(economy): 거시 브리핑 응답 정규화"`

## Task A7: 브리핑 cache key + application(submit/poll/peek)

**Files:**
- Modify: `src/infrastructure/cache/config.ts` (read first — `buildBriefingCacheKey`, `BRIEFING_MODEL_ID`, `MARKET_BRIEFING_CACHE_TTL` 위치 확인)
- Create: `src/application/economy/submitMacroBriefing.ts`
- Create: `src/application/economy/pollMacroBriefing.ts`
- Create: `src/application/economy/peekMacroBriefingCache.ts`
- Test: `src/__tests__/application/economy/submitMacroBriefing.test.ts`, `pollMacroBriefing.test.ts`

> 핵심: 워커 `/briefing` endpoint·job queue·cache provider는 **제네릭**(jobId·prompt·model·seed). macro 버전은 `submitBriefing.ts`/`pollBriefing.ts`를 미러링하되 **(a) 입력 타입 `EconomySnapshot`, (b) prompt=`buildMacroBriefingPrompt`, (c) normalize=`normalizeMacroBriefing`, (d) cache key=`buildMacroBriefingCacheKey`, (e) 결과 타입 `MacroBriefingResponse`**만 교체. 워커 dispatch·`setJobMeta`·`fireAndForget`·`BRIEFING_MODEL_ID`·`FETCH_DEFAULT_TIME_OUT`·`analysisSeed`는 그대로 재사용.

- [ ] **Step 1: cache key 추가** — `src/infrastructure/cache/config.ts`에 `buildMacroBriefingCacheKey(dateHour, modelId, inputHash)` 추가(기존 `buildBriefingCacheKey`와 prefix만 다르게, 예: `macro-briefing:`). 입력 해시는 `submitBriefing`의 `hashBriefingInput`을 macro 입력용으로 재사용/평행: indicator latest values + calendar event 식별자를 해시(`src/application/economy/macroInputHash.ts` 신규 — `briefingInputHash.ts` 패턴).

- [ ] **Step 2: submit/poll 실패 테스트** — `submitBriefing.test.ts`/`pollBriefing.test.ts`의 mock 구조(cache provider·job queue·worker fetch mock)를 복제해 macro 버전 작성. 케이스: cached hit 반환 / 신규 submit 시 `{status:'submitted', jobId}` + worker POST 호출 / poll processing·error·done(`normalizeMacroBriefing` 적용) / done이지만 summary 빈문자열이면 error.

- [ ] **Step 3: 실패 확인** → FAIL

- [ ] **Step 4: 구현** — 위 (a)~(e) 교체로 3개 파일 작성. `submitMacroBriefing(data: EconomySnapshot, options?: BackgroundTaskOptions): Promise<SubmitMacroBriefingResult>`, `pollMacroBriefing(jobId, options?): Promise<PollMacroBriefingResult>`, `peekMacroBriefingCache(data, dateHour): Promise<{ briefing, generatedAt } | null>`(read-only, side-effect 없음 — `peekBriefingCache.ts` 미러). 결과 타입(`SubmitMacroBriefingResult`/`PollMacroBriefingResult`)은 `types.ts`에 추가(`SubmitBriefingResult`/`PollBriefingResult` 평행).

- [ ] **Step 5: 통과 확인** → `yarn vitest run src/__tests__/application/economy/` PASS

- [ ] **Step 6: 커밋** — `git commit -m "feat(economy): 거시 브리핑 submit/poll/peek + cache key"`

## Task A8: barrel export + 빌드 + overlay

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: barrel export 추가** — 기존 Tier 섹션 컨벤션대로:

```ts
// src/index.ts (해당 Tier 섹션에 추가)
export { normalizeEconomicIndicatorSeries } from './domain/economy/normalizeEconomicIndicators';
export { normalizeTreasuryRates, computeYieldSpread } from './domain/economy/normalizeTreasuryRates';
export { normalizeEconomicCalendar } from './domain/economy/normalizeEconomicCalendar';
export { normalizeMacroBriefing } from './domain/economy/normalizeMacroBriefing';
export { buildMacroBriefingPrompt } from './domain/economy/macroBriefingPrompt';
export { submitMacroBriefing } from './application/economy/submitMacroBriefing';
export { pollMacroBriefing } from './application/economy/pollMacroBriefing';
export { peekMacroBriefingCache } from './application/economy/peekMacroBriefingCache';
export type {
    EconomicIndicatorSeries, EconomicIndicatorPoint, TreasuryRateSnapshot,
    EconomicCalendarEvent, CalendarImpact, EconomySnapshot,
    MacroBriefingResponse, MacroRegime,
    SubmitMacroBriefingResult, PollMacroBriefingResult,
} from './domain/economy/types';
```

- [ ] **Step 2: 전체 테스트 + 빌드**

Run: `yarn vitest run && yarn build`
Expected: 전 테스트 PASS, `dist/index.js` + `dist/index.d.ts` 생성, `dist/domain/economy/*` 포함.

- [ ] **Step 3: siglens로 overlay**

```bash
# core 워크트리에서
rsync -a --delete dist/ /Users/y0ngha/Project/siglens/.claude/worktrees/feat+economy-page/node_modules/@y0ngha/siglens-core/dist/
```

검증: siglens 워크트리에서 `node -e "require('@y0ngha/siglens-core')"` 또는 타입체크로 새 export 인식 확인.

- [ ] **Step 4: 커밋(core)** — `git commit -m "feat(economy): core barrel export — economy 도메인 공개 API"`

> ⚠️ **core 정식 배포는 사용자가 직접**(GitHub Packages + `v*` tag). overlay는 로컬 검증 전용 — siglens `package.json` 버전 핀은 배포 후 갱신.

---

# Part B — siglens 앱

> 작업 디렉토리: 워크트리 `feat+economy-page`. core overlay 완료 전제. 참조 패턴: `/market`(`src/app/market/page.tsx`, `src/entities/market-summary/*`, `src/widgets/dashboard/*`), financials(`cacheNonEmpty`/degrade).

## Task B1: 지표 레지스트리 (siglens config)

**Files:**
- Create: `src/shared/config/economyIndicators.ts`
- Test: `src/shared/config/__tests__/economyIndicators.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
// src/shared/config/__tests__/economyIndicators.test.ts
import { describe, it, expect } from 'vitest';
import {
    ECONOMY_INDICATORS, ECONOMY_INDICATOR_CATEGORIES, INDICATOR_TREND_LENGTH,
} from '@/shared/config/economyIndicators';

describe('economyIndicators registry', () => {
    it('11개 표시 항목(국채 2 포함) — FMP 검증 집합', () => {
        // economic-indicators 9 + treasury 2(2Y·10Y)
        const fmpNames = ECONOMY_INDICATORS.map(i => i.name);
        expect(fmpNames).toEqual([
            'federalFunds', 'inflationRate', 'CPI', 'GDP',
            'industrialProductionTotalIndex', 'smoothedUSRecessionProbabilities',
            'unemploymentRate', 'totalNonfarmPayroll', 'initialClaims',
        ]);
    });
    it('모든 지표가 유효 카테고리에 속함', () => {
        const cats = new Set(ECONOMY_INDICATOR_CATEGORIES.map(c => c.key));
        expect(ECONOMY_INDICATORS.every(i => cats.has(i.category))).toBe(true);
    });
    it('추세 길이는 양수 상수', () => {
        expect(INDICATOR_TREND_LENGTH).toBeGreaterThan(0);
    });
});
```

- [ ] **Step 2: 실패 확인** → FAIL
- [ ] **Step 3: 구현**

```ts
// src/shared/config/economyIndicators.ts
/** 미니 추세 차트에 쓰는 시계열 포인트 수(매직넘버 상수화 — MISTAKES §15). */
export const INDICATOR_TREND_LENGTH = 12;

export type EconomyCategoryKey = 'rates' | 'inflation' | 'growth' | 'labor';

export interface EconomyIndicatorMeta {
    /** FMP economic-indicators `name`(부록 A 검증값). */
    name: string;
    category: EconomyCategoryKey;
    /** 카드 표시 라벨(한국어). */
    label: string;
    /** 값 단위 표기(예: '%', 'pt', '천명'). */
    unit: string;
    /** 소수 자리. */
    precision: number;
    /** 어려운 용어 풀이(InfoTooltip, ~이에요체). */
    tooltip: string;
}

export const ECONOMY_INDICATOR_CATEGORIES: { key: EconomyCategoryKey; label: string }[] = [
    { key: 'rates', label: '금리' },
    { key: 'inflation', label: '물가' },
    { key: 'growth', label: '성장·경기' },
    { key: 'labor', label: '고용' },
];

/** FMP economic-indicators로 받는 9종(국채 2Y/10Y는 별도 treasury 경로). */
export const ECONOMY_INDICATORS: EconomyIndicatorMeta[] = [
    { name: 'federalFunds', category: 'rates', label: '연방기금금리', unit: '%', precision: 2,
      tooltip: '연준이 정하는 미국의 기준금리예요. 높을수록 돈을 빌리는 비용이 커져 경기를 식혀요.' },
    { name: 'inflationRate', category: 'inflation', label: '인플레이션율', unit: '%', precision: 2,
      tooltip: '1년 전보다 물가가 얼마나 올랐는지를 나타내요. 연준 목표는 보통 2% 근처예요.' },
    { name: 'CPI', category: 'inflation', label: '소비자물가지수', unit: 'pt', precision: 1,
      tooltip: '소비자가 사는 물건·서비스 가격을 지수로 만든 거예요. 이 지수의 변화율이 인플레이션이에요.' },
    { name: 'GDP', category: 'growth', label: 'GDP', unit: 'B$', precision: 0,
      tooltip: '미국 경제가 만들어내는 총 부가가치예요. 늘면 경기 확장, 줄면 위축 신호예요.' },
    { name: 'industrialProductionTotalIndex', category: 'growth', label: '산업생산지수', unit: 'pt', precision: 1,
      tooltip: '공장·광업·전기 등 실물 생산 활동을 지수로 본 거예요. 경기를 비교적 빠르게 보여줘요.' },
    { name: 'smoothedUSRecessionProbabilities', category: 'growth', label: '경기침체 확률', unit: '%', precision: 1,
      tooltip: '지금이 경기침체 국면일 확률을 추정한 값이에요. 높을수록 침체 신호가 강해요.' },
    { name: 'unemploymentRate', category: 'labor', label: '실업률', unit: '%', precision: 1,
      tooltip: '일할 의사가 있는데 일자리가 없는 사람의 비율이에요. 오르면 경기 둔화 신호예요.' },
    { name: 'totalNonfarmPayroll', category: 'labor', label: '비농업 고용', unit: '천명', precision: 0,
      tooltip: '농업을 뺀 미국 전체 일자리 수예요. 매달 얼마나 늘었는지가 고용 시장의 핵심 지표예요.' },
    { name: 'initialClaims', category: 'labor', label: '신규 실업수당청구', unit: '건', precision: 0,
      tooltip: '한 주 동안 새로 실업수당을 신청한 사람 수예요. 빠르게 나와서 고용을 선행해서 보여줘요.' },
];
```

- [ ] **Step 4: 통과 확인** → PASS
- [ ] **Step 5: 커밋** — `git commit -m "feat(economy): 지표 레지스트리(검증 9종 + 카테고리)"`

## Task B2: FMP provider + factory + Fake

**Files:**
- Read first: `src/shared/api/fmp/httpClient.ts`(`fmpGet`), `src/shared/api/market/getMarketDataProvider.ts`(E2E 분기), `src/shared/api/fmp/fmpUserMessage.ts`(`logFmpPaymentRequiredError`).
- Create: `src/shared/api/economy/EconomyProvider.ts`(포트 interface)
- Create: `src/shared/api/fmp/FmpEconomyProvider.ts`
- Create: `src/shared/api/fmp/FakeEconomyProvider.ts`
- Create: `src/shared/api/economy/getEconomyProvider.ts`
- Test: `src/shared/api/fmp/__tests__/FmpEconomyProvider.test.ts`

- [ ] **Step 1: 포트 interface**

```ts
// src/shared/api/economy/EconomyProvider.ts
import type {
    EconomicIndicatorSeries, TreasuryRateSnapshot, EconomicCalendarEvent,
} from '@y0ngha/siglens-core';

export interface EconomyProvider {
    /** 단일 지표 시계열(core 정규화 적용). FMP 장애 시 throw. */
    getIndicator(name: string): Promise<EconomicIndicatorSeries>;
    /** 최신 국채 2Y/10Y. */
    getTreasury(): Promise<TreasuryRateSnapshot | null>;
    /** US 경제 캘린더(from~to, US 필터·정규화 적용). */
    getCalendar(from: string, to: string): Promise<EconomicCalendarEvent[]>;
}
```

- [ ] **Step 2: 실패 테스트** — `fmpGet` mock으로 FMP 응답 주입 → provider가 core normalize 위임 후 도메인 타입 반환 검증(happy). FMP throw 시 전파 검증(worst).

```ts
// src/shared/api/fmp/__tests__/FmpEconomyProvider.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as http from '@/shared/api/fmp/httpClient';
import { FmpEconomyProvider } from '@/shared/api/fmp/FmpEconomyProvider';

vi.mock('@/shared/api/fmp/httpClient');

describe('FmpEconomyProvider', () => {
    beforeEach(() => vi.resetAllMocks());

    it('getIndicator: FMP 응답을 core normalize로 latest/previous 추출', async () => {
        vi.mocked(http.fmpGet).mockResolvedValue([
            { name: 'federalFunds', date: '2026-05-01', value: 3.63 },
            { name: 'federalFunds', date: '2026-04-01', value: 3.58 },
        ] as never);
        const p = new FmpEconomyProvider();
        const s = await p.getIndicator('federalFunds');
        expect(s.latest).toEqual({ date: '2026-05-01', value: 3.63 });
    });

    it('getTreasury: 최신 행 2Y/10Y', async () => {
        vi.mocked(http.fmpGet).mockResolvedValue([
            { date: '2026-06-15', year2: 4.07, year10: 4.47 },
        ] as never);
        const s = await new FmpEconomyProvider().getTreasury();
        expect(s).toEqual({ date: '2026-06-15', year2: 4.07, year10: 4.47 });
    });

    it('FMP throw는 전파(상위 캐시가 graceful 처리)', async () => {
        vi.mocked(http.fmpGet).mockRejectedValue(new Error('boom'));
        await expect(new FmpEconomyProvider().getTreasury()).rejects.toThrow('boom');
    });
});
```

> ⚠️ `as never`는 Vitest mock 인자 강제에만 허용(MISTAKES TS §7 예외). 프로덕션 코드에서는 금지.

- [ ] **Step 3: 실패 확인** → FAIL
- [ ] **Step 4: 구현**

```ts
// src/shared/api/fmp/FmpEconomyProvider.ts
import {
    normalizeEconomicIndicatorSeries, normalizeTreasuryRates, normalizeEconomicCalendar,
    type EconomicIndicatorSeries, type TreasuryRateSnapshot, type EconomicCalendarEvent,
} from '@y0ngha/siglens-core';
import { fmpGet } from '@/shared/api/fmp/httpClient';
import { SECONDS_PER_DAY } from '@/shared/config/time';
import { INDICATOR_TREND_LENGTH } from '@/shared/config/economyIndicators';
import type { EconomyProvider } from '@/shared/api/economy/EconomyProvider';

const REVALIDATE = SECONDS_PER_DAY; // 24h — 부록 B.1 단일 TTL

export class FmpEconomyProvider implements EconomyProvider {
    async getIndicator(name: string): Promise<EconomicIndicatorSeries> {
        const raw = await fmpGet<unknown>(
            'economic-indicators', { name }, { revalidate: REVALIDATE }
        );
        return normalizeEconomicIndicatorSeries(name, raw, INDICATOR_TREND_LENGTH);
    }
    async getTreasury(): Promise<TreasuryRateSnapshot | null> {
        const raw = await fmpGet<unknown>('treasury-rates', {}, { revalidate: REVALIDATE });
        return normalizeTreasuryRates(raw);
    }
    async getCalendar(from: string, to: string): Promise<EconomicCalendarEvent[]> {
        const raw = await fmpGet<unknown>(
            'economic-calendar', { from, to }, { revalidate: REVALIDATE }
        );
        return normalizeEconomicCalendar(raw);
    }
}
```

> ⚠️ `fmpGet`의 정확한 인자 형태(path/query/options)는 Step에서 읽은 `httpClient.ts:42`에 맞춘다. query 빈 객체 허용 여부 확인.

- [ ] **Step 5: Fake provider** — `FakeEconomyProvider.ts`: 9개 지표·treasury·calendar 결정적 fixture(실제 형태의 숫자, 추세 2+포인트). E2E·테스트용.

- [ ] **Step 6: factory** — `getMarketDataProvider.ts` 패턴 복제:

```ts
// src/shared/api/economy/getEconomyProvider.ts
import { isE2E } from '@/shared/config/e2e';
import { FmpEconomyProvider } from '@/shared/api/fmp/FmpEconomyProvider';
import type { EconomyProvider } from './EconomyProvider';

let cached: EconomyProvider | null = null;

export function getEconomyProvider(): EconomyProvider {
    if (cached !== null) return cached;
    if (isE2E()) {
        const { FakeEconomyProvider } = require('@/shared/api/fmp/FakeEconomyProvider');
        cached = new FakeEconomyProvider();
    } else {
        cached = new FmpEconomyProvider();
    }
    return cached;
}
```

> ⚠️ `isE2E()`의 실제 import 경로는 `getMarketDataProvider.ts`에서 확인해 맞춘다.

- [ ] **Step 7: 통과 확인** → `yarn test src/shared/api/fmp/__tests__/FmpEconomyProvider.test.ts` PASS
- [ ] **Step 8: 커밋** — `git commit -m "feat(economy): FMP provider + factory + Fake(E2E)"`

## Task B3: 2계층 캐시 + cacheNonEmpty + 스냅샷 조립

**Files:**
- Read first: `src/entities/market-summary/api/marketSummaryCache.ts`, `marketSummaryStaticCache.ts`, `src/shared/cache/configFingerprint.ts`, financials `getFinancialsSnapshot.ts`(`EmptyResultError`/`cacheNonEmpty`).
- Create: `src/entities/economy/lib/EmptyResultError.ts`
- Create: `src/entities/economy/lib/economyCompleteness.ts`
- Create: `src/entities/economy/api/economySnapshotCache.ts`
- Create: `src/entities/economy/api/economySnapshotStaticCache.ts`
- Test: `src/entities/economy/__tests__/economySnapshotCache.test.ts`

- [ ] **Step 1: sentinel + completeness**

```ts
// src/entities/economy/lib/EmptyResultError.ts
/** 빈 결과를 캐시에 굳히지 않기 위한 sentinel. 메시지 비교 금지 — instanceof로 식별. */
export class EmptyResultError extends Error {
    constructor() {
        super('economy snapshot empty');
        this.name = 'EmptyResultError';
    }
}
```

```ts
// src/entities/economy/lib/economyCompleteness.ts
import type { EconomySnapshot } from '@y0ngha/siglens-core';

/** 전 축(지표·국채·캘린더)이 비면 빈 스냅샷 — degrade/noindex 판정 단일 소스. */
export function isEmptyEconomySnapshot(s: EconomySnapshot): boolean {
    const noIndicators = s.indicators.every(i => i.latest === null);
    return noIndicators && s.treasury === null && s.calendar.length === 0;
}
```

- [ ] **Step 2: 실패 테스트** — `getEconomySnapshot`: provider 성공 시 9지표+treasury+calendar 조립; 한 지표 실패해도 다른 축 graceful(`Promise.allSettled`); 전 축 실패면 `EmptyResultError` throw → 바깥 catch가 빈 스냅샷 반환. `getOrSetCache`의 `shouldCache` 가드가 빈 스냅샷을 캐시 안 함.

```ts
// src/entities/economy/__tests__/economySnapshotCache.test.ts (요지)
import { describe, it, expect, vi } from 'vitest';
import { getEconomySnapshot } from '@/entities/economy/api/economySnapshotCache';
import * as factory from '@/shared/api/economy/getEconomyProvider';

it('일부 지표 실패해도 나머지 축 조립(graceful)', async () => {
    vi.spyOn(factory, 'getEconomyProvider').mockReturnValue({
        getIndicator: vi.fn(async (n: string) => {
            if (n === 'GDP') throw new Error('x');
            return { name: n, latest: { date: '2026-05-01', value: 1 }, previous: null, trend: [] };
        }),
        getTreasury: vi.fn(async () => ({ date: '2026-06-15', year2: 4.07, year10: 4.47 })),
        getCalendar: vi.fn(async () => []),
    } as never);
    const snap = await getEconomySnapshot();
    expect(snap.treasury).not.toBeNull();
    expect(snap.indicators.find(i => i.name === 'GDP')?.latest).toBeNull();
});
```

- [ ] **Step 3: 실패 확인** → FAIL
- [ ] **Step 4: 구현** — `marketSummaryCache.ts` 패턴:

```ts
// src/entities/economy/api/economySnapshotCache.ts
import 'server-only';
import { cache } from 'react';
import type { EconomySnapshot, EconomicIndicatorSeries } from '@y0ngha/siglens-core';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { SECONDS_PER_DAY } from '@/shared/config/time';
import { ECONOMY_INDICATORS } from '@/shared/config/economyIndicators';
import { getEconomyProvider } from '@/shared/api/economy/getEconomyProvider';
import { createCacheConfigFingerprint } from '@/shared/cache/configFingerprint';
import { isEmptyEconomySnapshot } from '../lib/economyCompleteness';

export const ECONOMY_CONFIG_FINGERPRINT = createCacheConfigFingerprint(
    JSON.stringify({ indicators: ECONOMY_INDICATORS.map(i => i.name) })
);
const CACHE_KEY = `economy:snapshot:${ECONOMY_CONFIG_FINGERPRINT}`;
/** 캘린더 윈도(다가오는 ~2주) 일수 — 매직넘버 상수화. */
const CALENDAR_WINDOW_DAYS = 14;

async function emptyIndicator(name: string): Promise<EconomicIndicatorSeries> {
    return { name, latest: null, previous: null, trend: [] };
}

async function fetchSnapshot(): Promise<EconomySnapshot> {
    const provider = getEconomyProvider();
    const today = new Date();
    const to = new Date(today.getTime() + CALENDAR_WINDOW_DAYS * 24 * 3600 * 1000);
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    const [indicators, treasury, calendar] = await Promise.all([
        Promise.all(
            ECONOMY_INDICATORS.map(meta =>
                provider.getIndicator(meta.name).catch(() => emptyIndicator(meta.name))
            )
        ),
        provider.getTreasury().catch(() => null),
        provider.getCalendar(iso(today), iso(to)).catch(() => []),
    ]);

    return { indicators, treasury, calendar };
}

/** React.cache(요청 dedup) + Redis(getOrSetCache). 빈 스냅샷은 캐시 안 함(오염 방지). */
export const getEconomySnapshot = cache(
    (): Promise<EconomySnapshot> =>
        getOrSetCache(
            CACHE_KEY,
            SECONDS_PER_DAY,
            fetchSnapshot,
            s => !isEmptyEconomySnapshot(s) // shouldCache: 빈 결과 미저장
        )
);
```

```ts
// src/entities/economy/api/economySnapshotStaticCache.ts
import 'server-only';
import { unstable_cache } from 'next/cache';
import type { EconomySnapshot } from '@y0ngha/siglens-core';
import { SECONDS_PER_DAY } from '@/shared/config/time';
import { getEconomySnapshot, ECONOMY_CONFIG_FINGERPRINT } from './economySnapshotCache';

/** ISR static-safe wrapper. revalidate=24h, tag=economy:snapshot. */
export function getEconomySnapshotStatic(): Promise<EconomySnapshot> {
    return unstable_cache(
        () => getEconomySnapshot(),
        ['economy-snapshot-static', ECONOMY_CONFIG_FINGERPRINT],
        { revalidate: SECONDS_PER_DAY, tags: ['economy:snapshot'] }
    )();
}
```

> 설계 노트: 스펙 §5.1은 지표별 키(`economy:indicator:<name>`)를 제안했으나, financials의 단일 스냅샷 캐시(`getFinancialsSnapshot`)가 더 단순하고 요청당 1 Redis 왕복이라 이를 채택한다. fingerprint로 레지스트리 변경 시 자동 무효화. 빈결과 오염은 `shouldCache` 가드 + `cacheNonEmpty` 의도(전 축 실패=빈 스냅샷=미저장)로 충족.

- [ ] **Step 5: 통과 확인** → PASS
- [ ] **Step 6: 커밋** — `git commit -m "feat(economy): 2계층 스냅샷 캐시 + 빈결과 오염 방지"`

## Task B4: 거시 브리핑 SSR peek + 액션

**Files:**
- Read first: `src/entities/market-summary/api/briefingStaticCache.ts`(`peekBriefingStatic`), `src/entities/market-summary/actions/submitMarketBriefingAction.ts`, `pollBriefingAction`, `src/shared/api/isBot.ts`.
- Create: `src/entities/economy/api/macroBriefingStaticCache.ts`
- Create: `src/entities/economy/actions/submitMacroBriefingAction.ts`
- Create: `src/entities/economy/actions/pollMacroBriefingAction.ts`
- Test: `src/entities/economy/__tests__/submitMacroBriefingAction.test.ts`

- [ ] **Step 1: peek static** — `briefingStaticCache.ts` 미러:

```ts
// src/entities/economy/api/macroBriefingStaticCache.ts
import 'server-only';
import { unstable_cache } from 'next/cache';
import { peekMacroBriefingCache, type EconomySnapshot } from '@y0ngha/siglens-core';
import { SECONDS_PER_DAY } from '@/shared/config/time';

/** read-only SSR seed — side-effect 없음. cache miss는 null. dateHour 버킷 키. */
export function peekMacroBriefingStatic(snapshot: EconomySnapshot, dateHour: string) {
    return unstable_cache(
        () => peekMacroBriefingCache(snapshot, dateHour),
        ['macro-briefing-peek-static', dateHour],
        { revalidate: SECONDS_PER_DAY, tags: ['economy:briefing'] }
    )();
}
```

- [ ] **Step 2: submit action 실패 테스트** — isBot true면 `{ briefing: null, botBlocked: true }`(skipEnqueue), false면 캐시 스냅샷 입력으로 core `submitMacroBriefing` 위임 후 결과 반환. `submitMarketBriefingAction.test.ts` 패턴 복제.

- [ ] **Step 3: 실패 확인** → FAIL
- [ ] **Step 4: 구현** — `submitMarketBriefingAction.ts` 미러(개별 파일에만 `'use server'`, non-function export 금지 — entities/CLAUDE.md):

```ts
// src/entities/economy/actions/submitMacroBriefingAction.ts
'use server';
import { headers } from 'next/headers';
import { submitMacroBriefing, type SubmitMacroBriefingResult } from '@y0ngha/siglens-core';
import { isBot } from '@/shared/api/isBot';
import { getEconomySnapshot } from '@/entities/economy/api/economySnapshotCache';
import { after } from 'next/server';

export interface SubmitMacroBriefingActionResult {
    input: SubmitMacroBriefingResult | null; // null = bot blocked
    botBlocked: boolean;
}

export async function submitMacroBriefingAction(): Promise<SubmitMacroBriefingActionResult> {
    if (isBot(await headers())) {
        return { input: null, botBlocked: true };
    }
    const snapshot = await getEconomySnapshot();
    const input = await submitMacroBriefing(snapshot, { waitUntil: after });
    return { input, botBlocked: false };
}
```

> ⚠️ `submitMarketBriefingAction.ts`에서 `isBot(headers)` 호출 형태(`headers()` await 여부, `after`/`waitUntil` 전달 방식)를 확인해 정확히 맞춘다(Next 16 `headers()`는 async).

```ts
// src/entities/economy/actions/pollMacroBriefingAction.ts
'use server';
import { pollMacroBriefing, type PollMacroBriefingResult } from '@y0ngha/siglens-core';

export async function pollMacroBriefingAction(jobId: string): Promise<PollMacroBriefingResult> {
    return pollMacroBriefing(jobId);
}
```

- [ ] **Step 5: 통과 확인** → PASS
- [ ] **Step 6: 커밋** — `git commit -m "feat(economy): 거시 브리핑 액션 + SSR peek seed"`

## Task B5: 위젯 3종 + 폴링 훅 + degrade

**Files:**
- Read first: `src/widgets/dashboard/hooks/{useMarketBriefing,useBriefing}.ts`, `BriefingCard.tsx`, `src/shared/ui/InfoTooltip.tsx`, `src/shared/config/{queryConfig,pollingConfig}.ts`.
- Create: `src/widgets/economy/hooks/useMacroBriefing.ts`, `useMacroBriefingPoll.ts`
- Create: `src/widgets/economy/MacroBriefing.tsx`
- Create: `src/widgets/economy/EconomicIndicatorGrid.tsx`
- Create: `src/widgets/economy/EconomicCalendar.tsx`
- Create: `src/widgets/economy/index.ts`(barrel)
- Test: `src/widgets/economy/__tests__/EconomicIndicatorGrid.test.tsx`, `EconomicCalendar.test.tsx`

- [ ] **Step 1: 폴링 훅** — `useBriefing.ts`/`useMarketBriefing.ts` 미러. `useMacroBriefing()`: 마운트 시(hydrated) `submitMacroBriefingAction` 트리거, `peekSeed` prop 수용, `botBlocked` 처리. `useMacroBriefingPoll(jobId)`: `pollMacroBriefingAction` `POLL_INTERVAL_MS` 간격, `status==='done'`이면 `refetchInterval=false`, `staleTime:Infinity`. queryKey는 `src/shared/config/queryConfig.ts` `QUERY_KEYS`에 `macroBriefing: () => ['macro-briefing'] as const` 추가.

- [ ] **Step 2: 지표 그리드 실패 테스트** — `EconomicIndicatorGrid`가 카테고리별 섹션으로 그룹화, 각 카드에 라벨·최신값·전기대비(부호색)·InfoTooltip 렌더. `latest===null`인 지표 카드는 graceful omission(렌더 안 함). 2s10s 스프레드 카드 표시.

```tsx
// src/widgets/economy/__tests__/EconomicIndicatorGrid.test.tsx (요지)
import { render, screen } from '@testing-library/react';
import { EconomicIndicatorGrid } from '@/widgets/economy/EconomicIndicatorGrid';

const SNAP = {
    indicators: [
        { name: 'federalFunds', latest: { date: '2026-05-01', value: 3.63 },
          previous: { date: '2026-04-01', value: 3.58 }, trend: [] },
        { name: 'GDP', latest: null, previous: null, trend: [] }, // omit 대상
    ],
    treasury: { date: '2026-06-15', year2: 4.07, year10: 4.47 },
    calendar: [],
};

it('값 있는 지표는 카드, latest=null 지표는 omit', () => {
    render(<EconomicIndicatorGrid snapshot={SNAP as never} />);
    expect(screen.getByText('연방기금금리')).toBeInTheDocument();
    expect(screen.queryByText('GDP')).not.toBeInTheDocument();
});
it('2s10s 스프레드 표시', () => {
    render(<EconomicIndicatorGrid snapshot={SNAP as never} />);
    expect(screen.getByText(/2s10s|장단기/)).toBeInTheDocument();
});
it('전기대비 상승은 양수 표기', () => {
    render(<EconomicIndicatorGrid snapshot={SNAP as never} />);
    expect(screen.getByText(/\+0\.05/)).toBeInTheDocument(); // 3.63 - 3.58
});
```

- [ ] **Step 3: 실패 확인** → FAIL
- [ ] **Step 4: 구현** — `EconomicIndicatorGrid`(server-renderable, 순수 props): `ECONOMY_INDICATOR_CATEGORIES` 순회 → 카테고리별 카드 그리드(`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`), `ECONOMY_INDICATORS`로 메타 매핑, `latest===null` 카드 omit. 금리 카테고리에 2s10s 스프레드 카드(`computeYieldSpread`) 주입. 각 카드 InfoTooltip은 `meta.tooltip`. `EconomicCalendar`: `calendar` 배열을 날짜·이벤트·impact 뱃지·예상/이전치 테이블/리스트로 SSR 텍스트. `MacroBriefing`(client): `useMacroBriefing` + 상태별 렌더(loading skeleton / botBlocked notice / error / done=summary+highlights+regime 뱃지). 색/디자인은 `frontend-design`→`web-design-guidelines` 스킬 적용, DESIGN.md 색 시스템 사용.

- [ ] **Step 5: 통과 확인** → PASS
- [ ] **Step 6: 커밋** — `git commit -m "feat(economy): 위젯 3종(브리핑·지표·캘린더) + 폴링 훅"`

## Task B6: 페이지 + 메타데이터 + JSON-LD + ISR

**Files:**
- Read first: `src/app/market/page.tsx`(전체), `src/shared/lib/seo.ts`(`clampSeoDescription`/`ROOT_KEYWORDS`/`buildBreadcrumbJsonLd`/`SITE_URL`/`SITE_NAME`), `src/shared/lib/og.ts`, financials `FinancialsDegraded.tsx`.
- Create: `src/app/economy/page.tsx`
- Create: `src/app/economy/EconomyDegraded.tsx`
- Create: `src/app/economy/opengraph-image.tsx`

- [ ] **Step 1: degrade 컴포넌트** — `FinancialsDegraded.tsx` 미러: h1 + "현재 거시 데이터를 불러올 수 없어요" 안내(200). 페이지에서 `isEmptyEconomySnapshot`이면 렌더 + `robots: { index: false }`.

- [ ] **Step 2: 페이지** — `src/app/market/page.tsx` 구조 복제:

```tsx
// src/app/economy/page.tsx (핵심 골격)
import type { Metadata } from 'next';
import { Suspense } from 'react';
// ... market/page.tsx와 동일한 seo/og/JsonLd import

// 24h — ISR. literal required (src/app/CLAUDE.md ISR §). 정적 라우트라 generateStaticParams 불필요.
export const revalidate = 86400;

const ECONOMY_TITLE = '미국 경제 — 지표·캘린더 한눈에';
const ECONOMY_FULL_TITLE = `${ECONOMY_TITLE} | ${SITE_NAME}`;
const ECONOMY_DESCRIPTION = clampSeoDescription(
    '미국 기준금리·물가·고용·성장 지표와 다가오는 경제 발표 일정을 한 페이지에서 봅니다. AI가 현재 거시 국면을 요약해 드려요.'
);
const ECONOMY_URL = `${SITE_URL}/economy`;
const ECONOMY_KEYWORDS = [
    ...ROOT_KEYWORDS,
    '미국 경제 지표', '미국 기준금리', 'FOMC 일정', 'CPI 발표', '미국 실업률',
    '경제 캘린더', '장단기 금리차', '미국 경기침체',
];

export async function generateMetadata(): Promise<Metadata> {
    const snapshot = await getEconomySnapshotStatic();
    const degraded = isEmptyEconomySnapshot(snapshot);
    return {
        title: ECONOMY_TITLE,
        description: ECONOMY_DESCRIPTION,
        keywords: ECONOMY_KEYWORDS,
        alternates: { canonical: ECONOMY_URL },
        robots: degraded ? { index: false } : undefined, // degrade=noindex 일치(§19)
        openGraph: { title: ECONOMY_FULL_TITLE, description: ECONOMY_DESCRIPTION,
            url: ECONOMY_URL, siteName: SITE_NAME, locale: 'ko_KR', type: 'website',
            images: [{ url: '/og-image.png', width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt: ECONOMY_FULL_TITLE }] },
        twitter: { card: 'summary_large_image', title: ECONOMY_FULL_TITLE,
            description: ECONOMY_DESCRIPTION, images: ['/og-image.png'] },
    };
}

// EconomyContent(RSC): getEconomySnapshotStatic → isEmpty면 <EconomyDegraded/> 반환.
// 아니면 dateHour 버킷 → peekMacroBriefingStatic(snapshot, dateHour).catch(()=>null)
// → <MacroBriefing peekSeed={...}/> + <EconomicIndicatorGrid snapshot/> + <EconomicCalendar events/>.
// JSON-LD: WebPage + BreadcrumbList. <h1> SSR. cold-gen에서 cookies()/headers()/connection() 금지.
```

- [ ] **Step 3: OG 이미지** — `src/app/[symbol]/opengraph-image.tsx` 패턴 복제, `export const dynamic = 'force-static'`.

- [ ] **Step 4: 빌드 검증**

Run: `yarn build 2>&1 | tee /tmp/economy-build.log; echo "exit=${PIPESTATUS[0]}"`
Expected: `/economy`가 `● (SSG)` 또는 ISR로 표시, exit=0. (파이프가 exit code 가리지 않게 PIPESTATUS 확인 — 메모리 `build_exit_code_pipe_masks_failure`.)

- [ ] **Step 5: 커밋** — `git commit -m "feat(economy): /economy 페이지 + 메타·JSON-LD + ISR 24h"`

## Task B7: barrel + lint + E2E + prod 실증

**Files:**
- Create: `src/entities/economy/index.ts`(server-only export 제외 규칙 — `economySnapshotCache`/actions는 server-only라 barrel 제외, 소비자는 직접 import)
- Create: `e2e/economy.spec.ts`

- [ ] **Step 1: E2E happy/worst** — `e2e/`의 기존 page spec 패턴 참조. happy: `/economy` 방문 → h1·지표 카드·캘린더 SSR 텍스트 존재, 브리핑 영역 렌더(Fake provider). worst: 에러 주입 쿠키/Fake로 전 축 실패 → degrade 안내 + noindex 메타. (E2E는 `E2E_TEST=1` build에서 Fake provider 사용 — `isE2E()` 분기.)

```ts
// e2e/economy.spec.ts (요지)
import { test, expect } from '@playwright/test';

test('지표·캘린더 SSR 텍스트가 크롤 가능하게 노출', async ({ page }) => {
    await page.goto('/economy');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('미국 경제');
    await expect(page.getByText('연방기금금리')).toBeVisible();
});
```

- [ ] **Step 2: lint + 전체 테스트**

Run: `yarn lint && yarn test`
Expected: 통과. boundaries(FSD 의존 방향) 위반 0.

- [ ] **Step 3: prod-like 실증** — 메모리 `worktree_node_modules_prod_verify`: prod build + start 후 `curl -I http://localhost:4200/economy`(`x-nextjs-cache: HIT`/`STALE`), 런타임 로그 `DYNAMIC_SERVER_USAGE` 0, Chrome로 SSR HTML/메타/JSON-LD/지표·캘린더 텍스트 실측.

- [ ] **Step 4: 커밋** — `git commit -m "feat(economy): E2E happy/worst + barrel + lint 정합"`

- [ ] **Step 5: PR 전 self-review** — 스펙 §10 사전 점검 체크리스트 20항목과 대조(named 반환 타입, 매직넘버 상수화, route config 리터럴, WHAT 주석 금지, false WHY 금지, 단일 TTL, cold-gen 안전, 봇 skipEnqueue, 빈결과 오염 방지, noindex 일치, 커버리지 90%+ 등).

---

## 구현 후 흐름 (CLAUDE.md 라우팅)

1. 구현 완료 → `review-agent` 호출(라운드 루프).
2. `approved` → `mistake-managing-agent` → `git-agent`(PR 생성, 일반 merge).
3. cross-repo: **core PR 먼저** → 사용자가 core 배포 → siglens `package.json` core 버전 핀 갱신 + clean install → siglens PR.
4. PR 리뷰 자동 반영(claude-code-review + Gemini 모니터, 메모리 `pr_review_reflection_workflow`).

---

## Self-Review (작성자 점검 결과)

- **스펙 커버리지:** §4 라우트(B6)·§5.1 지표(A2/B1/B3)·§5.2 캘린더(A4/B3)·§5.3 빈결과(B3)·§5.4 단일TTL(B2/B3 `SECONDS_PER_DAY`)·§6 브리핑(A5~A7/B4/B5)·§7 SEO·ISR(B6)·§8 degrade(B3 completeness/B6 EconomyDegraded)·§10 체크리스트(B7 Step5)·부록 A(전제) 모두 태스크 매핑됨.
- **타입 일관성:** `EconomySnapshot`·`EconomicIndicatorSeries`·`MacroBriefingResponse`·`normalizeEconomicIndicatorSeries`·`computeYieldSpread`·`submitMacroBriefing`/`pollMacroBriefing`/`peekMacroBriefingCache`·`getEconomySnapshot(Static)`·`isEmptyEconomySnapshot`·`getEconomyProvider`/`EconomyProvider` 명칭이 Part A↔B 전반에서 일치.
- **검증 필요 지점(구현 시 실파일 대조):** `normalizePrimitives`의 `asNumber`/`asEnum` 정확 시그니처, `fmpGet` 인자 형태, `isE2E()` 경로, `headers()` async·`after`/`waitUntil` 전달, core `infrastructure/cache/config.ts`의 cache-key 헬퍼 위치. 각 태스크 "Read first"에 명시.
- **의도적 스펙 이탈 1건:** §5.1은 지표별 캐시 키를 제안했으나 B3에서 financials식 **단일 스냅샷 키**로 단순화(요청당 1 Redis 왕복, fingerprint 무효화). 근거를 B3 설계 노트에 기록.
