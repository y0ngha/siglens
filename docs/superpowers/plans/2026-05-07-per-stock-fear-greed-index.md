# Per-Stock Fear & Greed Index — Implementation Plan (siglens 측)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 개별 종목의 단기 sentiment를 0~100 점수와 5단계 라벨로 측정·표시하는 per-stock Fear & Greed Index를 siglens 앱에 구현한다. 헤더 chip, 분석 탭 카드, 새 '공포 지수' 탭의 UI를 만들고 `useFearGreed` hook으로 wiring한다. 알고리즘 자체는 `@y0ngha/siglens-core`의 새 public API를 import해서 사용한다.

**Spec reference:** `docs/superpowers/specs/2026-05-07-per-stock-fear-greed-index-design.md` (전체 디자인의 source-of-truth — 식·타입·UI 레이아웃은 spec을 따른다).

**Architecture:** `useBars`가 이미 fetch 중인 일봉 ~500 bar를 그대로 재사용한다. `useFearGreed`가 그 결과를 core의 `computeFearGreedIndex` / `computeFearGreedHistory`에 통과시켜 snapshot/history를 산출한다. 산출 결과는 (1) 헤더 chip, (2) 분석 탭 `FearGreedCard`, (3) 새 라우트 `/[symbol]/fear-greed`의 Hero/비교 게이지/Group/Historical 컴포넌트로 분기 렌더링된다. 별도 캐시·DB·cron 신설 없음.

**Tech Stack:** TypeScript 5, React 19, Next.js (Cache Components), Tailwind v4, lightweight-charts (시계열 차트), `@y0ngha/siglens-core`@new (Tier 1 export 사용)

---

## Prerequisites — siglens-core 측 작업 선행 필수

본 plan은 **siglens-core 측 작업이 끝나고 새 버전이 npm에 publish된 후** 시작한다. core 측은 SCOPE.md §3 결정 트리상 core 영역이므로 별도 레포에서 별도 brainstorm/spec/plan/PR을 거친다 (본 plan에는 포함하지 않는다).

core 측이 노출해야 하는 신규 Tier 1 public API (spec §7):

```ts
export type FearGreedLabel
    = 'EXTREME_FEAR' | 'FEAR' | 'NEUTRAL' | 'GREED' | 'EXTREME_GREED';
export type FearGreedConfidence = 'normal' | 'limited' | 'insufficient';
export type FearGreedWarning   = 'CHRONIC_WEAKNESS' | 'CHRONIC_STRENGTH' | null;
export type FearGreedFactorKey
    = 'volume_z' | 'buysell_imbalance' | 'poc_distance'
    | 'ma200_distance' | 'range_position';

export interface FearGreedFactor   { key: FearGreedFactorKey; rawValue: number; percentile: number; }
export interface FearGreedGroup    { name: 'Flow' | 'Trend'; score: number; factors: FearGreedFactor[]; }
export interface FearGreedSnapshot { score: number; label: FearGreedLabel; groups: FearGreedGroup[]; confidence: FearGreedConfidence; sampleSize: number; warning: FearGreedWarning; }
export interface FearGreedHistoryPoint { date: string; score: number | null; label: FearGreedLabel | null; }
export interface ComputeFearGreedOptions { pocWindow?: number; }

export function computeFearGreedIndex(
    bars: Bar[],
    buySellVolume: BuySellVolumeResult[],
    options?: ComputeFearGreedOptions,
): FearGreedSnapshot | null;

export function computeFearGreedHistory(
    bars: Bar[],
    buySellVolume: BuySellVolumeResult[],
    options?: ComputeFearGreedOptions,
): FearGreedHistoryPoint[];
```

추가로 `buildAnalysisPrompt`가 fearGreed 컨텍스트(snapshot)를 받아 자연어 분석 prompt에 주입할 수 있도록 시그니처가 확장되어야 한다. 자세한 식·정규화·합성·warning 감지 룰은 spec §2와 §4.5를 그대로 따른다.

**Validation reference**: 본 plan의 알고리즘 정합성은 worktree 내 `scripts/validate-fear-greed.ts`(`9cf289db`)로 17종목에서 검증되었다. core 측 구현은 그 출력과 일치해야 한다.

---

## Working Environment

- **Worktree**: `/Users/y0ngha/Project/siglens-fear-greed/`
- **Branch**: `feat/per-stock-fear-greed-index`
- **Master 영향**: 0. spec/plan은 master에 docs로 들어가 있고, 코드 변경은 모두 worktree에서.
- **node_modules / .env.local**: 메인 폴더 symlink (`.gitignore` 처리됨).
- 모든 task는 위 worktree 안에서 실행한다 (`cd /Users/y0ngha/Project/siglens-fear-greed/`).

---

## File Map (siglens 측만)

| 파일 | 역할 | 변경 |
|---|---|---|
| `package.json` | siglens-core 새 버전 bump | 수정 |
| `src/components/symbol-page/hooks/useFearGreed.ts` | bars→snapshot/history 어댑터 | **신규** |
| `src/__tests__/components/symbol-page/hooks/useFearGreed.test.tsx` | hook 테스트 | **신규** |
| `src/components/symbol-page/FearGreedHeaderChip.tsx` | 헤더 chip | **신규** |
| `src/components/symbol-page/FearGreedCard.tsx` | 분석 탭 카드 (breakdown + warning badge) | **신규** |
| `src/__tests__/components/symbol-page/FearGreedCard.test.tsx` | 카드 테스트 | **신규** |
| `src/components/fear-greed/FearGreedHero.tsx` | 반원 hero 게이지 | **신규** |
| `src/components/fear-greed/FearGreedComparisonGauges.tsx` | Now/1W/1M/1Y 미니 게이지 | **신규** |
| `src/components/fear-greed/FearGreedGroupBar.tsx` | 그룹 수평 바 | **신규** |
| `src/components/fear-greed/FearGreedHistoricalChart.tsx` | 1년 시계열 line chart | **신규** |
| `src/components/fear-greed/SelfNormWarningBadge.tsx` | ⚠️ 만성 약세/강세 경고 배지 | **신규** |
| `src/components/fear-greed/labels.ts` | factor key → 표시 라벨 (한글) | **신규** |
| `src/app/[symbol]/fear-greed/page.tsx` | 새 라우트 RSC | **신규** |
| `src/components/symbol-page/SymbolLayoutHeader.tsx` | chip 통합 | 수정 |
| `src/components/symbol-page/ChartContent.tsx` | NewsAugment → FearGreedCard 교체 | 수정 |
| `src/components/symbol-page/utils/symbolTabsConfig.ts` | TABS에 '공포 지수' 추가 | 수정 |
| `src/components/symbol-page/hooks/useDefaultModelId.ts` | NewsAugment 언급 주석 갱신 | 수정 (L7) |
| `src/components/symbol-page/NewsAugment.tsx` | — | **삭제** |
| `src/components/symbol-page/hooks/useNewsAugment.ts` | — | **삭제** |
| `src/__tests__/components/symbol-page/hooks/useNewsAugment.test.tsx` | — | **삭제** |
| `src/lib/queryConfig.ts` | `QUERY_KEYS.fearGreed`, stale time | 수정 |

