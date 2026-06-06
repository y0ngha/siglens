# 보조지표 설정 모달 재설계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 차트 좌상단의 평평한 `IndicatorToolbar`를 우상단 톱니바퀴 → 카테고리별 체크박스 모달(`IndicatorSettingsModal`)로 재설계하고, 지표를 선언적 레지스트리로 정의해 향후 23개 지표를 한 줄 추가로 수용 가능하게 만든다.

**Architecture:** 레지스트리 중심(스펙 B안). 지표 메타데이터를 `model/indicatorRegistry.ts`에 선언하고, `StockChart`가 기존 11개 훅의 `visible/toggle` 결과를 메타와 합쳐 `IndicatorBinding[]` 하나로 조립해 모달에 전달한다. 모달은 binding 배열을 카테고리별로 그룹핑해 렌더한다. 기존 11개 지표 훅과 `useIndicatorVisibility`(paneIndex 동적 배정)는 **불변** — 회귀 위험 0.

**Tech Stack:** Next.js 16 / React 19 (`'use client'`), lightweight-charts 5.1.0, `shared/hooks/useDialog`(focus trap·Esc·click-outside 제공), Tailwind v4, vitest + React Testing Library, Playwright(E2E).

**작업 위치:** 워크트리 `/Users/y0ngha/Project/siglens-indicator-modal`, 브랜치 `feat/indicator-settings-modal`. 스펙: `docs/superpowers/specs/2026-06-06-indicator-settings-modal-design.md`.

**커밋 규칙:** 이 레포는 커밋을 `git-agent`에 위임한다(CLAUDE.md). 각 Task 끝의 commit 스텝은 git-agent에게 위임해 수행한다(직접 `git commit` 금지). `--no-verify` 금지.

**모달 대상 11개 지표 (카테고리):**
- 추세(trend): `ma`, `ema`(period 칩), `ichimoku`(overlay)
- 모멘텀(momentum): `rsi`, `macd`, `dmi`, `stochastic`, `stochRsi`, `cci`(pane)
- 변동성(volatility): `bollinger`(overlay)
- 볼륨(volume): `volumeProfile`(overlay)
- SMC: 없음 → 그룹 자동 숨김

**UI 결정:** MA/EMA(`hasPeriods`)는 훅이 `togglePeriod`만 제공하므로 모달에서 **체크박스 없이 period 칩만** 렌더(칩 클릭 = `onTogglePeriod`). 나머지 9개는 체크박스(클릭 = `onToggle`). 칩 색은 `getPeriodColor(period)` 재사용.

---

## File Structure

**신규**
- `src/widgets/chart/model/indicatorRegistry.ts` — 타입(`IndicatorMeta`·`IndicatorBinding`·`IndicatorCategory`·`IndicatorKind`·`IndicatorCategoryGroup`) + 레지스트리 상수 + `INDICATOR_META` 맵 + `groupBindingsByCategory` 순수 헬퍼
- `src/widgets/chart/ui/IndicatorSettingsModal.tsx` — 톱니바퀴 트리거 + 모달(카테고리 섹션 / 체크박스 / period 칩)
- `src/widgets/chart/__tests__/model/indicatorRegistry.test.ts`
- `src/widgets/chart/__tests__/ui/IndicatorSettingsModal.test.tsx`
- `e2e/specs/chart-indicators.spec.ts`

**수정**
- `src/widgets/chart/StockChart.tsx` — `IndicatorBinding[]` 조립(useMemo), `IndicatorToolbar` → `IndicatorSettingsModal` 교체, 톱니바퀴를 `top-2 right-2`에 배치
- `src/widgets/chart/__tests__/StockChart.test.tsx` — toolbar mock → modal mock 갱신

**삭제**
- `src/widgets/chart/IndicatorToolbar.tsx`
- `src/widgets/chart/hooks/useIndicatorDropdown.ts`
- `src/widgets/chart/__tests__/IndicatorToolbar.test.tsx`
- `src/widgets/chart/__tests__/hooks/useIndicatorDropdown.test.tsx` (존재 시)

**불변**
- `hooks/useIndicatorVisibility.ts`, 11개 지표 훅, `shared/lib/chartColors.ts`, `OverlayLegend.tsx`, `VolumeChart.tsx`

---

## Task 0: 워크트리 node_modules 준비

워크트리에는 node_modules가 없어 테스트/lint가 안 돈다. 메모리 규칙: **symlink 금지**(Turbopack 거부 + dual-React 실패), `cp -al` 하드링크 사용.

- [ ] **Step 1: 하드링크로 node_modules 복제**

Run:
```bash
cp -al /Users/y0ngha/Project/siglens/node_modules /Users/y0ngha/Project/siglens-indicator-modal/node_modules
rm -rf /Users/y0ngha/Project/siglens-indicator-modal/node_modules/node_modules
```
Expected: 에러 없이 완료.

- [ ] **Step 2: 테스트 러너 동작 확인**

Run:
```bash
cd /Users/y0ngha/Project/siglens-indicator-modal && yarn test src/widgets/chart/__tests__/StockChart.test.tsx 2>&1 | tail -15
```
Expected: 기존 StockChart 테스트가 PASS(러너 정상 동작 확인용). 실패 시 node_modules 복제 재점검.

