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
                        // `현재` 타일이 나머지와 구분되는 신호가 보더뿐인데
                        // 양쪽 다 `/40`이라 1.75 대 1.10으로 사실상 같아 보였다.
                        // 알파를 걷어내 강조와 기본을 실제로 벌린다(실측 결과는
                        // 커밋 메시지 참조). 상태가 색에만 의존하지는 않는다 —
                        // 각 타일 아래에 `현재`·`1주 전` 라벨이 그대로 있다.
                        point.key === 'now'
                            ? 'border-primary-500'
                            : 'border-secondary-700'
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
