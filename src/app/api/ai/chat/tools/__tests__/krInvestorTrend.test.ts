import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { fetchTrend, getRedisClient } = vi.hoisted(() => ({
    fetchTrend: vi.fn(),
    getRedisClient: vi.fn(),
}));
vi.mock('@/shared/cache/redisClient', () => ({ getRedisClient }));
vi.mock('@/shared/api/naver/naverInvestorTrend', () => ({
    fetchNaverInvestorTrend: fetchTrend,
}));

import {
    buildKrInvestorTrend,
    KR_TREND_FAILURE_TTL_SECONDS,
    KR_TREND_NO_DATA_TTL_SECONDS,
    KR_TREND_ROWS_SHOWN,
    loadKrInvestorTrend,
} from '@/app/api/ai/chat/tools/krInvestorTrend';
import { __resetInFlightForTests } from '@/shared/cache/getOrSetCache';
import type { NaverInvestorTrendRow } from '@/shared/api/naver/naverInvestorTrend';

/** Newest first: day 0 is the newest, foreign = n, institution = 10n, individual = 100n. */
const rows = (n: number, individualGap?: number): NaverInvestorTrendRow[] =>
    Array.from({ length: n }, (_, i) => ({
        date: `2026-10-${String(23 - i).padStart(2, '0')}`,
        foreignNet: i + 1,
        institutionNet: (i + 1) * 10,
        individualNet: i === individualGap ? null : (i + 1) * 100,
        close: 1000 + i,
    }));

describe('buildKrInvestorTrend', () => {
    it('asOf is the newest present date; sums cover the newest 5 and 20 rows', () => {
        const v = buildKrInvestorTrend(rows(20))!;
        expect(v.asOf).toBe('2026-10-23');
        // Only the newest 10 rows are shown; the sums still cover all 20.
        expect(v.rows).toHaveLength(KR_TREND_ROWS_SHOWN);
        expect(v.rows[0]!.date).toBe('2026-10-23');
        expect(v.sum5d).toEqual({
            foreignNet: 15,
            institutionNet: 150,
            individualNet: 1500,
        });
        expect(v.sum20d).toEqual({
            foreignNet: 210,
            institutionNet: 2100,
            individualNet: 21_000,
        });
        expect(v.unit).toBe('shares');
        expect(v.source).toBe('naver');
    });

    it('sums only the newest 20 rows and leaves sum20d null with fewer than 20 rows', () => {
        expect(buildKrInvestorTrend(rows(25))!.sum20d!.foreignNet).toBe(210);
        const v = buildKrInvestorTrend(rows(12))!;
        expect(v.sum20d).toBeNull();
        expect(v.sum5d!.foreignNet).toBe(15);
    });

    it('sum5d is null when fewer than 5 valid rows remain (e.g. after unreadable rows were dropped)', () => {
        const v = buildKrInvestorTrend(rows(4))!;
        expect(v.sum5d).toBeNull();
        expect(v.sum20d).toBeNull();
        expect(v.rows).toHaveLength(4);
    });

    it('a missing individual value inside a window nulls only that window sum', () => {
        const v = buildKrInvestorTrend(rows(20, 10))!;
        expect(v.sum5d!.individualNet).toBe(1500);
        expect(v.sum20d!.individualNet).toBeNull();
        expect(v.sum20d!.foreignNet).toBe(210);
    });

    it('no rows → null', () => {
        expect(buildKrInvestorTrend([])).toBeNull();
    });
});

describe('loadKrInvestorTrend', () => {
    const store = new Map<string, unknown>();
    const set = vi.fn((key: string, value: unknown, _opts?: { ex: number }) => {
        store.set(key, value);
        return 'OK';
    });

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        __resetInFlightForTests();
        store.clear();
        getRedisClient.mockReturnValue({
            get: vi.fn((key: string) => store.get(key) ?? null),
            set,
        });
    });

    it('strips the exchange suffix, builds the view and caches under the code', async () => {
        fetchTrend.mockResolvedValue(rows(20));
        const v = await loadKrInvestorTrend('005930.KS');
        expect(fetchTrend).toHaveBeenCalledWith('005930');
        expect(v?.asOf).toBe('2026-10-23');
        expect(set).toHaveBeenCalledTimes(1);
        expect(set.mock.calls[0]![0]).toContain('005930');
        await loadKrInvestorTrend('005930.KS');
        expect(fetchTrend).toHaveBeenCalledTimes(1);
    });

    it('HTTP 200 [] is a cached no-data result (null, 6h TTL, no failure log)', async () => {
        fetchTrend.mockResolvedValue([]);
        expect(await loadKrInvestorTrend('005930.KS')).toBeNull();
        expect(set).toHaveBeenCalledTimes(1);
        expect(set.mock.calls[0]![2]).toMatchObject({
            ex: KR_TREND_NO_DATA_TTL_SECONDS,
        });
        expect(console.error).not.toHaveBeenCalled();
        expect(await loadKrInvestorTrend('005930.KS')).toBeNull();
        expect(fetchTrend).toHaveBeenCalledTimes(1);
    });

    it('a thrown failure degrades to null, is logged, and is negative-cached for a short TTL', async () => {
        fetchTrend.mockRejectedValue(new Error('naver trend: HTTP 503'));
        expect(await loadKrInvestorTrend('005930.KS')).toBeNull();
        expect(console.error).toHaveBeenCalledTimes(1);
        expect(set).toHaveBeenCalledTimes(1);
        expect(set.mock.calls[0]![2]).toMatchObject({
            ex: KR_TREND_FAILURE_TTL_SECONDS,
        });
        expect(KR_TREND_FAILURE_TTL_SECONDS).toBeLessThan(
            KR_TREND_NO_DATA_TTL_SECONDS
        );
        // Within the negative-cache window the endpoint is not hit again.
        expect(await loadKrInvestorTrend('005930.KS')).toBeNull();
        expect(fetchTrend).toHaveBeenCalledTimes(1);
    });

    it('once the negative cache is gone a recovered endpoint is read again', async () => {
        fetchTrend.mockRejectedValueOnce(new Error('naver trend: HTTP 503'));
        expect(await loadKrInvestorTrend('005930.KS')).toBeNull();
        store.clear(); // TTL elapsed
        fetchTrend.mockResolvedValueOnce(rows(5));
        expect((await loadKrInvestorTrend('005930.KS'))?.rows).toHaveLength(5);
        expect(fetchTrend).toHaveBeenCalledTimes(2);
    });

    it('a non-Korean symbol is null without any request', async () => {
        expect(await loadKrInvestorTrend('AAPL')).toBeNull();
        expect(fetchTrend).not.toHaveBeenCalled();
    });
});