---

## Task 1: 레지스트리 + 타입 + 그룹핑 헬퍼

**Files:**
- Create: `src/widgets/chart/model/indicatorRegistry.ts`
- Test: `src/widgets/chart/__tests__/model/indicatorRegistry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/widgets/chart/__tests__/model/indicatorRegistry.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
    INDICATOR_REGISTRY,
    INDICATOR_META,
    CATEGORY_ORDER,
    CATEGORY_LABELS,
    groupBindingsByCategory,
    type IndicatorBinding,
} from '../../model/indicatorRegistry';

function bindingFor(key: string, active = false): IndicatorBinding {
    return { meta: INDICATOR_META[key]!, active };
}

describe('indicatorRegistry', () => {
    it('registers exactly the 11 modal-target indicators', () => {
        expect(INDICATOR_REGISTRY).toHaveLength(11);
    });

    it('has no duplicate keys', () => {
        const keys = INDICATOR_REGISTRY.map(m => m.key);
        expect(new Set(keys).size).toBe(keys.length);
    });

    it('every meta belongs to a known category', () => {
        for (const meta of INDICATOR_REGISTRY) {
            expect(CATEGORY_ORDER).toContain(meta.category);
        }
    });

    it('only ma/ema carry hasPeriods', () => {
        const periodKeys = INDICATOR_REGISTRY.filter(m => m.hasPeriods).map(
            m => m.key
        );
        expect(periodKeys.sort()).toEqual(['ema', 'ma']);
    });

    it('INDICATOR_META maps every key back to its meta', () => {
        for (const meta of INDICATOR_REGISTRY) {
            expect(INDICATOR_META[meta.key]).toBe(meta);
        }
    });

    it('every category has a label', () => {
        for (const category of CATEGORY_ORDER) {
            expect(CATEGORY_LABELS[category]).toBeTruthy();
        }
    });
});

describe('groupBindingsByCategory', () => {
    it('groups bindings under their category in CATEGORY_ORDER order', () => {
        const groups = groupBindingsByCategory([
            bindingFor('rsi'),
            bindingFor('ma'),
            bindingFor('bollinger'),
        ]);
        expect(groups.map(g => g.category)).toEqual([
            'trend',
            'momentum',
            'volatility',
        ]);
    });

    it('omits categories with zero bindings (SMC hidden)', () => {
        const groups = groupBindingsByCategory([bindingFor('rsi')]);
        expect(groups).toHaveLength(1);
        expect(groups[0]!.category).toBe('momentum');
        expect(groups.some(g => g.category === 'smc')).toBe(false);
    });

    it('returns empty array when no bindings (worst case)', () => {
        expect(groupBindingsByCategory([])).toEqual([]);
    });

    it('keeps multiple items within the same category', () => {
        const groups = groupBindingsByCategory([
            bindingFor('rsi'),
            bindingFor('macd'),
            bindingFor('cci'),
        ]);
        expect(groups).toHaveLength(1);
        expect(groups[0]!.items).toHaveLength(3);
    });

    it('carries the category label on each group', () => {
        const groups = groupBindingsByCategory([bindingFor('ma')]);
        expect(groups[0]!.label).toBe(CATEGORY_LABELS.trend);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/y0ngha/Project/siglens-indicator-modal && yarn test src/widgets/chart/__tests__/model/indicatorRegistry.test.ts`
Expected: FAIL — `Cannot find module '../../model/indicatorRegistry'`.

- [ ] **Step 3: Write the implementation**

