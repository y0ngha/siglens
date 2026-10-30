import { MARKET_NEWS_LOOKBACK_DAYS } from '@/entities/market-news/lib/marketNewsConstants';
import { getMarketNewsLookbackDays } from '@/widgets/market-news/utils/marketNewsLookback';

describe('getMarketNewsLookbackDays', () => {
    it('수집 쪽 조회 기간 상수를 그대로 돌려준다', () => {
        expect(getMarketNewsLookbackDays()).toBe(MARKET_NEWS_LOOKBACK_DAYS);
    });
});
