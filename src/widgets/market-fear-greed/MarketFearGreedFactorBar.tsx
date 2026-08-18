import type { CSSProperties } from 'react';
import {
    scoreToLabel,
    type FearGreedLabel,
    type MarketFearGreedFactor,
} from '@y0ngha/siglens-core';
import {
    MARKET_FACTOR_DESCRIPTION,
    MARKET_FACTOR_LABEL,
    formatMarketFactorRaw,
    type FearGreedMarketId,
} from '@/shared/lib/marketFearGreedLabels';
import { cn } from '@/shared/lib/cn';

interface MarketFearGreedFactorBarProps {
    factor: MarketFearGreedFactor;
    /**
     * 어느 시장의 지수인가. 요인 라벨·설명이 시장마다 다르다 — 같은 `junk_bond`
     * 키라도 미국은 하이일드 회사채, 한국은 회사채−국고채 스프레드로 채워져 있다.
     */
    market: FearGreedMarketId;
}

/** Percentile → fill color class (semantic tokens; matches FearGreedGroupBar). */
const BAR_FILL_COLOR: Record<FearGreedLabel, string> = {
    EXTREME_FEAR: 'bg-ui-danger',
    FEAR: 'bg-ui-warning',
    NEUTRAL: 'bg-secondary-400',
    GREED: 'bg-ui-success/70',
    EXTREME_GREED: 'bg-ui-success',
};

/** One factor row for the market-wide Fear & Greed breakdown. Pure — no client state. */
export function MarketFearGreedFactorBar({
    factor,
    market,
}: MarketFearGreedFactorBarProps) {
    const label = MARKET_FACTOR_LABEL[market][factor.key];
    const description = MARKET_FACTOR_DESCRIPTION[market][factor.key];
    const pctile = Math.round(factor.percentile);

    return (
        <section className="flex flex-col gap-2 rounded bg-secondary-800/40 p-3">
            <header className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-secondary-200">
                    {label}
                </h3>
                <span className="font-mono text-sm text-secondary-100">
                    {formatMarketFactorRaw(factor.rawValue)}
                </span>
            </header>
            <div
                role="progressbar"
                aria-label={`${label} 백분위 ${pctile}`}
                aria-valuenow={pctile}
                aria-valuemin={0}
                aria-valuemax={100}
                className="relative h-2 overflow-hidden rounded bg-secondary-700/70"
            >
                <div
                    className={cn(
                        'h-full w-(--bar-width)',
                        BAR_FILL_COLOR[scoreToLabel(pctile)]
                    )}
                    style={{ '--bar-width': `${pctile}%` } as CSSProperties}
                />
            </div>
            <div className="flex items-center justify-between gap-2">
                {/* Plain visible text, not a tooltip — this component is a server
                    component (no client-side disclosure widget available), and
                    plain text is trivially reachable by screen readers. */}
                <p className="text-xs text-secondary-500">{description}</p>
                <span className="shrink-0 font-mono text-xs text-secondary-400">
                    백분위 {pctile}
                </span>
            </div>
        </section>
    );
}
