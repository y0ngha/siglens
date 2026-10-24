import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getYahooFundamentals, getOrSetCache, chart } = vi.hoisted(() => ({
    getYahooFundamentals: vi.fn(),
    getOrSetCache: vi.fn(),
    chart: vi.fn(),
}));
vi.mock('@/shared/api/yahoo/yahooFundamentalSource', () => ({
    getYahooFundamentals,
}));
vi.mock('@/shared/api/yahoo/createYahooClient', () => ({
    getYahooClient: () => ({ chart }),
}));
vi.mock('@/shared/cache/getOrSetCache', () => ({ getOrSetCache }));

import { getYahooDividendData } from '@/shared/api/yahoo/yahooDividendSource';
import { FMP_FUNDAMENTAL_CACHE_TTL_SECONDS } from '@/shared/config/time';

const NULL_SUMMARY = {
    dividendRate: null,
    trailingAnnualDividendRate: null,
    dividendYield: null,
    trailingAnnualDividendYield: null,
    exDividendDate: null,
    lastDividendValue: null,
    lastDividendDate: null,
};

type Fetcher = () => Promise<unknown>;
type ShouldCache = (value: unknown) => boolean;

describe('getYahooDividendData', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getOrSetCache.mockImplementation(
            async (_k: string, _t: number, fetcher: Fetcher) => fetcher()
        );
        chart.mockResolvedValue({ quotes: [], events: { dividends: [] } });
        getYahooFundamentals.mockResolvedValue({ summary: {} });
    });

    it('chart events=div 이력을 ISO 날짜·최신순으로 읽고 v2 키로 캐시한다', async () => {
        chart.mockResolvedValue({
            events: {
                dividends: [
                    { date: new Date('2025-08-04T00:00:00Z'), amount: 250 },
                    { date: new Date('2026-08-12T00:00:00Z'), amount: 270 },
                    { date: 'bad', amount: 1 },
                    { date: new Date('2026-03-30T00:00:00Z'), amount: null },
                ],
            },
        });
        const r = await getYahooDividendData('032640.ks');
        expect(getOrSetCache).toHaveBeenCalledWith(
            'dividends:yahoo:v2:032640.KS',
            FMP_FUNDAMENTAL_CACHE_TTL_SECONDS,
            expect.any(Function),
            expect.any(Function)
        );
        expect(chart).toHaveBeenCalledWith(
            '032640.KS',
            expect.objectContaining({ events: 'div', interval: '1mo' }),
            expect.anything()
        );
        expect(r?.history).toEqual([
            { exDate: '2026-08-12', amount: 270 },
            { exDate: '2025-08-04', amount: 250 },
        ]);
    });

    it('UTC 자정 epoch 이벤트는 서울 날짜와 같은 ex-date로 읽는다(실측 032640.KS 1786492800)', async () => {
        chart.mockResolvedValue({
            events: {
                dividends: [{ date: new Date(1786492800 * 1000), amount: 270 }],
            },
        });
        expect((await getYahooDividendData('032640.KS')).history).toEqual([
            { exDate: '2026-08-12', amount: 270 },
        ]);
    });

    it('events가 없으면 이력은 빈 배열이다', async () => {
        chart.mockResolvedValue({ quotes: [] });
        expect((await getYahooDividendData('X.KS'))?.history).toEqual([]);
    });

    it('summaryDetail·defaultKeyStatistics도 함께 읽는다', async () => {
        getYahooFundamentals.mockResolvedValue({
            summary: {
                summaryDetail: {
                    trailingAnnualDividendRate: 1444,
                    exDividendDate: new Date('2026-09-29T00:00:00Z'),
                },
                defaultKeyStatistics: { lastDividendValue: 361 },
            },
        });
        const r = await getYahooDividendData('005930.KS');
        expect(r?.summary).toEqual({
            ...NULL_SUMMARY,
            trailingAnnualDividendRate: 1444,
            exDividendDate: '2026-09-29',
            lastDividendValue: 361,
        });
    });

    it('이력 조회가 실패하면 summary만 돌려주고 그 결과는 캐시하지 않는다', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        chart.mockRejectedValue(new Error('429'));
        let shouldCache: ShouldCache | undefined;
        getOrSetCache.mockImplementation(
            async (
                _k: string,
                _t: number,
                fetcher: Fetcher,
                should: ShouldCache
            ) => {
                shouldCache = should;
                return fetcher();
            }
        );
        const r = await getYahooDividendData('032640.KS');
        expect(r).toEqual({ history: null, summary: NULL_SUMMARY });
        expect(shouldCache?.(r)).toBe(false);
        expect(shouldCache?.({ history: [], summary: null })).toBe(true);
        warn.mockRestore();
    });

    it('이력도 요약도 없으면 fetcher가 reject해 캐시 쓰기를 건너뛰고 호출부로 전파된다', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        chart.mockRejectedValue(new Error('down'));
        getYahooFundamentals.mockResolvedValue({ summary: null });
        let captured: Fetcher | undefined;
        getOrSetCache.mockImplementation(
            async (_k: string, _t: number, fetcher: Fetcher) => {
                captured = fetcher;
                return fetcher();
            }
        );
        await expect(getYahooDividendData('032640.KS')).rejects.toThrow();
        await expect(captured?.()).rejects.toThrow();
        warn.mockRestore();
    });
});
