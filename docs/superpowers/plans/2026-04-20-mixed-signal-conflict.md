# Mixed Signal Conflict Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 섹터 신호 탐색에서 상승/하락 신호가 동시에 감지된 종목을 신호 강도(개수) 기준으로 단일 사분면에 배치하고, 동수인 경우 중앙의 "혼재" 영역에 분리 표시한다.

**Architecture:** `filterStrict()` 이후 `resolveConflicts()`를 추가해 충돌 종목을 분기한다. `QuadrantKey`에 `'mixed'`를 추가하고, 충돌 메타데이터는 컴포넌트 로컬 타입(`StockSignalResultWithConflict`)으로 처리해 도메인 타입을 건드리지 않는다.

**Tech Stack:** React (Client Component), TypeScript, Tailwind CSS

---

### Task 1: `SignalSubsection` — `infoMessage` prop 추가

**Files:**
- Modify: `src/components/dashboard/SignalSubsection.tsx`

- [ ] **Step 1: `infoMessage` prop 추가 및 렌더링**

`SignalSubsectionProps`에 `infoMessage?: string`을 추가하고, 존재할 때 제목 옆에 툴팁 버튼을 렌더링한다.

```tsx
// src/components/dashboard/SignalSubsection.tsx
import type { StockSignalResult } from '@/domain/types';
import { cn } from '@/lib/cn';
import { SignalStockCard } from './SignalStockCard';

interface SignalSubsectionProps {
    title: string;
    marker: string;
    variant: 'confirmed' | 'expected' | 'mixed';
    stocks: readonly StockSignalResult[];
    infoMessage?: string;
}

export function SignalSubsection({
    title,
    marker,
    variant,
    stocks,
    infoMessage,
}: SignalSubsectionProps) {
    const count = stocks.length.toString().padStart(2, '0');
    const borderClass =
        variant === 'confirmed'
            ? 'border-t-2 border-secondary-600'
            : variant === 'mixed'
              ? 'border-t-2 border-secondary-500'
              : 'border-t border-dashed border-secondary-700';
    const labelOpacity =
        variant === 'confirmed' || variant === 'mixed'
            ? 'opacity-100 font-semibold'
            : 'opacity-70 font-medium';

    return (
        <section className={cn(borderClass, 'pt-3 pb-4')}>
            <div className="mb-3 flex items-baseline justify-between">
                <div className="flex items-center gap-2">
                    <h3
                        className={cn(
                            'text-secondary-200 text-sm tracking-[0.15em] text-pretty uppercase',
                            labelOpacity
                        )}
                    >
                        <span aria-hidden="true" className="mr-2">
                            {marker}
                        </span>
                        {title}
                    </h3>
                    {infoMessage && (
                        <span
                            title={infoMessage}
                            aria-label={infoMessage}
                            className="text-secondary-500 hover:text-secondary-300 cursor-default text-xs transition-colors"
                        >
                            ⓘ
                        </span>
                    )}
                </div>
                <span
                    className="text-secondary-500 font-mono text-2xl tabular-nums"
                    aria-label={`${stocks.length}개 종목`}
                >
                    {count}
                </span>
            </div>
            {stocks.length === 0 ? (
                <p
                    className="text-secondary-500 py-4 text-center text-xs italic"
                    role="status"
                >
                    오늘은 해당 신호가 없습니다. 다른 섹터를 확인해 보세요.
                </p>
            ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {stocks.map(stock => (
                        <SignalStockCard key={stock.symbol} data={stock} />
                    ))}
                </div>
            )}
        </section>
    );
}
```

- [ ] **Step 2: 빌드 확인**

```bash
yarn build 2>&1 | tail -20
```

