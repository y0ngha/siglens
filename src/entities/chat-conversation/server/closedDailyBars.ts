import 'server-only';
import type { Bar, MarketSessionSpec } from '@y0ngha/siglens-core';
import { quantizeBarsDataToLastClosed } from '@/entities/bars/lib/quantizeBars';
import { getCachedBarsWithIndicators } from '@/entities/bars/server/barsDataCache';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';

/**
 * 한 종목의 완결된 일봉(오래된 순)과 그 시장의 세션. 같은 일봉 시리즈를 에이전트 도구도 읽으므로 카드와 도구의
 * "달라진 점"이 같은 봉에서 계산된다. 장중이면 맨 끝 봉은 현재가일 뿐 종가가 아니라 뗀다.
 */
export async function loadClosedDailyBars(
    symbol: string,
    marketProfile: MarketProfileId,
    fmpSymbol: string | undefined
): Promise<{ bars: readonly Bar[]; session: MarketSessionSpec }> {
    const session = sessionSpecFor(marketProfile);
    const data = await getCachedBarsWithIndicators(
        getCachedMarketDataProvider(session),
        symbol,
        '1Day',
        fmpSymbol,
        session
    );
    const { bars } = quantizeBarsDataToLastClosed(data, new Date(), session);
    return { bars, session };
}
