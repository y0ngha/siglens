import { useTranslations } from 'next-intl';
import { useMarketFactorLabels } from '@/shared/lib/useMarketFactorLabels';
import type { CSSProperties } from 'react';
import {
    scoreToLabel,
    type FearGreedLabel,
    type MarketFearGreedFactor,
} from '@y0ngha/siglens-core';
import {
    formatMarketFactorRaw,
    type FearGreedMarketId,
} from '@/shared/lib/marketFearGreedLabels';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';

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
    /* `/70`은 트랙 위에서 라이트 2.64:1로 3:1에 못 미친다(실측). 알파를 아예
       빼면 대비는 5.32/4.18로 좋아지지만 EXTREME_GREED와 **클래스가 같아져**
       밴드 매핑이 한 칸 밀려도 테스트가 못 잡는다. `/85`가 다크 4.22 ·
       라이트 3.30으로 양 테마 3:1을 넘으면서 클래스도 구분된다. */
    GREED: 'bg-ui-success/85',
    EXTREME_GREED: 'bg-ui-success',
};

/** One factor row for the market-wide Fear & Greed breakdown. Pure — no client state. */
export function MarketFearGreedFactorBar({
    factor,
    market,
}: MarketFearGreedFactorBarProps) {
    const t = useTranslations('widgets.market-fear-greed');
    const factorLabels = useMarketFactorLabels(market);
    const label = factorLabels.label(factor.key);
    const description = factorLabels.description(factor.key);
    const pctile = Math.round(factor.percentile);

    /*
     * 이 행들은 카드 안에 중첩된 블록이 아니라 페이지 위에 바로 놓인다 —
     * `SURFACE_NESTED`를 쓰면 라이트에서 행은 파이고 형제인 가이드 카드는 떠
     * 보여, 같은 페이지의 두 패널이 반대 방향으로 읽힌다.
     */
    return (
        <section className={cn('flex flex-col gap-2 p-3', SURFACE_CARD)}>
            <header className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-secondary-200">
                    {label}
                </h3>
                <span className="font-mono text-sm text-secondary-200">
                    {formatMarketFactorRaw(factor.rawValue)}
                </span>
            </header>
            <div
                role="progressbar"
                aria-label={t('MarketFearGreedFactorBar.percentileLabel', {
                    v0: label,
                    v1: pctile,
                })}
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
                {/* `백분위`가 섞여 있어 모노를 쓸 수 없다 — Geist Mono에 한글
                    글리프가 없어 OS 폰트로 조용히 폴백한다. 숫자 정렬만 필요하므로
                    본문 서체의 tabular 숫자를 쓴다. */}
                <span className="shrink-0 text-xs text-secondary-400 tabular-nums">
                    {t('MarketFearGreedFactorBar.330be1')} {pctile}
                </span>
            </div>
        </section>
    );
}