Create `src/widgets/chart/model/indicatorRegistry.ts`:
```ts
/**
 * 차트 보조지표 레지스트리 — 모달 렌더링과 차트 binding 조립의 단일 출처.
 *
 * 새 지표 추가 = INDICATOR_REGISTRY에 한 줄. kind는 차트 렌더 훅 분기/문서화용이며
 * 모달 UI는 kind에 무관하다(체크박스 + 선택적 period 칩으로만 다룸). 따라서 향후
 * 'candle-paint'(elderImpulse)·'zone'(smc) 같은 kind나 'statistical' 카테고리가
 * 추가돼도 IndicatorSettingsModal은 무수정이다. (스펙 §3.1 참조)
 */

export type IndicatorCategory =
    | 'trend'
    | 'momentum'
    | 'volatility'
    | 'volume'
    | 'smc';

export type IndicatorKind = 'overlay' | 'pane';

export interface IndicatorMeta {
    key: string;
    label: string;
    category: IndicatorCategory;
    kind: IndicatorKind;
    /** MA/EMA처럼 다중 period 선택을 가지는 지표만 true. */
    hasPeriods?: boolean;
}

/**
 * 차트가 한 지표를 렌더/토글하는 데 필요한 모든 것 — 정적 메타 + 동적 상태/콜백.
 * 단순 토글 지표는 onToggle만, period 지표(ma/ema)는 period 관련 필드만 채운다.
 */
export interface IndicatorBinding {
    meta: IndicatorMeta;
    active: boolean;
    onToggle?: () => void;
    availablePeriods?: readonly number[];
    visiblePeriods?: number[];
    onTogglePeriod?: (period: number) => void;
}

export interface IndicatorCategoryGroup {
    category: IndicatorCategory;
    label: string;
    items: IndicatorBinding[];
}

export const CATEGORY_ORDER: readonly IndicatorCategory[] = [
    'trend',
    'momentum',
    'volatility',
    'volume',
    'smc',
];

export const CATEGORY_LABELS: Record<IndicatorCategory, string> = {
    trend: '추세',
    momentum: '모멘텀',
    volatility: '변동성',
    volume: '볼륨',
    smc: 'SMC',
};

export const INDICATOR_REGISTRY: readonly IndicatorMeta[] = [
    { key: 'ma', label: 'MA', category: 'trend', kind: 'overlay', hasPeriods: true },
    { key: 'ema', label: 'EMA', category: 'trend', kind: 'overlay', hasPeriods: true },
    { key: 'ichimoku', label: 'Ichimoku', category: 'trend', kind: 'overlay' },
    { key: 'rsi', label: 'RSI', category: 'momentum', kind: 'pane' },
    { key: 'macd', label: 'MACD', category: 'momentum', kind: 'pane' },
    { key: 'dmi', label: 'DMI', category: 'momentum', kind: 'pane' },
    { key: 'stochastic', label: 'Stoch', category: 'momentum', kind: 'pane' },
    { key: 'stochRsi', label: 'StochRSI', category: 'momentum', kind: 'pane' },
    { key: 'cci', label: 'CCI', category: 'momentum', kind: 'pane' },
    { key: 'bollinger', label: 'BB', category: 'volatility', kind: 'overlay' },
    { key: 'volumeProfile', label: 'VP', category: 'volume', kind: 'overlay' },
];

/** key → meta 조회 맵. StockChart binding 조립에서 사용. */
export const INDICATOR_META: Record<string, IndicatorMeta> =
    Object.fromEntries(INDICATOR_REGISTRY.map(meta => [meta.key, meta]));

/**
 * binding을 카테고리별로 묶되 CATEGORY_ORDER 순서를 유지하고,
 * 항목이 0개인 카테고리(예: SMC)는 제외한다.
 */
export function groupBindingsByCategory(
    bindings: IndicatorBinding[]
): IndicatorCategoryGroup[] {
    return CATEGORY_ORDER.map(category => ({
        category,
        label: CATEGORY_LABELS[category],
        items: bindings.filter(b => b.meta.category === category),
    })).filter(group => group.items.length > 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/y0ngha/Project/siglens-indicator-modal && yarn test src/widgets/chart/__tests__/model/indicatorRegistry.test.ts`
Expected: PASS (all 11 tests).

- [ ] **Step 5: Commit (git-agent 위임)**

git-agent에게 위임:
```
add src/widgets/chart/model/indicatorRegistry.ts and its test.
commit message: "feat(chart): add indicator registry and category grouping"
```

---

## Task 2: IndicatorSettingsModal 컴포넌트