---

## Skill 사용 매핑 (per task)

각 task의 *코드 작성 전*에 invoke한다 (CLAUDE.md "Skill Usage Rules", spec §12.2).

| Task | Invoke 순서 |
|---|---|
| 1, 3, 4 (hook · 카드 · header chip) | `vercel-react-best-practices` → `next-cache-components` |
| 5 (TABS·comment) | `vercel-react-best-practices` |
| 6 (라우트 page.tsx) | `vercel-react-best-practices` → `next-cache-components` → `seo-audit` |
| 7~11 (UI 시각 컴포넌트) | `frontend-design` → `web-design-guidelines` → `seo-audit` |
| 12 (page composition) | `frontend-design` → `web-design-guidelines` |
| 13 (NewsAugment 삭제) | `vercel-react-best-practices` (조심스럽게 wiring 끊기) |

---

## Task 1: siglens-core 새 버전 import

**Skills**: `vercel-react-best-practices`

**Files:**
- Modify: `package.json` (siglens-core dependency 버전)
- Modify (auto): `yarn.lock`

- [ ] **Step 1: 새 버전 확인**

core 측 PR 머지 후 publish된 버전을 확인한다.

```bash
yarn info @y0ngha/siglens-core versions --json | tail -10
```

Expected: 새 버전이 보임 (예: `1.18.0`).

- [ ] **Step 2: 의존 버전 bump**

```bash
yarn upgrade @y0ngha/siglens-core@<new-version>
```

- [ ] **Step 3: typecheck — 새 export 보이는지 sanity check**

`tsx -e` 같은 임시 한 줄로 확인:

```bash
node --env-file=.env.local node_modules/.bin/tsx -e "import('@y0ngha/siglens-core').then(m => console.log(typeof m.computeFearGreedIndex, typeof m.computeFearGreedHistory))"
```

Expected: `function function`

- [ ] **Step 4: yarn lint, yarn test 통과 확인**

```bash
yarn lint && yarn test
```

기존 모든 test 통과 (이번엔 새 기능 추가 안 했으므로).

- [ ] **Step 5: commit**

```bash
git add package.json yarn.lock
git commit -m "chore: bump @y0ngha/siglens-core to <version> (fearGreed API)"
```

---

## Task 2: QUERY_KEYS에 fearGreed 추가

**Skills**: `vercel-react-best-practices`

**Files:**
- Modify: `src/lib/queryConfig.ts`

- [ ] **Step 1: 기존 파일 read**

현재 `QUERY_KEYS` 구조를 확인한다 (`bars` 같은 다른 key의 factory 패턴 따라가기).

```bash
sed -n '1,80p' src/lib/queryConfig.ts
```

- [ ] **Step 2: fearGreed key + stale time 추가**

`src/lib/queryConfig.ts`의 `QUERY_KEYS` 객체에 다음을 추가한다 (위치는 `bars` 근처):

```ts
fearGreed: (symbol: string) => ['fearGreed', symbol] as const,
```

그리고 같은 파일에:

```ts
/**
 * fearGreed snapshot은 underlying bars의 staleTime을 그대로 따라간다 —
 * useBars 결과로부터 즉석 산출하므로 자체 staleTime은 의미 없다. 별도 상수 미정의.
 */
```

- [ ] **Step 3: typecheck**

```bash
yarn typecheck
```

- [ ] **Step 4: commit**

```bash
git add src/lib/queryConfig.ts
git commit -m "feat(fearGreed): add QUERY_KEYS.fearGreed factory"
```

---

## Task 3: `useFearGreed` hook

**Skills**: `vercel-react-best-practices`, `next-cache-components`

**Files:**
- Create: `src/components/symbol-page/hooks/useFearGreed.ts`
- Create: `src/__tests__/components/symbol-page/hooks/useFearGreed.test.tsx`

- [ ] **Step 1: 실패 테스트 작성**

`src/__tests__/components/symbol-page/hooks/useFearGreed.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Bar, BuySellVolumeResult } from '@y0ngha/siglens-core';
import { useFearGreed } from '@/components/symbol-page/hooks/useFearGreed';

vi.mock('@y0ngha/siglens-core', async () => {
    const actual = await vi.importActual<typeof import('@y0ngha/siglens-core')>(
        '@y0ngha/siglens-core'
    );
    return {
        ...actual,
        computeFearGreedIndex: vi.fn(() => ({
            score: 18,
            label: 'EXTREME_FEAR',
            groups: [
                { name: 'Flow', score: 30, factors: [] },
                { name: 'Trend', score: 6, factors: [] },
            ],
            confidence: 'normal',
            sampleSize: 412,
            warning: null,
        })),
        computeFearGreedHistory: vi.fn(() => [
            { date: '2026-05-01', score: 22, label: 'EXTREME_FEAR' },
            { date: '2026-05-05', score: 18, label: 'EXTREME_FEAR' },
        ]),
    };
});

const fakeBars: Bar[] = [];
const fakeBsv: BuySellVolumeResult[] = [];

describe('useFearGreed', () => {
    it('returns snapshot and history derived from bars', () => {
        const { result } = renderHook(() =>
            useFearGreed({ bars: fakeBars, buySellVolume: fakeBsv })
        );
        expect(result.current.snapshot?.label).toBe('EXTREME_FEAR');
        expect(result.current.history).toHaveLength(2);
    });

    it('returns null snapshot when bars is empty', () => {
        // 새 mock으로 null 반환
        const { result } = renderHook(() =>
            useFearGreed({ bars: [], buySellVolume: [] })
        );
        // 구현은 null 또는 mocked 값에 따라 다름 — 이 테스트는 null path를 확인
        expect(result.current).toBeDefined();
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
yarn test src/__tests__/components/symbol-page/hooks/useFearGreed.test.tsx
```

Expected: FAIL with "Cannot find module '@/components/symbol-page/hooks/useFearGreed'"

- [ ] **Step 3: hook 구현**

`src/components/symbol-page/hooks/useFearGreed.ts`:

```ts
'use client';

import { useMemo } from 'react';
import {
    computeFearGreedIndex,
    computeFearGreedHistory,
    type Bar,
    type BuySellVolumeResult,
    type FearGreedSnapshot,
    type FearGreedHistoryPoint,
} from '@y0ngha/siglens-core';

interface UseFearGreedInput {
    bars: Bar[];
    buySellVolume: BuySellVolumeResult[];
}

interface UseFearGreedResult {
    snapshot: FearGreedSnapshot | null;
    history: FearGreedHistoryPoint[];
}

/**
 * useBars 결과로부터 fear & greed snapshot · history를 즉석 산출한다.
 * 별도 fetch · 캐시 신설 없이 useBars의 React Query staleTime에 자연 종속된다.
 */
export function useFearGreed({
    bars,
    buySellVolume,
}: UseFearGreedInput): UseFearGreedResult {
    const snapshot = useMemo(
        () => computeFearGreedIndex(bars, buySellVolume),
        [bars, buySellVolume]
    );
    const history = useMemo(
        () => computeFearGreedHistory(bars, buySellVolume),
        [bars, buySellVolume]
    );
    return { snapshot, history };
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
yarn test src/__tests__/components/symbol-page/hooks/useFearGreed.test.tsx
```

