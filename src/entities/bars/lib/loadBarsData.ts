import 'server-only';
import { getTranslations } from 'next-intl/server';
import type { BarsData, Timeframe } from '@y0ngha/siglens-core';
import { getCachedBarsWithIndicators } from './barsDataCache';
import { roundIndicators } from './roundIndicators';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveMarketProfile';
import {
    logFmpPaymentRequiredError,
    translateFmpError,
} from '@/shared/api/fmp/fmpUserMessage';

/**
 * 서버에서 쓰는 봉+지표. **공포·탐욕용 5년 일봉(`fearGreedBars`)을 그대로 둔다.**
 *
 * 예전에는 정적 경로(`getBarsStatic`)가 클라이언트용 서버 액션 `getBarsAction`을
 * 그대로 감쌌다. 액션은 브라우저로 나가는 경계라 5년 봉을 떼어야 하는데, 같은 함수를
 * 서버 계산도 쓰면 서버 쪽 공포·탐욕이 2년 봉으로 떨어진다. 그래서 공통 부분을 여기로
 * 빼고, 액션은 이 결과에서 5년 봉만 떼어 보낸다.
 *
 * 'use server' 파일에서 export하면 그 함수가 곧 클라이언트가 호출할 수 있는 서버
 * 액션이 되므로, 이 로더는 일반 서버 모듈에 둔다.
 */
export async function loadBarsData(
    symbol: string,
    timeframe: Timeframe,
    fmpSymbol?: string
): Promise<BarsData> {
    try {
        // Resolve profile once via cached getAssetInfo (DB-first → FMP); derive the
        // session spec directly from it — no assetClass→profileId round-trip.
        const marketProfile = await resolveMarketProfile(symbol);
        const session = sessionSpecFor(marketProfile);
        const data = await getCachedBarsWithIndicators(
            getCachedMarketDataProvider(session),
            symbol,
            timeframe,
            fmpSymbol,
            session
        );
        // 직렬화 경계(클라이언트 응답·정적 캐시)에서 지표 정밀도를 줄인다. 캐시에 들어간
        // 값은 원본 그대로이고, 나가는 페이로드만 약 34% 작아진다(roundIndicators JSDoc).
        return { ...data, indicators: roundIndicators(data.indicators) };
    } catch (error) {
        logFmpPaymentRequiredError(error);
        // 훅이 없는 서버 코드라 루트 번역자를 직접 만든다.
        const message = translateFmpError(error, await getTranslations());
        if (message !== null) {
            throw new Error(message, { cause: error });
        }
        throw error;
    }
}