**Files:**
- Create: `src/widgets/chart/ui/IndicatorSettingsModal.tsx`
- Test: `src/widgets/chart/__tests__/ui/IndicatorSettingsModal.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/widgets/chart/__tests__/ui/IndicatorSettingsModal.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/hooks/useDialog', () => ({
    useDialog: vi.fn(() => ({
        isOpen: false,
        open: vi.fn(),
        close: vi.fn(),
        dialogRef: { current: null },
        triggerRef: { current: null },
    })),
}));
vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) =>
        args
            .flat()
            .filter(a => typeof a === 'string' && a.length > 0)
            .join(' '),
}));
vi.mock('@/shared/lib/chartColors', () => ({
    getPeriodColor: () => '#abcdef',
}));

import { render, screen, fireEvent } from '@testing-library/react';
import { useDialog } from '@/shared/hooks/useDialog';
import { IndicatorSettingsModal } from '../../ui/IndicatorSettingsModal';
import {
    INDICATOR_META,
    type IndicatorBinding,
} from '../../model/indicatorRegistry';

function openDialog() {
    vi.mocked(useDialog).mockReturnValue({
        isOpen: true,
        open: vi.fn(),
        close: vi.fn(),
        dialogRef: { current: null },
        triggerRef: { current: null },
    });
}

const rsiBinding = (over: Partial<IndicatorBinding> = {}): IndicatorBinding => ({
    meta: INDICATOR_META.rsi!,
    active: false,
    onToggle: vi.fn(),
    ...over,
});

const maBinding = (over: Partial<IndicatorBinding> = {}): IndicatorBinding => ({
    meta: INDICATOR_META.ma!,
    active: false,
    availablePeriods: [20, 60],
    visiblePeriods: [],
    onTogglePeriod: vi.fn(),
    ...over,
});

describe('IndicatorSettingsModal', () => {
    beforeEach(() => {
        vi.mocked(useDialog).mockReturnValue({
            isOpen: false,
            open: vi.fn(),
            close: vi.fn(),
            dialogRef: { current: null },
            triggerRef: { current: null },
        });
    });

    it('renders the gear trigger button', () => {
        render(<IndicatorSettingsModal bindings={[rsiBinding()]} />);
        expect(
            screen.getByRole('button', { name: '보조지표 설정' })
        ).toBeInTheDocument();
    });

    it('does not render the dialog when closed', () => {
        render(<IndicatorSettingsModal bindings={[rsiBinding()]} />);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('calls open when the gear trigger is clicked', () => {
        const open = vi.fn();
        vi.mocked(useDialog).mockReturnValue({
            isOpen: false,
            open,
            close: vi.fn(),
            dialogRef: { current: null },
            triggerRef: { current: null },
        });
        render(<IndicatorSettingsModal bindings={[rsiBinding()]} />);
        fireEvent.click(screen.getByRole('button', { name: '보조지표 설정' }));
        expect(open).toHaveBeenCalledTimes(1);
    });

    it('renders category headings only for non-empty categories', () => {
        openDialog();
        render(
            <IndicatorSettingsModal
                bindings={[rsiBinding(), maBinding()]}
            />
        );
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('추세')).toBeInTheDocument();
        expect(screen.getByText('모멘텀')).toBeInTheDocument();
        // 빈 카테고리는 숨김
        expect(screen.queryByText('변동성')).not.toBeInTheDocument();
        expect(screen.queryByText('SMC')).not.toBeInTheDocument();
    });

    it('renders a checkbox for non-period indicators and calls onToggle', () => {
        openDialog();
        const onToggle = vi.fn();
        render(
            <IndicatorSettingsModal bindings={[rsiBinding({ onToggle })]} />
        );
        const checkbox = screen.getByRole('checkbox', { name: /RSI/ });
        expect(checkbox).not.toBeChecked();
        fireEvent.click(checkbox);
        expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('reflects active state on the checkbox', () => {
        openDialog();
        render(
            <IndicatorSettingsModal
                bindings={[rsiBinding({ active: true })]}
            />
        );
        expect(screen.getByRole('checkbox', { name: /RSI/ })).toBeChecked();
    });

    it('renders period chips (not a checkbox) for ma/ema and toggles a period', () => {
        openDialog();
        const onTogglePeriod = vi.fn();
        render(
            <IndicatorSettingsModal
                bindings={[
                    maBinding({ visiblePeriods: [20], onTogglePeriod }),
                ]}
            />
        );
        // period 지표는 체크박스가 없다
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
        const chip20 = screen.getByRole('button', { name: /20/ });
        const chip60 = screen.getByRole('button', { name: /60/ });
        expect(chip20).toHaveAttribute('aria-pressed', 'true');
        expect(chip60).toHaveAttribute('aria-pressed', 'false');
        fireEvent.click(chip60);
        expect(onTogglePeriod).toHaveBeenCalledWith(60);
    });

    it('calls close when the close button is clicked', () => {
        const close = vi.fn();
        vi.mocked(useDialog).mockReturnValue({
            isOpen: true,
            open: vi.fn(),
            close,
            dialogRef: { current: null },
            triggerRef: { current: null },
        });
        render(<IndicatorSettingsModal bindings={[rsiBinding()]} />);
        fireEvent.click(screen.getByRole('button', { name: '닫기' }));
        expect(close).toHaveBeenCalledTimes(1);
    });

    it('renders an empty dialog body without crashing when bindings is empty (worst case)', () => {
        openDialog();
        render(<IndicatorSettingsModal bindings={[]} />);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('handles a period indicator with no available periods (worst case)', () => {
        openDialog();
        render(
            <IndicatorSettingsModal
                bindings={[
                    maBinding({ availablePeriods: [], visiblePeriods: [] }),
                ]}
            />
        );
        expect(screen.getByText('MA')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /20/ })).not.toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/y0ngha/Project/siglens-indicator-modal && yarn test src/widgets/chart/__tests__/ui/IndicatorSettingsModal.test.tsx`
Expected: FAIL — `Cannot find module '../../ui/IndicatorSettingsModal'`.

- [ ] **Step 3: Write the implementation**

