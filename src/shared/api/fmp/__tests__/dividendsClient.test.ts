import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fmpGet, getOrSetCache } = vi.hoisted(() => ({
    fmpGet: vi.fn(),
    getOrSetCache: vi.fn(),
}));
vi.mock('@/shared/api/fmp/httpClient', () => ({ fmpGet }));
vi.mock('@/shared/cache/getOrSetCache', () => ({ getOrSetCache }));

import {
    getFmpDividendHistory,
    normalizeDividendRows,
} from '@/shared/api/fmp/dividendsClient';
import { FMP_FUNDAMENTAL_CACHE_TTL_SECONDS } from '@/shared/config/time';

describe('normalizeDividendRows', () => {
    it('원 금액(dividend)을 쓰고 최신 배당락일 순으로 정렬한다', () => {
        expect(
            normalizeDividendRows([
                {
                    date: '2026-02-09',
                    paymentDate: '2026-02-12',
                    dividend: 0.26,
                    adjDividend: 0.2,
                },
                { date: '2026-05-11', paymentDate: null, dividend: 0.27 },
            ])
        ).toEqual([
            { exDate: '2026-05-11', payDate: null, amount: 0.27 },
            { exDate: '2026-02-09', payDate: '2026-02-12', amount: 0.26 },
        ]);
    });

    it('일부 행만 깨졌으면 깨진 행만 버린다', () => {
        expect(
            normalizeDividendRows([
                { date: 'bad', dividend: 1 },
                { date: '2026-01-02', dividend: 0.5 },
            ])
        ).toEqual([{ exDate: '2026-01-02', payDate: null, amount: 0.5 }]);
    });

    it('진짜 빈 배열만 이력 없음([])이다', () => {
        expect(normalizeDividendRows([])).toEqual([]);
    });

    it('배열이 아닌 본문은 throw한다', () => {
        expect(() =>
            normalizeDividendRows({ 'Error Message': 'Limit Reach' })
        ).toThrow();
    });

    it('행이 있는데 전부 깨졌으면 throw한다', () => {
        expect(() =>
            normalizeDividendRows([
                { date: 'bad', dividend: 1 },
                { date: '2026-01-01', dividend: null },
                null,
            ])
        ).toThrow();
    });
});

describe('getFmpDividendHistory', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getOrSetCache.mockImplementation(
            async (_k: string, _t: number, fetcher: () => Promise<unknown>) =>
                fetcher()
        );
    });

    it('심볼별 24h 키로 캐시하고 대문자 심볼로 dividends를 부른다', async () => {
        fmpGet.mockResolvedValue([{ date: '2026-05-19', dividend: 0.6 }]);
        const rows = await getFmpDividendHistory('fer');
        expect(getOrSetCache).toHaveBeenCalledWith(
            'dividends:FER',
            FMP_FUNDAMENTAL_CACHE_TTL_SECONDS,
            expect.any(Function)
        );
        expect(fmpGet).toHaveBeenCalledWith('dividends', { symbol: 'FER' });
        expect(rows).toEqual([
            { exDate: '2026-05-19', payDate: null, amount: 0.6 },
        ]);
    });

    it('fetcher는 깨진 본문에서 reject해 캐시 쓰기를 건너뛰게 한다', async () => {
        let captured: (() => Promise<unknown>) | undefined;
        getOrSetCache.mockImplementation(
            async (_k: string, _t: number, fetcher: () => Promise<unknown>) => {
                captured = fetcher;
                return [];
            }
        );
        await getFmpDividendHistory('AAPL');
        fmpGet.mockResolvedValue({ 'Error Message': 'x' });
        await expect(captured?.()).rejects.toThrow();
        fmpGet.mockResolvedValue([]);
        await expect(captured?.()).resolves.toEqual([]);
    });

    it('FMP 장애는 삼키지 않고 전파한다', async () => {
        fmpGet.mockRejectedValue(new Error('down'));
        await expect(getFmpDividendHistory('AAPL')).rejects.toThrow('down');
    });
});
