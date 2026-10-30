import { MARKET_NEWS_LOOKBACK_DAYS } from '@/entities/market-news/lib/marketNewsConstants';

/**
 * 화면에 표시하는 조회 기간(일).
 *
 * 수집 쪽이 실제로 자르는 기간(`MARKET_NEWS_LOOKBACK_DAYS`)과 어긋나면 "최근 N일" 배지와
 * 빈 상태 문구가 거짓말이 된다. `.tsx` UI는 entity `lib/`를 직접 부르지 않으므로(widgets
 * CLAUDE.md) 이 함수가 유일한 연결점이고, 오케스트레이터가 prop으로 내려 보낸다.
 */
export function getMarketNewsLookbackDays(): number {
    return MARKET_NEWS_LOOKBACK_DAYS;
}
