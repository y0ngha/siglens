import { useTranslations } from 'next-intl';
import type { MarketFearGreedComparisonPoint } from '@/entities/market-fear-greed';
import { FearGreedGauge } from '@/widgets/fear-greed';
import { cn } from '@/shared/lib/cn';
import { MARKET_COMPARISON_LABEL_KEY } from './marketComparisonLabelKey';

interface MarketFearGreedComparisonProps {
    comparisons: MarketFearGreedComparisonPoint[];
}

/** Renders the market-wide readings (current + past lookbacks) as CNN-style mini
 *  gauges, reusing the same primitive the per-stock page uses for the same purpose. */
export function MarketFearGreedComparison({
    comparisons,
}: MarketFearGreedComparisonProps) {
    const tPeriod = useTranslations('shared.ui.period');
    if (comparisons.length === 0) return null;
    return (
        // 2×4가 아니라 2열→4열 grid — flex-wrap은 4칸이 3+1로 갈라져
        // 마지막 칸만 홀로 남는 폭이 생긴다.
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {comparisons.map(point => (
                <li
                    key={point.key}
                    className={cn(
                        'rounded-lg border p-1',
                        point.key === 'now'
                            ? 'border-primary-500/40'
                            : 'border-secondary-700/40'
                    )}
                >
                    <FearGreedGauge
                        score={Math.round(point.score)}
                        label={point.label}
                        size="mini"
                        periodLabel={tPeriod(
                            MARKET_COMPARISON_LABEL_KEY[point.key]
                        )}
                    />
                </li>
            ))}
        </ul>
    );
}