Create `src/widgets/chart/ui/IndicatorSettingsModal.tsx`:
```tsx
'use client';

import type { CSSProperties } from 'react';
import { useDialog } from '@/shared/hooks/useDialog';
import { cn } from '@/shared/lib/cn';
import { getPeriodColor } from '@/shared/lib/chartColors';
import {
    groupBindingsByCategory,
    type IndicatorBinding,
} from '../model/indicatorRegistry';

interface IndicatorSettingsModalProps {
    bindings: IndicatorBinding[];
}

const ROW_CLASS =
    'flex items-center gap-2 rounded px-2 py-1.5 text-sm text-secondary-200';

function GearIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
        >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
        </svg>
    );
}

function PeriodChips({ binding }: { binding: IndicatorBinding }) {
    const {
        availablePeriods = [],
        visiblePeriods = [],
        onTogglePeriod,
    } = binding;

    return (
        <div className="flex flex-wrap gap-1">
            {availablePeriods.map(period => {
                const selected = visiblePeriods.includes(period);
                return (
                    <button
                        key={period}
                        type="button"
                        onClick={() => onTogglePeriod?.(period)}
                        aria-pressed={selected}
                        className={cn(
                            'focus-visible:ring-primary-500 flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors focus-visible:ring-1 focus-visible:outline-none',
                            selected
                                ? 'bg-secondary-700 text-white'
                                : 'text-secondary-400 hover:bg-secondary-700 hover:text-white'
                        )}
                    >
                        <span
                            className="h-2 w-2 shrink-0 rounded-full bg-[var(--chip-color)]"
                            style={
                                {
                                    '--chip-color': getPeriodColor(period),
                                } as CSSProperties
                            }
                        />
                        {period}
                    </button>
                );
            })}
        </div>
    );
}

function PeriodRow({ binding }: { binding: IndicatorBinding }) {
    return (
        <div className={ROW_CLASS}>
            <span
                className={cn(
                    'w-16 shrink-0 font-medium',
                    binding.active ? 'text-white' : 'text-secondary-400'
                )}
            >
                {binding.meta.label}
            </span>
            <PeriodChips binding={binding} />
        </div>
    );
}

function ToggleRow({ binding }: { binding: IndicatorBinding }) {
    return (
        <label className={cn(ROW_CLASS, 'cursor-pointer')}>
            <input
                type="checkbox"
                checked={binding.active}
                onChange={binding.onToggle}
                className="accent-primary-500 h-4 w-4"
            />
            <span>{binding.meta.label}</span>
        </label>
    );
}

export function IndicatorSettingsModal({
    bindings,
}: IndicatorSettingsModalProps) {
    const { isOpen, open, close, dialogRef, triggerRef } = useDialog();
    const groups = groupBindingsByCategory(bindings);

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={open}
                aria-label="보조지표 설정"
                aria-haspopup="dialog"
                className="bg-secondary-800/80 text-secondary-400 hover:bg-secondary-700 focus-visible:ring-primary-500 flex h-8 w-8 items-center justify-center rounded transition-colors hover:text-white focus-visible:ring-1 focus-visible:outline-none"
            >
                <GearIcon />
            </button>

            {isOpen && (
                <div
                    className="bg-secondary-950/80 fixed inset-0 z-50 flex items-center justify-center overscroll-contain p-4 backdrop-blur-sm"
                    role="presentation"
                >
                    <div
                        ref={dialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="indicator-settings-title"
                        tabIndex={-1}
                        className="border-secondary-700 bg-secondary-800 max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-xl border text-left shadow-2xl outline-none"
                    >
                        <div className="border-secondary-700 flex items-start justify-between border-b px-5 py-4">
                            <h2
                                id="indicator-settings-title"
                                className="text-secondary-100 text-base font-semibold"
                            >
                                보조지표 설정
                            </h2>
                            <button
                                type="button"
                                onClick={close}
                                aria-label="닫기"
                                className="text-secondary-500 hover:text-secondary-300 focus-visible:ring-primary-500 -mt-1 -mr-1 rounded p-1 transition-colors focus-visible:ring-1 focus-visible:outline-none"
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <div className="flex flex-col gap-4 p-5">
                            {groups.map(group => (
                                <section key={group.category}>
                                    <h3 className="text-secondary-500 mb-1 text-xs font-semibold tracking-wide uppercase">
                                        {group.label}
                                    </h3>
                                    <div className="flex flex-col gap-0.5">
                                        {group.items.map(binding =>
                                            binding.meta.hasPeriods ? (
                                                <PeriodRow
                                                    key={binding.meta.key}
                                                    binding={binding}
                                                />
                                            ) : (
                                                <ToggleRow
                                                    key={binding.meta.key}
                                                    binding={binding}
                                                />
                                            )
                                        )}
                                    </div>
                                </section>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/y0ngha/Project/siglens-indicator-modal && yarn test src/widgets/chart/__tests__/ui/IndicatorSettingsModal.test.tsx`
Expected: PASS (all tests).

- [ ] **Step 5: Commit (git-agent 위임)**

git-agent에게 위임:
```
add src/widgets/chart/ui/IndicatorSettingsModal.tsx and its test.
commit message: "feat(chart): add IndicatorSettingsModal with category groups and period chips"
```

---

## Task 3: StockChart 통합 (binding 조립 + 모달 교체)

**Files:**
- Modify: `src/widgets/chart/StockChart.tsx`
- Modify: `src/widgets/chart/__tests__/StockChart.test.tsx`

- [ ] **Step 1: StockChart.test.tsx의 IndicatorToolbar mock을 모달 mock으로 갱신**

기존 `StockChart.test.tsx`에서 `IndicatorToolbar`를 mock하는 블록을 찾아(없으면 모듈 mock 추가) 다음으로 교체. 모달이 bindings를 받는지 검증하는 spy mock으로 둔다:
```tsx
// StockChart는 IndicatorSettingsModal로 11개 binding을 전달한다.
vi.mock('@/widgets/chart/ui/IndicatorSettingsModal', () => ({
    IndicatorSettingsModal: ({ bindings }: { bindings: unknown[] }) => (
        <div data-testid="indicator-settings-modal" data-count={bindings.length} />
    ),
}));
```
그리고 기존 `vi.mock('../IndicatorToolbar' ...)` 또는 `'@/widgets/chart/IndicatorToolbar'` mock이 있으면 제거한다.

- [ ] **Step 2: StockChart가 11개 binding을 모달에 넘기는지 검증하는 테스트 추가**

