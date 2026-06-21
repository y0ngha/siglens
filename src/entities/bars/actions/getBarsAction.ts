'use server';

import { type BarsData, type Timeframe } from '@y0ngha/siglens-core';
import { getCachedBarsWithIndicators } from '../lib/barsDataCache';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { isCryptoSymbol } from '@/entities/ticker/lib/cryptoAssetStore';
import {
    getFmpUserFacingMessage,
    logFmpPaymentRequiredError,
} from '@/shared/api/fmp/fmpUserMessage';

export async function getBarsAction(
    symbol: string,
    timeframe: Timeframe,
    fmpSymbol?: string
): Promise<BarsData> {
    try {
        // 크립토는 24/7 시장이라 ET 세션 기반 TTL이 주말/장외에 stale을 길게 유지한다.
        // crypto_assets 멤버십으로 분류해 짧은 고정 TTL provider를 주입한다(Plan 4에서
        // core MarketSessionSpec으로 대체 예정).
        const alwaysOpen = await isCryptoSymbol(symbol);
        return await getCachedBarsWithIndicators(
            getCachedMarketDataProvider(alwaysOpen),
            symbol,
            timeframe,
            fmpSymbol
        );
    } catch (error) {
        logFmpPaymentRequiredError(error);
        const message = getFmpUserFacingMessage(error);
        if (message !== null) {
            throw new Error(message, { cause: error });
        }
        throw error;
    }
}