Expected: 타입 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/components/dashboard/SignalSubsection.tsx
git commit -m "feat(market): add infoMessage prop and mixed variant to SignalSubsection"
```

---

### Task 2: `SignalStockCard` — 충돌 뱃지 추가

**Files:**
- Modify: `src/components/dashboard/SignalStockCard.tsx`

- [ ] **Step 1: `conflict` prop 추가 및 뱃지 렌더링**

`StockSignalResult`를 그대로 받되, 카드 컴포넌트 내부에서 `conflict` 필드를 읽도록 한다. `conflict`는 Task 3에서 `SectorSignalPanel`이 넘겨줄 확장 타입의 필드다. 카드는 `data`로 `StockSignalResult & { conflict?: ... }` 형태를 받기 위해 로컬 타입을 사용한다.

```tsx
// src/components/dashboard/SignalStockCard.tsx
import Link from 'next/link';
import { cn } from '@/lib/cn';
import type { StockSignalResult } from '@/domain/types';
import { SignalBadge } from './SignalBadge';

interface ConflictInfo {
    bullishCount: number;
    bearishCount: number;
}

interface SignalStockCardProps {
    data: StockSignalResult & { conflict?: ConflictInfo };
}

export function SignalStockCard({ data }: SignalStockCardProps) {
    const isUp = data.changePercent >= 0;
    const sign = isUp ? '+' : '';
    const changeColor = isUp ? 'text-chart-bullish' : 'text-chart-bearish';

    return (
        <Link
            href={`/${data.symbol}`}
            title={`${data.koreanName} 분석`}
            className={cn(
                'border-secondary-700 bg-secondary-800/50 block origin-center touch-manipulation border',
                'rounded-lg p-3',
                'transition-[background-color,border-color,transform,box-shadow] duration-150',
                'hover:bg-secondary-800/70 hover:border-secondary-600 hover:-translate-y-px',
                'hover:shadow-primary-950/40 hover:shadow-lg',
                'focus-visible:ring-primary-500 focus-visible:ring-2 focus-visible:outline-none',
                'motion-reduce:transition-none motion-reduce:hover:transform-none'
            )}
        >
            <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-1">
                    <span
                        translate="no"
                        className="text-secondary-100 font-mono text-xs font-semibold"
                    >
                        {data.symbol}
                    </span>
                    <span
                        className={cn(
                            'flex shrink-0 items-center gap-0.5 font-mono text-xs tabular-nums',
                            changeColor
                        )}
                    >
                        <span aria-hidden="true">{isUp ? '▲' : '▼'}</span>
                        <span className="sr-only">
                            {isUp ? '상승' : '하락'}
                        </span>
                        {sign}
                        {data.changePercent.toFixed(2)}%
                    </span>
                </div>
                <p className="text-secondary-400 min-w-0 truncate text-xs">
                    {data.koreanName}
                </p>
                <p className="text-secondary-100 font-mono text-sm tabular-nums">
                    $
                    {data.price.toLocaleString('en-US', {
                        maximumFractionDigits: 2,
                    })}
                </p>
                {data.signals.length > 0 && (
                    <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 pt-1">
                        {data.signals.map((s, i) => (
                            <span key={`${s.type}-${i}`} className="contents">
                                {i > 0 && (
                                    <span
                                        className="text-secondary-600"
                                        aria-hidden="true"
                                    >
                                        ·
                                    </span>
                                )}
                                <SignalBadge type={s.type} />
                            </span>
                        ))}
                    </div>
                )}
                {data.conflict && (
                    <p className="text-secondary-500 mt-1 text-xs">
                        상승 {data.conflict.bullishCount}건 / 하락{' '}
                        {data.conflict.bearishCount}건 감지
                    </p>
                )}
            </div>
        </Link>
    );
}
```

- [ ] **Step 2: 빌드 확인**

```bash
yarn build 2>&1 | tail -20
```

Expected: 타입 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/components/dashboard/SignalStockCard.tsx
git commit -m "feat(market): add conflict badge to SignalStockCard"
```

---

### Task 3: `SectorSignalPanel` — `resolveConflicts` 및 `mixed` 사분면 통합

**Files:**
- Modify: `src/components/dashboard/SectorSignalPanel.tsx`

- [ ] **Step 1: `resolveConflicts` 함수 작성 및 `mixed` 사분면 렌더링 추가**

