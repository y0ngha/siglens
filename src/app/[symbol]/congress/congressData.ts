import {
    getCongressTradesResilient,
    type ResilientCongressTrades,
} from '@/entities/congress-trades';

/**
 * `/[symbol]/congress` 페이지가 필요로 하는 데이터(의회 거래 + degrade 신호)를
 * 한 번의 호출로 반환한다.
 *
 * Wrapper around `getCongressTradesResilient` to mirror the financials route's
 * `getFinancialsPageData` shape — keeping the page body free of direct entity
 * imports for the data layer.
 */
export type CongressPageData = ResilientCongressTrades;

export async function getCongressPageData(
    symbol: string
): Promise<CongressPageData> {
    return getCongressTradesResilient(symbol);
}