`StockChart.test.tsx`의 적절한 `describe` 안에 추가:
```tsx
it('renders IndicatorSettingsModal with 11 indicator bindings', () => {
    render(<StockChart bars={mockBars} timeframe="1Day" />);
    const modal = screen.getByTestId('indicator-settings-modal');
    expect(modal).toHaveAttribute('data-count', '11');
});
```
> `mockBars`/`timeframe` 인자는 같은 파일의 기존 테스트에서 쓰는 형태를 그대로 따른다(파일 상단 fixture 확인). bars가 비면 차트 본문이 "차트 데이터가 없습니다"로 빠지므로 비어있지 않은 fixture를 사용.

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /Users/y0ngha/Project/siglens-indicator-modal && yarn test src/widgets/chart/__tests__/StockChart.test.tsx`
Expected: FAIL — `data-testid="indicator-settings-modal"`를 못 찾음(StockChart가 아직 IndicatorToolbar를 렌더).

- [ ] **Step 4: StockChart.tsx 수정 — import 교체**

`src/widgets/chart/StockChart.tsx`에서 import 라인 교체:
```ts
// 삭제
import { IndicatorToolbar } from './IndicatorToolbar';
// 추가
import { IndicatorSettingsModal } from './ui/IndicatorSettingsModal';
import {
    INDICATOR_META,
    type IndicatorBinding,
} from './model/indicatorRegistry';
```
`useMemo`는 이미 import되어 있다(파일 상단 `import { useEffect, useMemo, useRef } from 'react'`).

- [ ] **Step 5: StockChart.tsx 수정 — binding 배열 조립**

`paneLabels` useMemo 블록 근처(모든 훅 호출 이후, `if (bars.length === 0)` 이전)에 추가:
```ts
const indicatorBindings = useMemo<IndicatorBinding[]>(
    () => [
        {
            meta: INDICATOR_META.ma!,
            active: maVisiblePeriods.length > 0,
            availablePeriods: MA_DEFAULT_PERIODS,
            visiblePeriods: maVisiblePeriods,
            onTogglePeriod: toggleMAPeriod,
        },
        {
            meta: INDICATOR_META.ema!,
            active: emaVisiblePeriods.length > 0,
            availablePeriods: EMA_DEFAULT_PERIODS,
            visiblePeriods: emaVisiblePeriods,
            onTogglePeriod: toggleEMAPeriod,
        },
        { meta: INDICATOR_META.ichimoku!, active: ichimokuVisible, onToggle: toggleIchimoku },
        { meta: INDICATOR_META.rsi!, active: rsiVisible, onToggle: toggleRSI },
        { meta: INDICATOR_META.macd!, active: macdVisible, onToggle: toggleMACD },
        { meta: INDICATOR_META.dmi!, active: dmiVisible, onToggle: toggleDMI },
        { meta: INDICATOR_META.stochastic!, active: stochasticVisible, onToggle: toggleStochastic },
        { meta: INDICATOR_META.stochRsi!, active: stochRsiVisible, onToggle: toggleStochRSI },
        { meta: INDICATOR_META.cci!, active: cciVisible, onToggle: toggleCCI },
        { meta: INDICATOR_META.bollinger!, active: bollingerVisible, onToggle: toggleBollinger },
        { meta: INDICATOR_META.volumeProfile!, active: vpVisible, onToggle: toggleVP },
    ],
    [
        maVisiblePeriods,
        emaVisiblePeriods,
        ichimokuVisible,
        rsiVisible,
        macdVisible,
        dmiVisible,
        stochasticVisible,
        stochRsiVisible,
        cciVisible,
        bollingerVisible,
        vpVisible,
        toggleMAPeriod,
        toggleEMAPeriod,
        toggleIchimoku,
        toggleRSI,
        toggleMACD,
        toggleDMI,
        toggleStochastic,
        toggleStochRSI,
        toggleCCI,
        toggleBollinger,
        toggleVP,
    ]
);
```

- [ ] **Step 6: StockChart.tsx 수정 — JSX 교체 (toolbar → 우상단 톱니바퀴 모달)**

기존 좌상단 toolbar 컨테이너(`<div className="pointer-events-none absolute top-2 left-2 ...">` 안의 `IndicatorToolbar` 블록)를 다음으로 교체한다. **OverlayLegend는 좌상단에 그대로 두고**, 톱니바퀴 모달만 우상단으로 분리한다:
```tsx
{/* 우상단: 보조지표 설정 모달 트리거 */}
<div className="absolute top-2 right-2 z-10">
    <IndicatorSettingsModal bindings={indicatorBindings} />
</div>
{/* 좌상단: 오버레이 범례 (기존 유지) */}
<div className="pointer-events-none absolute top-2 left-2 z-10 flex flex-col gap-1">
    <OverlayLegend items={overlayLegendItems} />