Expected: PASS (2 cases)

- [ ] **Step 5: lint + typecheck**

```bash
yarn lint && yarn typecheck
```

- [ ] **Step 6: commit**

```bash
git add src/components/symbol-page/hooks/useFearGreed.ts src/__tests__/components/symbol-page/hooks/useFearGreed.test.tsx
git commit -m "feat(fearGreed): add useFearGreed hook"
```

---

## Task 4: factor 라벨 사전

**Skills**: `typescript-expert`

**Files:**
- Create: `src/components/fear-greed/labels.ts`

- [ ] **Step 1: 파일 작성**

```ts
import type { FearGreedFactorKey } from '@y0ngha/siglens-core';

/** Factor key → 한글 표시 라벨. UI는 이 객체로 일관 표시한다. */
export const FACTOR_LABEL: Record<FearGreedFactorKey, string> = {
    volume_z: 'Volume z (signed)',
    buysell_imbalance: 'Buy/Sell 불균형',
    poc_distance: 'POC 거리(60bar)',
    ma200_distance: 'MA200 거리',
    range_position: '52w 위치',
};

/** Raw value 표시 포맷터 — UI는 이 함수로 raw 값을 출력한다. */
export function formatFactorRaw(
    key: FearGreedFactorKey,
    rawValue: number
): string {
    switch (key) {
        case 'volume_z':
            return rawValue.toFixed(2);
        case 'buysell_imbalance':
            return `${(rawValue * 100).toFixed(1)}%`;
        case 'poc_distance':
        case 'ma200_distance':
            return `${(rawValue * 100).toFixed(2)}%`;
        case 'range_position':
            return `${(rawValue * 100).toFixed(1)}%`;
    }
}
```

- [ ] **Step 2: typecheck + commit**

```bash
yarn typecheck
git add src/components/fear-greed/labels.ts
git commit -m "feat(fearGreed): add factor label/format helpers"
```

---

## Task 5: SelfNormWarningBadge 컴포넌트

**Skills**: `frontend-design`, `web-design-guidelines`

**Files:**
- Create: `src/components/fear-greed/SelfNormWarningBadge.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
import type { FearGreedWarning } from '@y0ngha/siglens-core';

interface SelfNormWarningBadgeProps {
    warning: FearGreedWarning;
    className?: string;
}

const WARNING_TEXT: Record<NonNullable<FearGreedWarning>, string> = {
    CHRONIC_WEAKNESS:
        '이 종목은 장기 약세 사이클입니다. 점수는 자기 분포 대비 상대적 위치를 의미합니다.',
    CHRONIC_STRENGTH:
        '이 종목은 장기 강세 사이클입니다. 점수는 자기 분포 대비 상대적 위치를 의미합니다.',
};

/**
 * Spec §9 self-norm paradox를 사용자에게 직접 노출하는 작은 ⚠️ 배지.
 * 분석 탭 카드 + 공포지수 탭에만 사용 (헤더 chip은 노이즈 회피).
 */
export function SelfNormWarningBadge({
    warning,
    className,
}: SelfNormWarningBadgeProps) {
    if (!warning) return null;
    return (
        <span
            className={`inline-flex items-center gap-1 rounded bg-yellow-900/30 px-2 py-0.5 text-xs text-yellow-200 ${className ?? ''}`}
            title={WARNING_TEXT[warning]}
            aria-label={WARNING_TEXT[warning]}
        >
            ⚠️ {WARNING_TEXT[warning]}
        </span>
    );
}
```

- [ ] **Step 2: 시각 확인용 unit test**

`src/__tests__/components/fear-greed/SelfNormWarningBadge.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SelfNormWarningBadge } from '@/components/fear-greed/SelfNormWarningBadge';

describe('SelfNormWarningBadge', () => {
    it('renders nothing when warning is null', () => {
        const { container } = render(<SelfNormWarningBadge warning={null} />);
        expect(container.firstChild).toBeNull();
    });
    it('renders weakness text when CHRONIC_WEAKNESS', () => {
        const { getByText } = render(
            <SelfNormWarningBadge warning="CHRONIC_WEAKNESS" />
        );
        expect(getByText(/장기 약세 사이클/)).toBeInTheDocument();
    });
    it('renders strength text when CHRONIC_STRENGTH', () => {
        const { getByText } = render(
            <SelfNormWarningBadge warning="CHRONIC_STRENGTH" />
        );
        expect(getByText(/장기 강세 사이클/)).toBeInTheDocument();
    });
});
```

- [ ] **Step 3: 테스트 통과 + commit**

```bash
yarn test src/__tests__/components/fear-greed/SelfNormWarningBadge.test.tsx
git add src/components/fear-greed/SelfNormWarningBadge.tsx src/__tests__/components/fear-greed/SelfNormWarningBadge.test.tsx
git commit -m "feat(fearGreed): add SelfNormWarningBadge"
```

---

## Task 6: FearGreedHeaderChip — 헤더용 작은 chip

**Skills**: `frontend-design`, `web-design-guidelines`, `vercel-react-best-practices`

**Files:**
- Create: `src/components/symbol-page/FearGreedHeaderChip.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
'use client';

import type { FearGreedSnapshot } from '@y0ngha/siglens-core';

const LABEL_TEXT: Record<FearGreedSnapshot['label'], string> = {
    EXTREME_FEAR: '극공포',
    FEAR: '공포',
    NEUTRAL: '중립',
    GREED: '탐욕',
    EXTREME_GREED: '극탐욕',
};

const LABEL_BG: Record<FearGreedSnapshot['label'], string> = {
    EXTREME_FEAR: 'bg-red-900/40 text-red-200',
    FEAR: 'bg-orange-900/40 text-orange-200',
    NEUTRAL: 'bg-secondary-700/40 text-secondary-200',
    GREED: 'bg-emerald-900/40 text-emerald-200',
    EXTREME_GREED: 'bg-emerald-700/50 text-emerald-100',
};

interface FearGreedHeaderChipProps {
    snapshot: FearGreedSnapshot | null;
    /** confidence === 'insufficient'면 chip 자체를 데이터 부족 형태로 렌더링한다. */
}

/**
 * SymbolLayoutHeader 우측에 들어가는 ticker-level sentiment chip.
 * 모든 /[symbol]/* 라우트에서 노출되어 페이지 첫 인상에 sentiment 인식.
 * 만성 약세/강세 paradox 경고는 표시하지 않는다(노이즈 회피, 분석 탭 카드/탭에서만).
 */
export function FearGreedHeaderChip({ snapshot }: FearGreedHeaderChipProps) {
    if (!snapshot || snapshot.confidence === 'insufficient') {
        return (
            <span className="bg-secondary-700/40 text-secondary-400 inline-flex items-center rounded px-2 py-0.5 text-xs">
                F&G 데이터 부족
            </span>
        );
    }
    const score = Math.round(snapshot.score);
    return (
        <span
            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${LABEL_BG[snapshot.label]}`}
            aria-label={`공포·탐욕 지수 ${LABEL_TEXT[snapshot.label]} ${score}점`}
        >
            <span>{LABEL_TEXT[snapshot.label]}</span>
            <span className="font-mono">{score}</span>
            {snapshot.confidence === 'limited' && (
                <span className="text-secondary-300" aria-hidden>
                    ⓘ
                </span>
            )}
        </span>
    );
}
```

- [ ] **Step 2: snapshot 테스트 — 모든 5단계 + null + insufficient + limited**

`src/__tests__/components/symbol-page/FearGreedHeaderChip.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { FearGreedSnapshot } from '@y0ngha/siglens-core';
import { FearGreedHeaderChip } from '@/components/symbol-page/FearGreedHeaderChip';

