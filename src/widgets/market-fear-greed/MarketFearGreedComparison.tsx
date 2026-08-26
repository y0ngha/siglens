import type {
    MarketFearGreedComparisonKey,
    MarketFearGreedComparisonPoint,
} from '@/entities/market-fear-greed';
import { FearGreedGauge } from '@/widgets/fear-greed';
import { cn } from '@/shared/lib/cn';

/**
 * Lookback → 한글 라벨. `shared`는 `entities`를 import할 수 없어(FSD 의존 방향)
 * 나머지 Fear & Greed 라벨과 달리 이 표만 위젯 쪽에 둔다 — shared에 두면 키 유니온을
 * 한 벌 더 적어야 하고, 그 사본이 entity 타입과 조용히 어긋날 수 있다.
 */
export const MARKET_COMPARISON_LABEL: Record<
    MarketFearGreedComparisonKey,
    string
> = {
    now: '현재',
    '1w': '1주 전',
    '1m': '1개월 전',
    '1y': '1년 전',
};

interface MarketFearGreedComparisonProps {
    comparisons: MarketFearGreedComparisonPoint[];
}

/** Renders the market-wide readings (current + past lookbacks) as CNN-style mini
 *  gauges, reusing the same primitive the per-stock page uses for the same purpose. */
export function MarketFearGreedComparison({
    comparisons,
}: MarketFearGreedComparisonProps) {
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
                        periodLabel={MARKET_COMPARISON_LABEL[point.key]}
                    />
                </li>
            ))}
        </ul>
    );
}