```tsx
// src/components/dashboard/SectorSignalPanel.tsx
'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type {
    DashboardTimeframe,
    Signal,
    SignalDirection,
    SignalPhase,
    SectorSignalsResult,
    StockSignalResult,
} from '@/domain/types';
import {
    DEFAULT_DASHBOARD_TIMEFRAME,
    SIGNAL_SECTORS,
} from '@/domain/constants/dashboard-tickers';
import { SectorTabs } from './SectorTabs';
import { TimeframeSelector } from './TimeframeSelector';
import { SignalSubsection } from './SignalSubsection';

interface ConflictInfo {
    readonly bullishCount: number;
    readonly bearishCount: number;
}

type StockWithConflict = StockSignalResult & { readonly conflict?: ConflictInfo };

type QuadrantKey =
    | 'bullishConfirmed'
    | 'bullishExpected'
    | 'bearishExpected'
    | 'bearishConfirmed';

const EMPTY_QUADRANTS: Record<QuadrantKey, readonly StockWithConflict[]> = {
    bullishConfirmed: [],
    bullishExpected: [],
    bearishExpected: [],
    bearishConfirmed: [],
};

const SIGNAL_TO_QUADRANT: Record<
    SignalDirection,
    Record<SignalPhase, QuadrantKey>
> = {
    bullish: {
        confirmed: 'bullishConfirmed',
        expected: 'bullishExpected',
    },
    bearish: {
        confirmed: 'bearishConfirmed',
        expected: 'bearishExpected',
    },
};

function signalToQuadrantKey(s: Signal): QuadrantKey {
    return SIGNAL_TO_QUADRANT[s.direction][s.phase];
}

function groupStockIntoQuadrants(
    acc: Record<QuadrantKey, readonly StockWithConflict[]>,
    stock: StockWithConflict
): Record<QuadrantKey, readonly StockWithConflict[]> {
    const grouped = stock.signals.reduce<Record<QuadrantKey, readonly Signal[]>>(
        (g, s) => {
            const key = signalToQuadrantKey(s);
            return { ...g, [key]: [...g[key], s] };
        },
        {
            bullishConfirmed: [],
            bullishExpected: [],
            bearishExpected: [],
            bearishConfirmed: [],
        }
    );
    return (Object.keys(grouped) as QuadrantKey[]).reduce(
        (next, key) =>
            grouped[key].length === 0
                ? next
                : {
                      ...next,
                      [key]: [
                          ...next[key],
                          { ...stock, signals: grouped[key] },
                      ],
                  },
        acc
    );
}

// Strict mode is always on: anticipation signals only visible when the stock's
// trend opposes or is sideways relative to the signal's direction.
function filterStrict(
    stocks: readonly StockSignalResult[]
): readonly StockSignalResult[] {
    return stocks.flatMap(stock => {
        const filtered = stock.signals.filter(sig => {
            if (sig.phase === 'confirmed') return true;
            if (sig.direction === 'bullish') return stock.trend !== 'uptrend';
            return stock.trend !== 'downtrend';
        });
        return filtered.length === 0 ? [] : [{ ...stock, signals: filtered }];
    });
}

function resolveConflicts(stocks: readonly StockSignalResult[]): {
    resolved: readonly StockWithConflict[];
    mixed: readonly StockWithConflict[];
} {
    const resolved: StockWithConflict[] = [];
    const mixed: StockWithConflict[] = [];

    for (const stock of stocks) {
        const bullishCount = stock.signals.filter(
            s => s.direction === 'bullish'
        ).length;
        const bearishCount = stock.signals.filter(
            s => s.direction === 'bearish'
        ).length;

        if (bullishCount === 0 || bearishCount === 0) {
            resolved.push(stock);
            continue;
        }

        const conflict: ConflictInfo = { bullishCount, bearishCount };

        if (bullishCount === bearishCount) {
            mixed.push({ ...stock, conflict });
        } else {
            const winningDirection: SignalDirection =
                bullishCount > bearishCount ? 'bullish' : 'bearish';
            const filteredSignals = stock.signals.filter(
                s => s.direction === winningDirection
            );
            resolved.push({ ...stock, signals: filteredSignals, conflict });
        }
    }

    return { resolved, mixed };
}

interface SectorSignalPanelProps {
    data: SectorSignalsResult;
    initialSector: string;
    initialTimeframe: DashboardTimeframe;
}

export function SectorSignalPanel({
    data,
    initialSector,
    initialTimeframe,
}: SectorSignalPanelProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [activeSector, setActiveSector] = useState(initialSector);
    const [activeTimeframe, setActiveTimeframe] = useState(initialTimeframe);

    const updateUrl = useCallback(
        (nextSector: string, nextTimeframe: DashboardTimeframe) => {
            const params = new URLSearchParams(searchParams.toString());
            if (nextSector === SIGNAL_SECTORS[0].symbol)
                params.delete('sector');
            else params.set('sector', nextSector);
            if (nextTimeframe === DEFAULT_DASHBOARD_TIMEFRAME)
                params.delete('timeframe');
            else params.set('timeframe', nextTimeframe);
            const qs = params.toString();
            router.replace(qs === '' ? pathname : `${pathname}?${qs}`, {
                scroll: false,
            });
        },
        [router, pathname, searchParams]
    );

    const filtered = useMemo(() => filterStrict(data.stocks), [data.stocks]);

    const sectorStocks = useMemo(
        () => filtered.filter(s => s.sectorSymbol === activeSector),
        [filtered, activeSector]
    );

    const { resolved: resolvedStocks, mixed: mixedStocks } = useMemo(
        () => resolveConflicts(sectorStocks),
        [sectorStocks]
    );

    const quadrants = useMemo(
        () => resolvedStocks.reduce(groupStockIntoQuadrants, EMPTY_QUADRANTS),
        [resolvedStocks]
    );

    const handleSectorChange = (sector: string) => {
        setActiveSector(sector);
        updateUrl(sector, activeTimeframe);
    };

    const handleTimeframeChange = (next: DashboardTimeframe) => {
        setActiveTimeframe(next);
        updateUrl(activeSector, next);
    };

    return (
        <section
            aria-label="섹터 신호 탐색"
            aria-live="polite"
            className="sector-panel-bg relative px-6 py-10 lg:px-[15vw]"
        >
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-secondary-200 text-sm font-semibold tracking-[0.15em] uppercase">
                    섹터 신호 탐색
                </h2>
                <TimeframeSelector
                    timeframe={activeTimeframe}
                    onChange={handleTimeframeChange}
                />
            </div>
            <SectorTabs
                activeSector={activeSector}
                onChange={handleSectorChange}
            />
            <div
                id={`sector-panel-${activeSector}`}
                role="tabpanel"
                aria-labelledby={`sector-tab-${activeSector}`}
                className="mt-6 flex flex-col gap-4"
            >
                <SignalSubsection
                    title="상승 신호"
                    marker="▲"
                    variant="confirmed"
                    stocks={quadrants.bullishConfirmed}
                />
                <SignalSubsection
                    title="상승 조짐"
                    marker="△"
                    variant="expected"
                    stocks={quadrants.bullishExpected}
                />
                <SignalSubsection
                    title="혼재"
                    marker="⚡"
                    variant="mixed"
                    stocks={mixedStocks}
                    infoMessage="상승 신호와 하락 신호의 강도가 동일하다. 방향을 알 수 없다."
                />
                <SignalSubsection
                    title="하락 조짐"
                    marker="▽"
                    variant="expected"
                    stocks={quadrants.bearishExpected}
                />
                <SignalSubsection
                    title="하락 신호"
                    marker="▼"
                    variant="confirmed"
                    stocks={quadrants.bearishConfirmed}
                />
            </div>
        </section>
    );
}
```

- [ ] **Step 2: 빌드 및 타입 확인**

```bash
yarn build 2>&1 | tail -20
```

Expected: 타입 에러 없음.

- [ ] **Step 3: lint 확인**

```bash
yarn lint 2>&1 | tail -20
```

Expected: 에러 없음.

- [ ] **Step 4: 커밋**

```bash
git add src/components/dashboard/SectorSignalPanel.tsx
git commit -m "feat(market): add resolveConflicts and mixed quadrant to SectorSignalPanel"
```