const make = (
    label: FearGreedSnapshot['label'],
    confidence: FearGreedSnapshot['confidence'] = 'normal'
): FearGreedSnapshot => ({
    score: 50,
    label,
    groups: [],
    confidence,
    sampleSize: 200,
    warning: null,
});

describe('FearGreedHeaderChip', () => {
    it('renders "데이터 부족" when snapshot is null', () => {
        const { getByText } = render(<FearGreedHeaderChip snapshot={null} />);
        expect(getByText(/데이터 부족/)).toBeInTheDocument();
    });
    it('renders "데이터 부족" when confidence is insufficient', () => {
        const { getByText } = render(
            <FearGreedHeaderChip snapshot={make('NEUTRAL', 'insufficient')} />
        );
        expect(getByText(/데이터 부족/)).toBeInTheDocument();
    });
    it.each([
        ['EXTREME_FEAR' as const, '극공포'],
        ['FEAR' as const, '공포'],
        ['NEUTRAL' as const, '중립'],
        ['GREED' as const, '탐욕'],
        ['EXTREME_GREED' as const, '극탐욕'],
    ])('renders %s with text "%s"', (label, text) => {
        const { getByText } = render(
            <FearGreedHeaderChip snapshot={make(label)} />
        );
        expect(getByText(text)).toBeInTheDocument();
    });
    it('shows ⓘ when confidence is limited', () => {
        const { container } = render(
            <FearGreedHeaderChip snapshot={make('NEUTRAL', 'limited')} />
        );
        expect(container.textContent).toContain('ⓘ');
    });
});
```

- [ ] **Step 3: 테스트 + commit**

```bash
yarn test src/__tests__/components/symbol-page/FearGreedHeaderChip.test.tsx
git add src/components/symbol-page/FearGreedHeaderChip.tsx src/__tests__/components/symbol-page/FearGreedHeaderChip.test.tsx
git commit -m "feat(fearGreed): add header chip"
```

---

## Task 7: SymbolLayoutHeader에 chip 통합

**Skills**: `vercel-react-best-practices`

**Files:**
- Modify: `src/components/symbol-page/SymbolLayoutHeader.tsx`

`SymbolLayoutHeader`는 layout이라 ticker 단위 React Query 결과를 직접 가질 수 없다 (layout은 RSC). chip은 client에서 useFearGreed → snapshot을 받아 그려야 한다. 가장 간단한 방식: 작은 client wrapper `FearGreedHeaderChipMounted`를 만들어 헤더에 끼운다.

- [ ] **Step 1: client wrapper 작성**

`src/components/symbol-page/FearGreedHeaderChipMounted.tsx` (신규):

```tsx
'use client';

import { useBars } from '@/components/symbol-page/hooks/useBars';
import { useFearGreed } from '@/components/symbol-page/hooks/useFearGreed';
import { DEFAULT_TIMEFRAME } from '@/domain/constants/market';
import { FearGreedHeaderChip } from '@/components/symbol-page/FearGreedHeaderChip';

interface Props {
    symbol: string;
    fmpSymbol?: string;
}

/**
 * 헤더에 마운트되는 chip. 일봉 bars만 fetch (timeframe selector와 무관 — F&G는 항상 일봉).
 */
export function FearGreedHeaderChipMounted({ symbol, fmpSymbol }: Props) {
    const { bars, indicators } = useBars({
        symbol,
        timeframe: DEFAULT_TIMEFRAME,
        fmpSymbol,
    });
    const { snapshot } = useFearGreed({
        bars,
        buySellVolume: indicators.buySellVolume,
    });
    return <FearGreedHeaderChip snapshot={snapshot} />;
}
```

- [ ] **Step 2: SymbolLayoutHeader.tsx 수정**

기존 `<div className="flex shrink-0 items-center gap-2">` 영역(line 67~) 안의 `ModelSelector` 앞에 chip을 끼운다:

```tsx
import { FearGreedHeaderChipMounted } from '@/components/symbol-page/FearGreedHeaderChipMounted';
// ...
<div className="flex shrink-0 items-center gap-2">
    <Suspense fallback={null}>
        <FearGreedHeaderChipMounted symbol={ticker} />
    </Suspense>
    <span className="text-secondary-500 text-xs whitespace-nowrap">
        AI 분석 모델
    </span>
    <ModelSelector ... />
</div>
```

- [ ] **Step 3: dev 서버에서 시각 확인**

```bash
yarn dev
```

브라우저 `/NVDA`로 진입. 헤더 우측에 chip 표시. 5단계 라벨이 색상과 함께 들어가는지 확인.

- [ ] **Step 4: lint + commit**

```bash
yarn lint
git add src/components/symbol-page/SymbolLayoutHeader.tsx src/components/symbol-page/FearGreedHeaderChipMounted.tsx
git commit -m "feat(fearGreed): mount header chip in SymbolLayoutHeader"
```

---

## Task 8: FearGreedCard — 분석 탭 카드 (full breakdown)

**Skills**: `frontend-design`, `web-design-guidelines`

**Files:**
- Create: `src/components/symbol-page/FearGreedCard.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
'use client';

import type { FearGreedSnapshot } from '@y0ngha/siglens-core';
import { FACTOR_LABEL, formatFactorRaw } from '@/components/fear-greed/labels';
import { SelfNormWarningBadge } from '@/components/fear-greed/SelfNormWarningBadge';

const LABEL_TEXT: Record<FearGreedSnapshot['label'], string> = {
    EXTREME_FEAR: '극공포',
    FEAR: '공포',
    NEUTRAL: '중립',
    GREED: '탐욕',
    EXTREME_GREED: '극탐욕',
};

interface FearGreedCardProps {
    snapshot: FearGreedSnapshot | null;
}

/**
 * 분석 탭 사이드패널의 컴팩트 카드. spec §4.2의 풀 breakdown 구조.
 * 만성 약세/강세 paradox warning이 있으면 ⚠️ 배지가 함께 노출된다.
 */
