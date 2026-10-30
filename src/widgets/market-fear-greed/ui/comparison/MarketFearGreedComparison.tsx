/**
 * 시장 공포·탐욕 판독값의 기간별 비교(현재·1주·1개월·1년 전) 미니 게이지 그리드.
 */
import { useTranslations } from 'next-intl';
import type { MarketFearGreedComparisonPoint } from '@/entities/market-fear-greed/model';
import { cn } from '@/shared/lib/cn';
import { FearGreedGauge } from '@/shared/ui/FearGreedGauge';
import { MARKET_COMPARISON_LABEL_KEY } from '../../utils/marketComparisonLabelKey';

interface MarketFearGreedComparisonProps {
    comparisons: MarketFearGreedComparisonPoint[];
}

/**
 * 시장 전체 판독값(현재 + 과거 lookback)을 미니 게이지로 그린다. 종목 탭이 같은
 * 목적으로 쓰는 게이지 프리미티브를 그대로 써 두 화면이 같은 모양으로 읽힌다.
 */
export function MarketFearGreedComparison({
    comparisons,
}: MarketFearGreedComparisonProps) {
    const tPeriod = useTranslations('shared.ui.period');
    if (comparisons.length === 0) return null;
    return (
        // flex-wrap이 아니라 2열→4열 grid — flex-wrap은 4칸이 3+1로 갈라져
        // 마지막 칸만 홀로 남는 폭이 생긴다.
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {comparisons.map(point => (
                <li
                    key={point.key}
                    className={cn(
                        'rounded-lg border p-1',
                        // `현재` 타일을 나머지와 가르는 신호가 보더뿐이라 강조와 기본
                        // 보더 모두 알파 없이 써 두 값의 대비 차이를 벌린다. 상태가
                        // 색에만 의존하지는 않는다 — 각 타일 아래에 기간 라벨이 있다.
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
