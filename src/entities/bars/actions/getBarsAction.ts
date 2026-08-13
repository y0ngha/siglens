'use server';

import {
    type BarsData,
    type Tier,
    type Timeframe,
    isTimeframeAllowed,
} from '@y0ngha/siglens-core';
import { getCachedBarsWithIndicators } from '../lib/barsDataCache';
import { roundIndicators } from '../lib/roundIndicators';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import {
    getFmpUserFacingMessage,
    logFmpPaymentRequiredError,
} from '@/shared/api/fmp/fmpUserMessage';
import { resolveCallerTier } from '@/entities/auth/lib/resolveCallerTier';

async function resolveBarsTier(): Promise<Tier> {
    return resolveCallerTier('getBarsAction');
}

export async function getBarsAction(
    symbol: string,
    timeframe: Timeframe,
    fmpSymbol?: string
): Promise<BarsData> {
    const tier = await resolveBarsTier();
    if (!isTimeframeAllowed(tier, timeframe)) {
        throw new Error(
            `Timeframe ${timeframe} is not available for ${tier} tier.`
        );
    }

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
        // 클라이언트 직렬화 경계 — 여기서만 지표 정밀도를 줄인다. 캐시에 들어간 값은
        // 원본 그대로이고(캐시 키·계산 불변), 나가는 페이로드만 약 34% 작아진다.
        // 이 함수가 `getBarsStatic`(unstable_cache 래퍼)의 안쪽이라 정적 생성 경로도
        // 같이 커버된다. 근거: roundIndicators JSDoc.
        return { ...data, indicators: roundIndicators(data.indicators) };
    } catch (error) {
        logFmpPaymentRequiredError(error);
        const message = getFmpUserFacingMessage(error);
        if (message !== null) {
            throw new Error(message, { cause: error });
        }
        throw error;
    }
}