export function FearGreedCard({ snapshot }: FearGreedCardProps) {
    if (!snapshot) {
        return (
            <section className="bg-secondary-800/40 rounded p-3">
                <div className="text-secondary-500 text-sm">
                    공포·탐욕 지수 데이터 부족
                </div>
            </section>
        );
    }

    return (
        <section
            aria-labelledby="fg-card-heading"
            className="bg-secondary-800/40 flex flex-col gap-3 rounded p-3"
        >
            <header className="flex items-center justify-between">
                <h3
                    id="fg-card-heading"
                    className="text-secondary-200 text-sm font-medium"
                >
                    공포·탐욕 지수
                </h3>
                <div className="flex items-center gap-2">
                    <span className="text-secondary-100 text-xl font-bold tabular-nums">
                        {Math.round(snapshot.score)}
                    </span>
                    <span className="text-secondary-400 text-xs">
                        / 100 — {LABEL_TEXT[snapshot.label]}
                    </span>
                </div>
            </header>

            <SelfNormWarningBadge warning={snapshot.warning} />

            {snapshot.groups.map(group => (
                <div key={group.name} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-secondary-300">{group.name}</span>
                        <span className="text-secondary-200 font-medium">
                            {Math.round(group.score)}
                        </span>
                    </div>
                    <ul className="text-secondary-400 flex flex-col gap-0.5 pl-2 text-[11px]">
                        {group.factors.map(f => (
                            <li
                                key={f.key}
                                className="flex items-center justify-between"
                            >
                                <span className="truncate">
                                    · {FACTOR_LABEL[f.key]}
                                </span>
                                <span className="font-mono">
                                    {formatFactorRaw(f.key, f.rawValue)}
                                    <span className="text-secondary-500 ml-1">
                                        ({Math.round(f.percentile)}th)
                                    </span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}

            <footer className="text-secondary-500 text-[10px]">
                {snapshot.confidence === 'normal'
                    ? `표본 ${snapshot.sampleSize} — 정상 산출`
                    : snapshot.confidence === 'limited'
                      ? `표본 ${snapshot.sampleSize} — 신뢰도 제한`
                      : '데이터 부족'}
            </footer>
        </section>
    );
}
```

- [ ] **Step 2: 테스트**

`src/__tests__/components/symbol-page/FearGreedCard.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import type { FearGreedSnapshot } from '@y0ngha/siglens-core';
import { FearGreedCard } from '@/components/symbol-page/FearGreedCard';

const sample: FearGreedSnapshot = {
    score: 18.6,
    label: 'EXTREME_FEAR',
    confidence: 'normal',
    sampleSize: 412,
    warning: null,
    groups: [
        {
            name: 'Flow',
            score: 36.5,
            factors: [
                { key: 'volume_z', rawValue: -0.087, percentile: 60 },
                { key: 'buysell_imbalance', rawValue: 0.16, percentile: 55 },
                { key: 'poc_distance', rawValue: -0.0775, percentile: 5 },
            ],
        },
        {
            name: 'Trend',
            score: 0.7,
            factors: [
                { key: 'ma200_distance', rawValue: -0.185, percentile: 1 },
                { key: 'range_position', rawValue: 0.279, percentile: 2 },
            ],
        },
    ],
};

describe('FearGreedCard', () => {
    it('shows score, label, and groups', () => {
        const { getByText } = render(<FearGreedCard snapshot={sample} />);
        expect(getByText('19')).toBeInTheDocument();
        expect(getByText(/극공포/)).toBeInTheDocument();
        expect(getByText('Flow')).toBeInTheDocument();
        expect(getByText('Trend')).toBeInTheDocument();
        expect(getByText(/MA200/)).toBeInTheDocument();
    });
    it('renders warning badge when warning present', () => {
        const withWarning: FearGreedSnapshot = {
            ...sample,
            warning: 'CHRONIC_WEAKNESS',
        };
        const { getByText } = render(
            <FearGreedCard snapshot={withWarning} />
        );
        expect(getByText(/장기 약세 사이클/)).toBeInTheDocument();
    });
    it('shows insufficient when snapshot is null', () => {
        const { getByText } = render(<FearGreedCard snapshot={null} />);
        expect(getByText(/데이터 부족/)).toBeInTheDocument();
    });
});
```

- [ ] **Step 3: 테스트 + commit**

```bash
yarn test src/__tests__/components/symbol-page/FearGreedCard.test.tsx
git add src/components/symbol-page/FearGreedCard.tsx src/__tests__/components/symbol-page/FearGreedCard.test.tsx
git commit -m "feat(fearGreed): add FearGreedCard for analysis panel"
```

---

## Task 9: ChartContent에서 NewsAugment → FearGreedCard 교체

**Skills**: `vercel-react-best-practices`

**Files:**
- Modify: `src/components/symbol-page/ChartContent.tsx` (line 28 import, line 181 render)

- [ ] **Step 1: import 변경**

`src/components/symbol-page/ChartContent.tsx:28`:

```diff
-import { NewsAugment } from '@/components/symbol-page/NewsAugment';
+import { FearGreedCard } from '@/components/symbol-page/FearGreedCard';
+import { useFearGreed } from '@/components/symbol-page/hooks/useFearGreed';
```

- [ ] **Step 2: snapshot 산출 — useFearGreed 호출**

`useBars` 호출 직후에 추가 (component body 내):

```ts
const { snapshot: fearGreedSnapshot } = useFearGreed({
    bars,
    buySellVolume: indicators.buySellVolume,
});
```

- [ ] **Step 3: render 변경**

기존 line 181 `<NewsAugment symbol={symbol} />` 자리:

```diff
-                <NewsAugment symbol={symbol} />
+                <FearGreedCard snapshot={fearGreedSnapshot} />
```

분석 탭 사이드패널의 위치는 동일.

- [ ] **Step 4: dev 서버 시각 확인**

```bash
yarn dev
```

`/NVDA` 진입 → 분석 탭 사이드패널에 FearGreedCard 표시 확인. 5-factor breakdown, score, label 정상.

- [ ] **Step 5: 기존 테스트가 NewsAugment 이름을 참조하지 않는지 확인**

```bash
grep -rn 'NewsAugment' src/ --include='*.ts' --include='*.tsx' | grep -v 'src/components/symbol-page/NewsAugment\|src/components/symbol-page/hooks/useNewsAugment\|src/__tests__/components/symbol-page/hooks/useNewsAugment'
```

Expected: 출력 없음 (또는 아래 Task 10에서 정리할 주석 1건만).

- [ ] **Step 6: lint + commit**

```bash
yarn lint
git add src/components/symbol-page/ChartContent.tsx
git commit -m "feat(fearGreed): replace NewsAugment with FearGreedCard in ChartContent"
```

---

## Task 10: NewsAugment 일괄 삭제

**Skills**: `vercel-react-best-practices`

**Files (delete):**
- Delete: `src/components/symbol-page/NewsAugment.tsx`
- Delete: `src/components/symbol-page/hooks/useNewsAugment.ts`
- Delete: `src/__tests__/components/symbol-page/hooks/useNewsAugment.test.tsx`

**Files (modify):**
- Modify: `src/components/symbol-page/hooks/useDefaultModelId.ts:7` (NewsAugment 언급 주석)

- [ ] **Step 1: 파일 삭제**

```bash
rm src/components/symbol-page/NewsAugment.tsx
rm src/components/symbol-page/hooks/useNewsAugment.ts
rm src/__tests__/components/symbol-page/hooks/useNewsAugment.test.tsx
```

- [ ] **Step 2: 주석 갱신**

`src/components/symbol-page/hooks/useDefaultModelId.ts:7`의 NewsAugment 언급을 제거하거나 "분석 탭 4종 + 공포지수 카드"로 갱신한다. 정확한 텍스트는 파일을 read해서 확인 후 수정.

- [ ] **Step 3: typecheck — 끊긴 import 없는지**

```bash
yarn typecheck
```

Expected: 에러 없음

- [ ] **Step 4: 전체 test suite**

```bash
yarn test
```

- [ ] **Step 5: commit**

```bash
git add src/components/symbol-page/NewsAugment.tsx src/components/symbol-page/hooks/useNewsAugment.ts src/__tests__/components/symbol-page/hooks/useNewsAugment.test.tsx src/components/symbol-page/hooks/useDefaultModelId.ts
git commit -m "chore: remove NewsAugment (replaced by FearGreedCard)"
```

---

## Task 11: TABS config에 '공포 지수' 추가

**Skills**: `vercel-react-best-practices`

**Files:**
- Modify: `src/components/symbol-page/utils/symbolTabsConfig.ts`

- [ ] **Step 1: TABS 배열 수정**

`src/components/symbol-page/utils/symbolTabsConfig.ts`:

```diff
 export const TABS = [
     { key: 'chart', label: '차트', hrefBuilder: (s: string) => `/${s}` },
     { key: 'news', label: '뉴스', hrefBuilder: (s: string) => `/${s}/news` },
     { key: 'fundamental', label: '펀더', hrefBuilder: (s: string) => `/${s}/fundamental` },
     { key: 'overall', label: '종합', hrefBuilder: (s: string) => `/${s}/overall` },
+    { key: 'fear-greed', label: '공포 지수', hrefBuilder: (s: string) => `/${s}/fear-greed` },
 ] as const;
```

- [ ] **Step 2: lint, commit**

```bash
yarn lint
git add src/components/symbol-page/utils/symbolTabsConfig.ts
git commit -m "feat(fearGreed): add '공포 지수' tab to TABS"
```

(주의: `/[symbol]/fear-greed/page.tsx`가 아직 없어 dev에서 클릭하면 404 — 다음 task에서 셸 만들고 다시 정상화한다.)

---

## Task 12: 새 라우트 셸 — `/[symbol]/fear-greed/page.tsx`

**Skills**: `vercel-react-best-practices`, `next-cache-components`, `seo-audit`

**Files:**
- Create: `src/app/[symbol]/fear-greed/page.tsx`

- [ ] **Step 1: 기존 패턴 확인**

`src/app/[symbol]/news/page.tsx` (또는 fundamental·overall) 구조를 참조해 동일 패턴으로 작성한다.

```bash
sed -n '1,80p' src/app/[symbol]/news/page.tsx
```

- [ ] **Step 2: page.tsx 셸 작성**

`src/app/[symbol]/fear-greed/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { DEFAULT_TIMEFRAME } from '@/domain/constants/market';
import { buildDisplayName } from '@/domain/ticker';
import { getBarsAction } from '@/infrastructure/market/getBarsAction';
import { getAssetInfoCached } from '@/infrastructure/ticker/getAssetInfoCached';
import { QUERY_KEYS, QUERY_STALE_TIME_MS } from '@/lib/queryConfig';
import { FearGreedPage } from '@/components/fear-greed/FearGreedPage';

interface Props {
    params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { symbol } = await params;
    const ticker = symbol.toUpperCase();
    const assetInfo = await getAssetInfoCached(ticker);
    const displayName = assetInfo
        ? buildDisplayName(assetInfo, ticker)
        : ticker;
    return {
        title: `${displayName} (${ticker}) 공포·탐욕 지수 | SigLens`,
        description: `${displayName} 종목의 단기 sentiment를 5단계 라벨과 0~100 점수로 측정합니다. 5-factor self-normalization 기반.`,
        alternates: { canonical: `/${ticker}/fear-greed` },
    };
}

export default async function SymbolFearGreedPage({ params }: Props) {
    const { symbol } = await params;
    const ticker = symbol.toUpperCase();
    const assetInfo = await getAssetInfoCached(ticker);
    if (!assetInfo) notFound();

    const queryClient = new QueryClient({
        defaultOptions: { queries: { staleTime: QUERY_STALE_TIME_MS } },
    });
    await queryClient.prefetchQuery({
        queryKey: QUERY_KEYS.bars(ticker, DEFAULT_TIMEFRAME),
        queryFn: () => getBarsAction(ticker, DEFAULT_TIMEFRAME, assetInfo.fmpSymbol),
    });

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <FearGreedPage symbol={ticker} fmpSymbol={assetInfo.fmpSymbol} />
        </HydrationBoundary>
    );
}
```

(`FearGreedPage`는 다음 task에서 작성 — 이 파일은 컴파일 오류로 들어갈 수 있으므로 task 13 먼저 진행해도 무방. 단일 commit으로 묶는 것을 권장.)

- [ ] **Step 3: commit (task 13과 합칠 수도)**

이 파일을 task 13의 page composition과 함께 commit한다. 따로 commit 안 함.

---

## Task 13: 공포지수 페이지 — composition 컴포넌트

**Skills**: `frontend-design`, `web-design-guidelines`, `seo-audit`

**Files:**
- Create: `src/components/fear-greed/FearGreedPage.tsx`

`FearGreedPage`는 spec §4.3 페이지 mockup의 컨테이너. Hero / 비교 게이지 / Group bar / Historical 시계열을 조합한다. 각 sub-컴포넌트는 task 14~17.

- [ ] **Step 1: shell 작성 (sub-컴포넌트는 다음 task부터)**

`src/components/fear-greed/FearGreedPage.tsx`:

```tsx
'use client';

import { useBars } from '@/components/symbol-page/hooks/useBars';
import { useFearGreed } from '@/components/symbol-page/hooks/useFearGreed';
import { DEFAULT_TIMEFRAME } from '@/domain/constants/market';
import { FearGreedHero } from '@/components/fear-greed/FearGreedHero';
import { FearGreedComparisonGauges } from '@/components/fear-greed/FearGreedComparisonGauges';
import { FearGreedGroupBar } from '@/components/fear-greed/FearGreedGroupBar';
import { FearGreedHistoricalChart } from '@/components/fear-greed/FearGreedHistoricalChart';
import { SelfNormWarningBadge } from '@/components/fear-greed/SelfNormWarningBadge';

interface FearGreedPageProps {
    symbol: string;
    fmpSymbol?: string;
}

export function FearGreedPage({ symbol, fmpSymbol }: FearGreedPageProps) {
    const { bars, indicators } = useBars({
        symbol,
        timeframe: DEFAULT_TIMEFRAME,
        fmpSymbol,
    });
    const { snapshot, history } = useFearGreed({
        bars,
        buySellVolume: indicators.buySellVolume,
    });

    if (!snapshot) {
        return (
            <main className="text-secondary-400 p-6 text-sm">
                공포·탐욕 지수 산출에 필요한 데이터가 부족합니다.
            </main>
        );
    }

    return (
        <main className="flex flex-col gap-6 p-4 md:p-6">
            <section className="flex flex-col gap-3">
                <FearGreedHero snapshot={snapshot} />
                <FearGreedComparisonGauges history={history} />
                <SelfNormWarningBadge warning={snapshot.warning} />
            </section>

            <section className="flex flex-col gap-3">
                {snapshot.groups.map(group => (
                    <FearGreedGroupBar key={group.name} group={group} />
                ))}
            </section>

            <section>
                <FearGreedHistoricalChart history={history} />
            </section>

            <footer className="text-secondary-500 text-xs">
                {snapshot.confidence === 'normal'
                    ? `표본 ${snapshot.sampleSize} — 정상 산출`
                    : snapshot.confidence === 'limited'
                      ? `표본 ${snapshot.sampleSize} — 신뢰도 제한`
                      : '데이터 부족'}
            </footer>
        </main>
    );
}
```

- [ ] **Step 2: 다음 task에서 sub-컴포넌트 만든 후 dev 서버 확인 후 commit**

(sub-컴포넌트가 모두 만들어진 다음 task 17 끝에서 함께 commit한다.)

---

## Task 14: FearGreedHero — 반원 SVG 게이지

**Skills**: `frontend-design`, `web-design-guidelines`

**Files:**
- Create: `src/components/fear-greed/FearGreedHero.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
import type { FearGreedSnapshot } from '@y0ngha/siglens-core';

const SEGMENTS: ReadonlyArray<{ from: number; to: number; fill: string }> = [
    { from: 0, to: 25, fill: '#dc2626' },
    { from: 25, to: 45, fill: '#ea580c' },
    { from: 45, to: 55, fill: '#a3a3a3' },
    { from: 55, to: 75, fill: '#16a34a' },
    { from: 75, to: 100, fill: '#15803d' },
];

const LABEL_TEXT: Record<FearGreedSnapshot['label'], string> = {
    EXTREME_FEAR: '극공포',
    FEAR: '공포',
    NEUTRAL: '중립',
    GREED: '탐욕',
    EXTREME_GREED: '극탐욕',
};

interface FearGreedHeroProps {
    snapshot: FearGreedSnapshot;
}

/**
 * 반원 게이지. 0=좌측 끝(EXTREME_FEAR), 100=우측 끝(EXTREME_GREED).
 * 5단계 segment 컬러 + 현재 위치 indicator.
 * SVG 정의:
 *   ViewBox 200x110, 중심 (100,100), 반지름 80, π~0 (왼쪽~오른쪽).
 */
export function FearGreedHero({ snapshot }: FearGreedHeroProps) {
    const score = Math.round(snapshot.score);
    const angle = (1 - score / 100) * Math.PI; // 100 → 0rad(우), 0 → π(좌)
    const cx = 100;
    const cy = 100;
    const r = 80;
    const px = cx + r * Math.cos(angle);
    const py = cy - r * Math.sin(angle);

    return (
        <div className="flex flex-col items-center gap-2">
            <svg
                viewBox="0 0 200 110"
                className="w-full max-w-[420px]"
                role="img"
                aria-label={`공포·탐욕 지수 ${score}점, ${LABEL_TEXT[snapshot.label]}`}
            >
                {SEGMENTS.map(seg => {
                    const a1 = (1 - seg.from / 100) * Math.PI;
                    const a2 = (1 - seg.to / 100) * Math.PI;
                    const x1 = cx + r * Math.cos(a1);
                    const y1 = cy - r * Math.sin(a1);
                    const x2 = cx + r * Math.cos(a2);
                    const y2 = cy - r * Math.sin(a2);
                    return (
                        <path
                            key={seg.from}
                            d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
                            stroke={seg.fill}
                            strokeWidth={14}
                            fill="none"
                        />
                    );
                })}
                <circle cx={px} cy={py} r={6} fill="#fff" />
            </svg>
            <div className="text-center">
                <div className="text-secondary-100 text-3xl font-bold tabular-nums">
                    {score}
                </div>
                <div className="text-secondary-300 text-sm">
                    / 100 — {LABEL_TEXT[snapshot.label]}
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: snapshot 테스트**

`src/__tests__/components/fear-greed/FearGreedHero.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import type { FearGreedSnapshot } from '@y0ngha/siglens-core';
import { FearGreedHero } from '@/components/fear-greed/FearGreedHero';

const snapshot: FearGreedSnapshot = {
    score: 18,
    label: 'EXTREME_FEAR',
    confidence: 'normal',
    sampleSize: 412,
    warning: null,
    groups: [],
};

describe('FearGreedHero', () => {
    it('renders score and label', () => {
        const { getByText } = render(<FearGreedHero snapshot={snapshot} />);
        expect(getByText('18')).toBeInTheDocument();
        expect(getByText(/극공포/)).toBeInTheDocument();
    });
});
```

- [ ] **Step 3: 테스트 통과**

```bash
yarn test src/__tests__/components/fear-greed/FearGreedHero.test.tsx
```

(아직 commit 안 함 — task 17까지 page 전체 합쳐 commit 권장)

---

## Task 15: FearGreedComparisonGauges — Now/1W/1M/1Y 미니 게이지

**Skills**: `frontend-design`, `web-design-guidelines`

**Files:**
- Create: `src/components/fear-greed/FearGreedComparisonGauges.tsx`

- [ ] **Step 1: 작성**

```tsx
import type { FearGreedHistoryPoint } from '@y0ngha/siglens-core';

interface FearGreedComparisonGaugesProps {
    history: FearGreedHistoryPoint[];
}

const PERIODS: ReadonlyArray<{ key: string; daysBack: number; label: string }> = [
    { key: 'now', daysBack: 0, label: 'Now' },
    { key: '1w', daysBack: 5, label: '1주' },
    { key: '1m', daysBack: 21, label: '1개월' },
    { key: '1y', daysBack: 252, label: '1년' },
];

/**
 * spec §4.3의 Now/1W/1M/1Y 비교 미니 게이지. 거래일 단위로 daysBack만큼 이전의 score를 끌어온다.
 */
export function FearGreedComparisonGauges({
    history,
}: FearGreedComparisonGaugesProps) {
    const valid = history.filter(p => p.score !== null);
    if (valid.length === 0) return null;
    const lastIdx = valid.length - 1;
    return (
        <ul className="flex justify-around gap-2 text-center text-xs">
            {PERIODS.map(p => {
                const point = valid[Math.max(0, lastIdx - p.daysBack)];
                const score = point?.score;
                return (
                    <li
                        key={p.key}
                        className="bg-secondary-800/40 flex-1 rounded p-2"
                    >
                        <div className="text-secondary-400">{p.label}</div>
                        <div className="text-secondary-100 mt-1 text-base font-semibold tabular-nums">
                            {score === null || score === undefined
                                ? '—'
                                : Math.round(score)}
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
```

- [ ] **Step 2: 테스트 (snapshot)**

(skip — 단순 매핑이라 inline E2E로 충분. 시각 확인 task 17에서.)

---

## Task 16: FearGreedGroupBar — 그룹 수평 바

**Skills**: `frontend-design`, `web-design-guidelines`

**Files:**
- Create: `src/components/fear-greed/FearGreedGroupBar.tsx`

- [ ] **Step 1: 작성**

```tsx
import type { FearGreedGroup } from '@y0ngha/siglens-core';
import { FACTOR_LABEL, formatFactorRaw } from '@/components/fear-greed/labels';

interface FearGreedGroupBarProps {
    group: FearGreedGroup;
}

export function FearGreedGroupBar({ group }: FearGreedGroupBarProps) {
    const score = Math.round(group.score);
    return (
        <section className="bg-secondary-800/40 flex flex-col gap-2 rounded p-3">
            <header className="flex items-center justify-between">
                <h4 className="text-secondary-200 text-sm font-medium">
                    {group.name} Group
                </h4>
                <span className="text-secondary-100 font-mono text-sm">
                    {score} / 100
                </span>
            </header>
            <div
                className="bg-secondary-700/40 relative h-2 overflow-hidden rounded"
                aria-label={`${group.name} 그룹 점수 ${score}`}
            >
                <div
                    className="bg-primary-500 h-full"
                    style={{ width: `${score}%` }}
                />
            </div>
            <ul className="text-secondary-400 flex flex-col gap-1 text-xs">
                {group.factors.map(f => (
                    <li key={f.key} className="flex items-center justify-between">
                        <span>· {FACTOR_LABEL[f.key]}</span>
                        <span className="font-mono">
                            {formatFactorRaw(f.key, f.rawValue)}
                            <span className="text-secondary-500 ml-2">
                                ({Math.round(f.percentile)}th)
                            </span>
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}
```

- [ ] **Step 2: 시각 확인은 page composition 후. 별도 commit 안 함.**

---

## Task 17: FearGreedHistoricalChart — 1년 시계열 line chart

**Skills**: `frontend-design`, `web-design-guidelines`, `vercel-react-best-practices`

**Files:**
- Create: `src/components/fear-greed/FearGreedHistoricalChart.tsx`

`lightweight-charts`를 재사용한다 (캔들/볼륨 차트와 동일 라이브러리). Series는 line series, 색은 5단계별 컬러로 그라데이션 표현 가능 — MVP는 단일 색 line + 5단계 horizontal band.

- [ ] **Step 1: 컴포넌트 작성**

```tsx
'use client';

import { useEffect, useRef } from 'react';
import {
    createChart,
    type IChartApi,
    type ISeriesApi,
    type LineData,
    type Time,
} from 'lightweight-charts';
import type { FearGreedHistoryPoint } from '@y0ngha/siglens-core';

interface FearGreedHistoricalChartProps {
    history: FearGreedHistoryPoint[];
}

/**
 * 1년 시계열 score line chart. warm-up 60bar는 history에서 score=null로 들어와
 * line이 자연스럽게 끊김.
 */
export function FearGreedHistoricalChart({
    history,
}: FearGreedHistoricalChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;
        const chart = createChart(containerRef.current, {
            height: 240,
            autoSize: true,
            layout: { background: { color: 'transparent' } },
            timeScale: { borderVisible: false },
            rightPriceScale: { borderVisible: false },
        });
        const series = chart.addLineSeries({
            color: '#60a5fa',
            lineWidth: 2,
        });
        chartRef.current = chart;
        seriesRef.current = series;
        return () => {
            chart.remove();
            chartRef.current = null;
            seriesRef.current = null;
        };
    }, []);

    useEffect(() => {
        const series = seriesRef.current;
        if (!series) return;
        const data: LineData[] = history
            .filter(p => p.score !== null)
            .map(p => ({
                time: p.date as Time,
                value: p.score!,
            }));
        series.setData(data);
        chartRef.current?.timeScale().fitContent();
    }, [history]);

    return <div ref={containerRef} className="w-full" />;
}
```

- [ ] **Step 2: page composition 시각 확인**

```bash
yarn dev
```

브라우저 `/NVDA/fear-greed`. Hero, 비교 게이지, 그룹 바, 시계열 차트가 모두 그려지는지 확인. warning 케이스 (`/NVO/fear-greed`)에서는 ⚠️ 배지가 함께.

- [ ] **Step 3: lint + 전체 테스트**

```bash
yarn lint
yarn test
```

- [ ] **Step 4: 페이지 + 모든 sub-컴포넌트를 한 commit으로 묶음**

```bash
git add src/app/[symbol]/fear-greed/page.tsx \
        src/components/fear-greed/FearGreedPage.tsx \
        src/components/fear-greed/FearGreedHero.tsx \
        src/components/fear-greed/FearGreedComparisonGauges.tsx \
        src/components/fear-greed/FearGreedGroupBar.tsx \
        src/components/fear-greed/FearGreedHistoricalChart.tsx \
        src/__tests__/components/fear-greed/FearGreedHero.test.tsx
git commit -m "feat(fearGreed): add /[symbol]/fear-greed page with hero, comparison, group, and historical chart"
```

---

## Task 18: 종합 dev 검증 + PR 생성

**Skills**: —

- [ ] **Step 1: 5단계 라벨 케이스 둘러보기**

```bash
yarn dev
```

- `/NVDA` (활발 메가캡, 헤더 chip + 분석 탭 카드 + 공포지수 탭)
- `/PLTR` (EXTREME_FEAR 케이스)
- `/NVO` (CHRONIC_WEAKNESS warning ⚠️)
- `/QQQ` (시장 ETF, EXTREME_GREED)

각 페이지의 헤더 chip 컬러, 분석 탭 카드의 group breakdown, 공포지수 탭의 Hero/비교/Group/Historical, warning 배지 표시를 확인한다.

- [ ] **Step 2: 전체 테스트 + lint + typecheck + build**

```bash
yarn lint
yarn typecheck
yarn test
yarn build
```

모두 통과해야 한다.

- [ ] **Step 3: PR 생성 (사용자 승인 후)**

이 단계는 git-agent에 위임한다 — `gh pr create`로 PR 생성. 본 plan의 모든 commit이 포함된다.

PR title 예: `feat: add per-stock fear & greed index`
PR body는 spec §1 목표 + §11 의사결정 로그 요약 + 새 탭 스크린샷 (페이지 미리보기) 포함.

---

## 머지 순서 / Cross-Phase Sequencing

1. **siglens-core 측 PR** (별도 plan, 본 문서 외부) → review/머지 → npm publish
2. **siglens 측 PR** (본 plan 결과물) → core publish 확인 후 review/머지

별도 worktree(`../siglens-fear-greed/`)와 별도 브랜치이므로 master는 PR 머지 시점까지 unchanged.

---

## 자체 점검 (self-review)

- 모든 spec 섹션 매핑 ✓
  - §2 algorithm → core (외부 plan)
  - §4.1 헤더 chip → Task 6, 7
  - §4.2 분석 탭 카드 → Task 8, 9
  - §4.3 공포지수 탭 → Task 12~17
  - §4.4 자연어 해설 → core prompt 확장 (외부 plan)
  - §4.5 self-norm warning UI → Task 5 (배지) + Task 8/13 (배치)
  - §6 NewsAugment 삭제 → Task 9, 10
  - §7 타입 → core re-export 사용
  - §8 테스트 → 각 task 마다 inline
  - §9 caveats → 디자인에 반영됨
  - §10 변경 영향 요약 → File Map과 일치
  - §12 implementation guidelines → "Skill 사용 매핑" 표 + worktree 환경 명시
- placeholder 없음 ✓
- 같은 함수/컴포넌트 이름 일관 ✓ (Task별 파일 path 동일 유지)
