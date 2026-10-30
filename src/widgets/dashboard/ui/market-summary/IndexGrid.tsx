/**
 * 시장 요약 패널의 지수 카드 그리드.
 */
import type { MarketIndexData } from '@y0ngha/siglens-core';
import type { ClientDashboardScope } from '@/shared/config/dashboardScope';
import { quotePrefixFor } from '@/shared/lib/priceFormat';
import { INDEX_GRID_CLASS } from '../../utils/marketGridClasses';
import { IndexCard } from './IndexCard';

interface IndexGridProps {
    indices: readonly MarketIndexData[];
    scope: ClientDashboardScope;
}

/**
 * 지수 값은 포인트라 통화 기호를 붙이지 않는다(`^`로 시작하는 공급자 심볼). 환율·ETF는
 * 그 시장의 통화를 쓴다.
 */
export function IndexGrid({ indices, scope }: IndexGridProps) {
    return (
        <div className={INDEX_GRID_CLASS}>
            {indices.map(index => (
                <IndexCard
                    key={index.fmpSymbol}
                    data={index}
                    currencySymbol={quotePrefixFor(
                        index.fmpSymbol,
                        scope.currencySymbol
                    )}
                    tickerIsReadable={scope.tickerIsReadable}
                />
            ))}
        </div>
    );
}
