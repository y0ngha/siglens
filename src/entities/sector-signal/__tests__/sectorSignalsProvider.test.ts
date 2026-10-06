import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CRYPTO_SESSION, US_EQUITY_SESSION } from '@y0ngha/siglens-core';

vi.mock('server-only', () => ({}));

const { cachedProvider, rawProvider, mockGetCached, mockRawFor } = vi.hoisted(
    () => {
        const cachedProvider = { kind: 'cached' };
        const rawProvider = { kind: 'raw' };
        return {
            cachedProvider,
            rawProvider,
            mockGetCached: vi.fn(() => cachedProvider),
            mockRawFor: vi.fn(() => rawProvider),
        };
    }
);

vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: mockGetCached,
}));
vi.mock('@/shared/api/market/getMarketDataProvider', () => ({
    marketDataProviderFor: mockRawFor,
    scopeUsesFmp: (scope: string) => scope !== 'kr',
}));

import { sectorSignalsProviderFor } from '../api/sectorSignalsProvider';
import { KR_EQUITY_SESSION } from '@/shared/api/market/sessionSpecFor';

describe('sectorSignalsProviderFor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('미국 일봉 스캔은 미국 세션의 캐시 provider를 쓴다(eodhist 공유)', () => {
        expect(sectorSignalsProviderFor('us', '1Day')).toBe(cachedProvider);
        expect(mockGetCached).toHaveBeenCalledWith(US_EQUITY_SESSION);
        expect(mockRawFor).not.toHaveBeenCalled();
    });

    it('FMP scope의 인트라데이도 캐시 provider(날짜 단위 히스토리/tail 분리)', () => {
        expect(sectorSignalsProviderFor('us', '15Min')).toBe(cachedProvider);
        expect(sectorSignalsProviderFor('crypto', '1Hour')).toBe(
            cachedProvider
        );
        expect(mockGetCached).toHaveBeenLastCalledWith(CRYPTO_SESSION);
    });

    it('KR 일봉은 KRX 세션의 캐시 provider를 쓴다', () => {
        expect(sectorSignalsProviderFor('kr', '1Day')).toBe(cachedProvider);
        expect(mockGetCached).toHaveBeenCalledWith(KR_EQUITY_SESSION);
    });

    it('KR 인트라데이는 raw provider — 밀리초 from이 단일 키를 매번 바꿔 읽히지 않는 SET만 생긴다', () => {
        expect(sectorSignalsProviderFor('kr', '1Hour')).toBe(rawProvider);
        expect(mockRawFor).toHaveBeenCalledWith('kr');
        expect(mockGetCached).not.toHaveBeenCalled();
    });
});
