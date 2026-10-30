const { mockGetAssetInfoResilient, mockSetRequestLocale } = vi.hoisted(() => ({
    mockGetAssetInfoResilient: vi.fn(),
    mockSetRequestLocale: vi.fn(),
}));
vi.mock('@/entities/ticker/server/getAssetInfoResilient', () => ({
    getAssetInfoResilient: mockGetAssetInfoResilient,
}));
vi.mock('next/navigation', () => ({
    notFound: vi.fn(() => {
        throw new Error('NOT_FOUND');
    }),
}));
vi.mock('next-intl/server', async importOriginal => ({
    ...(await importOriginal<typeof import('next-intl/server')>()),
    setRequestLocale: mockSetRequestLocale,
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    enterSymbolTabMetadata,
    enterSymbolTabPage,
} from '@/app/[locale]/[symbol]/_lib/symbolTabEntry';

const APPLE = { symbol: 'AAPL', name: 'Apple Inc.', fmpSymbol: 'AAPL' };

const params = (locale: string, symbol: string) =>
    Promise.resolve({ locale, symbol });

describe('enterSymbolTabMetadata', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: APPLE,
            degraded: false,
        });
    });

    it('대문자 티커·로케일·자산 판정을 돌려준다', async () => {
        const entry = await enterSymbolTabMetadata(params('en', 'aapl'));

        expect(entry).toMatchObject({
            locale: 'en',
            ticker: 'AAPL',
            assetInfo: APPLE,
            degraded: false,
        });
        expect(mockGetAssetInfoResilient).toHaveBeenCalledWith('AAPL');
    });

    it('SEO 번역자는 URL 로케일의 카탈로그를 읽는다', async () => {
        const { tSeo } = await enterSymbolTabMetadata(params('en', 'AAPL'));
        const { tSeo: tSeoKo } = await enterSymbolTabMetadata(
            params('ko', 'AAPL')
        );

        expect(tSeo('symbol.chart.titleCore')).not.toBe(
            tSeoKo('symbol.chart.titleCore')
        );
    });

    it('형상이 틀린 세그먼트는 자산을 조회하지 않고 notFound()', async () => {
        await expect(
            enterSymbolTabMetadata(params('ko', '!!!bad'))
        ).rejects.toThrow('NOT_FOUND');
        expect(mockGetAssetInfoResilient).not.toHaveBeenCalled();
    });

    it('존재하지 않는 심볼은 notFound()', async () => {
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: null,
            degraded: false,
        });

        await expect(
            enterSymbolTabMetadata(params('ko', 'ZZZQ'))
        ).rejects.toThrow('NOT_FOUND');
    });
});

describe('enterSymbolTabPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('요청 로케일을 원문 세그먼트로 등록하고 대문자 티커·원문 세그먼트를 돌려준다', async () => {
        await expect(enterSymbolTabPage(params('ja', 'aapl'))).resolves.toEqual(
            { locale: 'ja', ticker: 'AAPL', segment: 'aapl' }
        );
        expect(mockSetRequestLocale).toHaveBeenCalledWith('ja');
    });

    it('형상이 틀린 세그먼트는 notFound()', async () => {
        await expect(
            enterSymbolTabPage(params('ko', '!!!bad'))
        ).rejects.toThrow('NOT_FOUND');
    });
});
