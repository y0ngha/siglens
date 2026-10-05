import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetAssetInfoResilient } = vi.hoisted(() => ({
    mockGetAssetInfoResilient: vi.fn(),
}));
vi.mock('@/entities/ticker/lib/getAssetInfoResilient', () => ({
    getAssetInfoResilient: mockGetAssetInfoResilient,
}));
vi.mock('next/navigation', () => ({
    notFound: vi.fn(() => {
        throw new Error('NOT_FOUND');
    }),
}));

import { requireResolvableAsset } from '@/app/[locale]/[symbol]/requireResolvableAsset';

const APPLE = { symbol: 'AAPL', name: 'Apple Inc.' };

describe('requireResolvableAsset', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('정상 조회는 assetInfo와 degraded를 그대로 돌려준다', async () => {
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: APPLE,
            degraded: false,
        });

        await expect(requireResolvableAsset('AAPL')).resolves.toEqual({
            assetInfo: APPLE,
            degraded: false,
        });
    });

    it('실재하지 않는 종목(assetInfo null)은 notFound()', async () => {
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: null,
            degraded: false,
        });

        await expect(requireResolvableAsset('INVALIDTICKER1')).rejects.toThrow(
            'NOT_FOUND'
        );
    });

    it('장애 폴백이어도 미국 티커 형상이면 통과한다 — 200 + noindex는 호출부가 맡는다', async () => {
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: { symbol: 'MSFT', name: 'MSFT' },
            degraded: true,
        });

        await expect(requireResolvableAsset('MSFT')).resolves.toMatchObject({
            degraded: true,
        });
    });

    it('장애 폴백 + 형상도 못 살리는 심볼(숫자로 시작하는 크립토)은 notFound()', async () => {
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: { symbol: '1INCHUSD', name: '1INCHUSD' },
            degraded: true,
        });

        await expect(requireResolvableAsset('1INCHUSD')).rejects.toThrow(
            'NOT_FOUND'
        );
    });

    it('장애 폴백이어도 국내 상장 형상은 통과한다', async () => {
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: { symbol: '005930.KS', name: '005930.KS' },
            degraded: true,
        });

        await expect(
            requireResolvableAsset('005930.KS')
        ).resolves.toMatchObject({
            degraded: true,
        });
    });
});
