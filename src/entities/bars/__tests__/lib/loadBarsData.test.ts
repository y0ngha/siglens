// MISTAKES §17: all vi.mock + vi.hoisted declarations must come before imports.
const { mockGetCachedBarsWithIndicators, mockGetTranslations } = vi.hoisted(
    () => ({
        mockGetCachedBarsWithIndicators: vi.fn(),
        mockGetTranslations: vi.fn(),
    })
);

vi.mock('server-only', () => ({}));
vi.mock('next-intl/server', () => ({
    getTranslations: mockGetTranslations,
}));
vi.mock('@/entities/bars/lib/barsDataCache', () => ({
    getCachedBarsWithIndicators: mockGetCachedBarsWithIndicators,
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: vi.fn(() => ({})),
}));
vi.mock('@/shared/api/market/sessionSpecFor', () => ({
    sessionSpecFor: vi.fn(() => ({})),
}));

import { describe, expect, it, vi } from 'vitest';
import { loadBarsData } from '@/entities/bars/lib/loadBarsData';
import { FmpHttpError } from '@/shared/api/fmp/FmpHttpError';

const resolveProfile = vi.fn(async () => 'us-equity' as const);

describe('loadBarsData 실패 경로', () => {
    it('FMP 429는 번역된 사용자 문구로 바꿔 던지고 원래 에러를 cause로 남긴다', async () => {
        const fmpError = new FmpHttpError('historical', 429, null, 'ATGSF');
        mockGetCachedBarsWithIndicators.mockRejectedValue(fmpError);
        mockGetTranslations.mockResolvedValue((key: string) => `t:${key}`);

        const thrown = await loadBarsData(
            'ATGSF',
            '1Day',
            undefined,
            resolveProfile
        ).catch((e: unknown) => e);

        expect(thrown).toBeInstanceOf(Error);
        expect((thrown as Error).message).toBe('t:shared.api.fmpBusy');
        expect((thrown as Error).cause).toBe(fmpError);
    });

    /**
     * `unstable_cache` 콜백 안에서는 로케일이 안 보이면 next-intl이 `headers()`로 물러나 Next가
     * 거부한다(2026-10-07 운영 `/[symbol]/fear-greed` generateMetadata). 그 번역 실패가 원래
     * FMP 에러를 덮으면 안 된다.
     */
    it('번역자를 만들지 못하면 원래 FMP 에러를 그대로 던진다', async () => {
        const fmpError = new FmpHttpError('historical', 429, null, 'ATGSF');
        mockGetCachedBarsWithIndicators.mockRejectedValue(fmpError);
        mockGetTranslations.mockRejectedValue(
            new Error(
                'Route /[locale]/[symbol]/fear-greed used `headers()` inside a function cached with `unstable_cache()`.'
            )
        );

        await expect(
            loadBarsData('ATGSF', '1Day', undefined, resolveProfile)
        ).rejects.toBe(fmpError);
    });

    it('사용자 문구가 없는 에러는 번역 없이 그대로 던진다', async () => {
        const plain = new Error('redis down');
        mockGetCachedBarsWithIndicators.mockRejectedValue(plain);
        mockGetTranslations.mockResolvedValue((key: string) => `t:${key}`);

        await expect(
            loadBarsData('AAPL', '1Day', undefined, resolveProfile)
        ).rejects.toBe(plain);
    });
});