</div>
```
> 기존 좌상단 컨테이너에는 `IndicatorToolbar`와 `OverlayLegend`가 함께 있었다. `IndicatorToolbar`와 그 `pointer-events-auto` 래퍼를 제거하고 위 두 블록 구조로 만든다. 모달 트리거 div는 클릭이 필요하므로 `pointer-events-none`를 주지 않는다.

- [ ] **Step 7: Run test to verify it passes**

Run: `cd /Users/y0ngha/Project/siglens-indicator-modal && yarn test src/widgets/chart/__tests__/StockChart.test.tsx`
Expected: PASS — `data-count="11"` 확인.

- [ ] **Step 8: 타입 체크 — IndicatorToolbar 참조가 남아있지 않은지**

Run: `cd /Users/y0ngha/Project/siglens-indicator-modal && grep -rn "IndicatorToolbar\|useIndicatorDropdown" src/widgets/chart/StockChart.tsx || echo "clean"`
Expected: `clean` (StockChart에 잔존 참조 없음).

- [ ] **Step 9: Commit (git-agent 위임)**

git-agent에게 위임:
```
add src/widgets/chart/StockChart.tsx and src/widgets/chart/__tests__/StockChart.test.tsx.
commit message: "feat(chart): wire IndicatorSettingsModal into StockChart, move trigger to top-right"
```

---

## Task 4: 구 IndicatorToolbar / useIndicatorDropdown 삭제

**Files:**
- Delete: `src/widgets/chart/IndicatorToolbar.tsx`
- Delete: `src/widgets/chart/hooks/useIndicatorDropdown.ts`
- Delete: `src/widgets/chart/__tests__/IndicatorToolbar.test.tsx`
- Delete (존재 시): `src/widgets/chart/__tests__/hooks/useIndicatorDropdown.test.tsx`

- [ ] **Step 1: 잔존 참조가 없는지 전수 확인**

Run:
```bash
cd /Users/y0ngha/Project/siglens-indicator-modal && grep -rn "IndicatorToolbar\|useIndicatorDropdown" src e2e --include="*.ts" --include="*.tsx"
```
Expected: 삭제 대상 파일 자신 외에 **production/import 참조 없음**. 만약 다른 파일이 import하면 그 import를 먼저 제거(현재 조사상 StockChart만 사용).

- [ ] **Step 2: 파일 삭제**

Run:
```bash
cd /Users/y0ngha/Project/siglens-indicator-modal
rm -f src/widgets/chart/IndicatorToolbar.tsx \
      src/widgets/chart/hooks/useIndicatorDropdown.ts \
      src/widgets/chart/__tests__/IndicatorToolbar.test.tsx \
      src/widgets/chart/__tests__/hooks/useIndicatorDropdown.test.tsx
```
Expected: 에러 없음(`rm -f`는 없는 파일 무시).

- [ ] **Step 3: 전체 chart 테스트 통과 확인**

Run: `cd /Users/y0ngha/Project/siglens-indicator-modal && yarn test src/widgets/chart`
Expected: PASS — 삭제된 테스트 사라지고 나머지 통과.

- [ ] **Step 4: Commit (git-agent 위임)**

git-agent에게 위임:
```
stage deletions of IndicatorToolbar.tsx, useIndicatorDropdown.ts and their tests (use git add -A on src/widgets/chart).
commit message: "refactor(chart): remove legacy IndicatorToolbar and useIndicatorDropdown"
```

---

## Task 5: E2E 스펙

**Files:**
- Create: `e2e/specs/chart-indicators.spec.ts`

> 참고: 메모리상 E2E는 HYBRID 백엔드 / workers:1 / 분석 에러주입 쿠키 seam 등 제약이 있다. 차트 지표 E2E는 신규이므로, **기존 spec 한 개(예: `e2e/specs/backtesting.spec.ts`)의 상단 import/네비게이션·종목 페이지 진입 패턴을 그대로 따른다.** 아래 코드는 구조 골격이며, Step 1에서 실제 기존 spec의 네비게이션 헬퍼(종목 페이지 URL, fixture 종목 심볼, 차트 로딩 대기)를 확인해 맞춘다.

- [ ] **Step 1: 기존 E2E 네비게이션 패턴 확인**

Run:
```bash
cd /Users/y0ngha/Project/siglens-indicator-modal
sed -n '1,60p' e2e/specs/backtesting.spec.ts
echo "--- support/fixtures helpers ---"
ls e2e/support e2e/fixtures
```
Expected: 종목 페이지로 가는 방식(`page.goto('/symbol/AAPL')` 류), 차트 컨테이너 셀렉터, fixture 심볼을 파악. 이 값을 Step 2 코드에 반영.

- [ ] **Step 2: E2E 스펙 작성**

Create `e2e/specs/chart-indicators.spec.ts` (Step 1에서 확인한 실제 종목 URL/심볼/대기 셀렉터로 `<<...>>` 부분을 치환):
```ts
import { test, expect } from '@playwright/test';

