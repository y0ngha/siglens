vi.mock('server-only', () => ({}));
vi.mock('@/shared/cache/getOrSetCache', () => ({ getOrSetCache: vi.fn() }));
vi.mock('../../api/fetchDailyCloses', () => ({ fetchDailyCloses: vi.fn() }));
vi.mock('../../api/fetchKrDailyCloses', () => ({
    fetchKrDailyCloses: vi.fn(),
}));
vi.mock('../../api/fetchCryptoDailyBars', () => ({
    fetchCryptoDailyBars: vi.fn(),
}));

import { describe, expect, it, vi } from 'vitest';
import { createCacheConfigFingerprint } from '@/shared/cache/configFingerprint';
import { MARKET_FEAR_GREED_CONFIG_FINGERPRINT } from '../../api/marketFearGreedCache';
import { MARKET_FEAR_GREED_CRYPTO_CONFIG_FINGERPRINT } from '../../api/marketFearGreedCryptoCache';
import { MARKET_FEAR_GREED_KR_CONFIG_FINGERPRINT } from '../../api/marketFearGreedKrCache';
import {
    MARKET_FEAR_GREED_CRYPTO_BENCHMARK,
    MARKET_FEAR_GREED_CRYPTO_LOOKBACK_DAYS,
    MARKET_FEAR_GREED_CRYPTO_SAFE_HAVEN,
    MARKET_FEAR_GREED_CRYPTO_UNIVERSE,
} from '../../lib/marketFearGreedCryptoSymbols';
import {
    KOSPI_INDEX_SYMBOL,
    MARKET_FEAR_GREED_KR_LOOKBACK_DAYS,
    MARKET_FEAR_GREED_KR_SYMBOLS,
} from '../../lib/marketFearGreedKrSymbols';
import {
    MARKET_FEAR_GREED_LOOKBACK_DAYS,
    MARKET_FEAR_GREED_SYMBOLS,
} from '../../lib/marketFearGreedSymbols';

/**
 * 캐시 값에 `history`가 늘면서 세 시장 fingerprint에 `viewShape`를 넣었다. 그 줄이 빠지면
 * Redis·데이터 캐시가 `history` 없는 옛 항목을 그대로 읽는다. 각 테스트는 `viewShape` 없이
 * 같은 설정을 다시 만들어 export된 fingerprint와 달라야 함을 고정한다.
 */
describe('공포·탐욕 캐시 fingerprint는 viewShape를 포함한다', () => {
    it('미국', () => {
        const withoutShape = createCacheConfigFingerprint(
            JSON.stringify({
                symbols: MARKET_FEAR_GREED_SYMBOLS,
                lookbackDays: MARKET_FEAR_GREED_LOOKBACK_DAYS,
                priceSource: 'etf:adjClose,index:price',
            })
        );
        expect(MARKET_FEAR_GREED_CONFIG_FINGERPRINT).not.toBe(withoutShape);
    });

    it('한국', () => {
        const withoutShape = createCacheConfigFingerprint(
            JSON.stringify({
                symbols: MARKET_FEAR_GREED_KR_SYMBOLS,
                volatilitySource: KOSPI_INDEX_SYMBOL,
                lookbackDays: MARKET_FEAR_GREED_KR_LOOKBACK_DAYS,
                priceField: 'adjclose',
            })
        );
        expect(MARKET_FEAR_GREED_KR_CONFIG_FINGERPRINT).not.toBe(withoutShape);
    });

    it('크립토', () => {
        const withoutShape = createCacheConfigFingerprint(
            JSON.stringify({
                benchmark: MARKET_FEAR_GREED_CRYPTO_BENCHMARK,
                safeHaven: MARKET_FEAR_GREED_CRYPTO_SAFE_HAVEN,
                universe: MARKET_FEAR_GREED_CRYPTO_UNIVERSE,
                lookbackDays: MARKET_FEAR_GREED_CRYPTO_LOOKBACK_DAYS,
                priceSource: 'eod-full:close,volume',
            })
        );
        expect(MARKET_FEAR_GREED_CRYPTO_CONFIG_FINGERPRINT).not.toBe(
            withoutShape
        );
    });
});
