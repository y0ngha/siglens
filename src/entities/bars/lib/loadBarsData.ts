import 'server-only';
import { getTranslations } from 'next-intl/server';
import type { BarsData, Timeframe } from '@y0ngha/siglens-core';
import { getCachedBarsWithIndicators } from './barsDataCache';
import { roundIndicators } from './roundIndicators';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveMarketProfile';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';
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
 *
 * `resolveProfile`: 시장 프로필 해석기. 기본값은 캐시 없는 `resolveMarketProfile`
 * (`asset_translations` 조회) — 정적 경로(`getBarsStatic`)는 바깥 `unstable_cache`가 결과를
 * 통째로 캐시하므로 이 조회도 재생성 때만 돈다. 매 차트 조회마다 도는 서버 액션
 * (`getBarsAction`)은 캐시된 `resolveMarketProfileStatic`을 넘긴다.
 */
export async function loadBarsData(
    symbol: string,
    timeframe: Timeframe,
    fmpSymbol?: string,
    resolveProfile: (
        symbol: string
    ) => Promise<MarketProfileId> = resolveMarketProfile
): Promise<BarsData> {
    try {
        // Resolve the profile once (DB-first → FMP); derive the session spec
        // directly from it — no assetClass→profileId round-trip.
        const marketProfile = await resolveProfile(symbol);
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
        //
        // 번역자를 못 만들면 원래 에러를 그대로 던진다. 이 로더는 `unstable_cache` 콜백 안에서도
        // 돈다(`getSessionBarsStatic` 등). 로케일이 그 스코프에 보이지 않으면 next-intl이
        // `headers()`로 물러나는데, 캐시 스코프 안의 `headers()`는 Next가 거부한다(E838). 그때
        // 번역 실패가 원래 FMP 에러를 덮어 로그·degrade 판정이 엉뚱한 에러를 보게 된다.
        const t = await getTranslations().catch(() => null);
        const message = t === null ? null : translateFmpError(error, t);
        if (message !== null) {
            throw new Error(message, { cause: error });
        }
        throw error;
    }
}
