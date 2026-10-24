import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getYahooFundamentals, getOrSetCache } = vi.hoisted(() => ({
    getYahooFundamentals: vi.fn(),
    getOrSetCache: vi.fn(),
}));
vi.mock('@/shared/api/yahoo/yahooFundamentalSource', () => ({
    getYahooFundamentals,
}));
vi.mock('@/shared/cache/getOrSetCache', () => ({ getOrSetCache }));

import { getYahooDividendSummary } from '@/shared/api/yahoo/yahooDividendSource';
import { FMP_FUNDAMENTAL_CACHE_TTL_SECONDS } from '@/shared/config/time';

describe('getYahooDividendSummary', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getOrSetCache.mockImplementation(
            async (_k: string, _t: number, fetcher: () => Promise<unknown>) =>
                fetcher()
        );
    });

    it('summaryDetail·defaultKeyStatistics를 읽어 날짜를 ISO로 바꾼다', async () => {
        getYahooFundamentals.mockResolvedValue({
            summary: {
                summaryDetail: {
                    dividendRate: 1444,
                    trailingAnnualDividendRate: 1444,
                    dividendYield: 0.02,
                    trailingAnnualDividendYield: 0.0206,
                    exDividendDate: new Date('2026-09-29T00:00:00Z'),
                },
                defaultKeyStatistics: {
                    lastDividendValue: 361,
                    lastDividendDate: new Date('2026-09-29T00:00:00Z'),
                },
            },
        });
        const r = await getYahooDividendSummary('005930.ks');
        expect(getOrSetCache).toHaveBeenCalledWith(
            'dividends:yahoo:005930.KS',
            FMP_FUNDAMENTAL_CACHE_TTL_SECONDS,
            expect.any(Function)
        );
        expect(r).toEqual({
            dividendRate: 1444,
            trailingAnnualDividendRate: 1444,
            dividendYield: 0.02,
            trailingAnnualDividendYield: 0.0206,
            exDividendDate: '2026-09-29',
            lastDividendValue: 361,
            lastDividendDate: '2026-09-29',
        });
    });

    it('필드가 없으면 전부 null인 객체다', async () => {
        getYahooFundamentals.mockResolvedValue({ summary: {} });
        expect(await getYahooDividendSummary('005930.KS')).toEqual({
            dividendRate: null,
            trailingAnnualDividendRate: null,
            dividendYield: null,
            trailingAnnualDividendYield: null,
            exDividendDate: null,
            lastDividendValue: null,
            lastDividendDate: null,
        });
    });

    it('yahoo 요약이 없으면 null을 돌려주고 캐시에 쓰지 않는다(fetcher가 throw)', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        getYahooFundamentals.mockResolvedValue({ summary: null });
        expect(await getYahooDividendSummary('005930.KS')).toBeNull();
        warn.mockRestore();
    });

    it('fetcher는 yahoo 요약이 없으면 reject해 캐시 쓰기를 건너뛰게 한다', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        let captured: (() => Promise<unknown>) | undefined;
        getOrSetCache.mockImplementation(
            async (_k: string, _t: number, fetcher: () => Promise<unknown>) => {
                captured = fetcher;
                return null;
            }
        );
        await getYahooDividendSummary('005930.KS');
        getYahooFundamentals.mockResolvedValue({ summary: null });
        await expect(captured?.()).rejects.toThrow();
        getYahooFundamentals.mockResolvedValue({ summary: {} });
        await expect(captured?.()).resolves.toMatchObject({
            dividendRate: null,
        });
        warn.mockRestore();
    });
});