// 차트 보조지표 설정 모달: 톱니바퀴 → 카테고리 체크박스 → 차트 반영.
test.describe('chart indicator settings modal', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('<<종목 페이지 경로, 예: /symbol/AAPL>>');
        // 차트 캔버스 컨테이너가 뜰 때까지 대기
        await expect(
            page.getByRole('img', { name: /캔들 차트|가격 차트/ })
        ).toBeVisible();
    });

    test('opens the modal from the gear button and shows category groups', async ({
        page,
    }) => {
        await page.getByRole('button', { name: '보조지표 설정' }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog.getByText('추세')).toBeVisible();
        await expect(dialog.getByText('모멘텀')).toBeVisible();
        // SMC는 항목이 없어 숨겨진다
        await expect(dialog.getByText('SMC')).toHaveCount(0);
    });

    test('toggling RSI adds an oscillator pane to the chart', async ({
        page,
    }) => {
        await page.getByRole('button', { name: '보조지표 설정' }).click();
        const dialog = page.getByRole('dialog');
        await dialog.getByRole('checkbox', { name: /RSI/ }).check();
        // 모달을 닫고 RSI pane 라벨이 차트에 나타나는지 확인
        await page.getByRole('button', { name: '닫기' }).click();
        await expect(page.getByText(/RSI\(/)).toBeVisible();
    });

    test('selecting an MA period chip renders the overlay legend entry', async ({
        page,
    }) => {
        await page.getByRole('button', { name: '보조지표 설정' }).click();
        const dialog = page.getByRole('dialog');
        // MA는 체크박스가 아니라 period 칩
        await dialog.getByRole('button', { name: /^20$/ }).first().click();
        await page.getByRole('button', { name: '닫기' }).click();
        await expect(page.getByText(/MA\(20\)/)).toBeVisible();
    });

    test('closes on Escape', async ({ page }) => {
        await page.getByRole('button', { name: '보조지표 설정' }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);
    });
});
```

- [ ] **Step 3: E2E 실행 (로컬)**

Run: `cd /Users/y0ngha/Project/siglens-indicator-modal && yarn e2e e2e/specs/chart-indicators.spec.ts 2>&1 | tail -30`
Expected: 4개 테스트 PASS. 실패 시 — 셀렉터/심볼/대기 조건을 Step 1에서 확인한 실제 값과 대조해 수정(추측 금지, trace 분석).

- [ ] **Step 4: Commit (git-agent 위임)**

git-agent에게 위임:
```
add e2e/specs/chart-indicators.spec.ts.
commit message: "test(e2e): cover indicator settings modal toggle flow"
```

---

## Task 6: 최종 검증 (lint + 전체 테스트 + 커버리지)

- [ ] **Step 1: Lint**

Run: `cd /Users/y0ngha/Project/siglens-indicator-modal && yarn lint`
Expected: 에러 0. FSD boundary/no-restricted-imports 위반 없음(레지스트리·모달은 chart 내부, shared만 하위 import).

- [ ] **Step 2: 변경 영역 커버리지 90%+ 확인**

Run: `cd /Users/y0ngha/Project/siglens-indicator-modal && yarn test-coverage src/widgets/chart 2>&1 | tail -40`
Expected: `model/indicatorRegistry.ts`, `ui/IndicatorSettingsModal.tsx` 라인/브랜치 커버리지 ≥ 90%. 미달 시 happy/worst case 테스트 보강(특히 모달의 분기: hasPeriods 유무, active 유무, 빈 카테고리).

- [ ] **Step 3: 전체 유닛 테스트**

Run: `cd /Users/y0ngha/Project/siglens-indicator-modal && yarn test 2>&1 | tail -20`
Expected: 전체 PASS. 회귀 없음.

- [ ] **Step 4: 빌드 검증 (exit code 직접 캡처)**

Run: `cd /Users/y0ngha/Project/siglens-indicator-modal && yarn build > /tmp/indmodal-build.log 2>&1; echo "EXIT=$?"`
Expected: `EXIT=0`. (메모리 규칙: `| tail` 파이프는 실패를 가리므로 exit code를 직접 캡처.)

- [ ] **Step 5: review-agent 호출 (CLAUDE.md 워크플로우)**

구현 완료 후 메인 오케스트레이터가 `review-agent`를 호출한다(Opus 4.8). findings 반영 → re-review → approved 시 `mistake-managing-agent` → `git-agent`(push/PR). 이 단계는 실행 세션의 라우팅 규칙(CLAUDE.md)을 따른다.

---

## Self-Review (작성자 점검 결과)

- **스펙 커버리지**: §3(결정사항)·§4(카테고리)·§5(레지스트리/binding/모달/데이터흐름)·§6(파일변경)·§7(테스트 90%+ happy+worst, E2E 필수)·§8(확장성)·§9(FSD) — 모든 항목이 Task 1~6에 매핑됨. §10(후속)·§3.1(미래 23개)은 비목표로 구현 제외, 단 레지스트리 스키마가 확장 수용하도록 Task 1에 주석으로 반영.
- **Placeholder**: 없음. E2E의 `<<종목 경로>>`는 Step 1에서 실제 값 확인 후 치환하도록 명시(추측 금지). 그 외 모든 코드 블록은 완전한 실제 코드.
- **타입 일관성**: `IndicatorBinding`/`IndicatorMeta`/`groupBindingsByCategory`/`INDICATOR_META`/`CATEGORY_ORDER`/`CATEGORY_LABELS` 명칭이 Task 1 정의와 Task 2·3 사용처에서 일치. 훅 반환(`visiblePeriods`/`togglePeriod`, `isVisible`/`toggle`)과 binding 필드 매핑 일치 확인.
- **결정 명시**: MA/EMA는 체크박스 없이 period 칩만(훅이 전체 on/off 미제공). 모달은 `kind` 무관(확장성 핵심).
