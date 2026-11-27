import 'server-only';
import { lastCompletedDailyClose } from '@/entities/bars/lib/quantizeBars';
import { getCachedBarsWithIndicators } from '@/entities/bars/server/barsDataCache';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { KR_EQUITY_SESSION } from '@/shared/api/market/sessionSpecFor';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';
import { isDynamicServerError } from '@/shared/lib/isDynamicServerError';
import type { KrPrice } from '../model';

/**
 * 한국 종목의 **마지막으로 완료된** 정규장 종가와 그 날짜 — PER·PBR 분자. 에이전트 `get_fundamentals`가 시가총액에 쓰는 종가와 같은
 * 일봉 캐시(`getCachedBarsWithIndicators`)를 읽으므로 화면·분석 입력·에이전트가 같은 종가를 본다. 절대 던지지 않는다 — 실패는
 * 로그 후 `null`이고 호출부는 PER·PBR을 비운다(Next 동적 서버 오류만 다시 던진다).
 */
export async function loadKrLastClose(
    symbol: string,
    now: Date = new Date()
): Promise<KrPrice | null> {
    try {
        const { bars } = await getCachedBarsWithIndicators(
            getCachedMarketDataProvider(KR_EQUITY_SESSION),
            symbol,
            '1Day',
            undefined,
            KR_EQUITY_SESSION
        );
        return lastCompletedDailyClose(bars, KR_EQUITY_SESSION, now);
    } catch (error) {
        if (isDynamicServerError(error)) throw error;
        console.warn(
            '[kr-valuation] last close unavailable, PER/PBR left empty:',
            redactDbErrorForLog(error)
        );
        return null;
    }
}
