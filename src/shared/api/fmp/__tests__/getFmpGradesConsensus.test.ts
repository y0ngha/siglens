const { fmpGet, e2e, providerGrades, getOrSetCache } = vi.hoisted(() => ({
    fmpGet: vi.fn(),
    e2e: { value: false },
    providerGrades: vi.fn(),
    getOrSetCache: vi.fn(
        async (_key: string, _ttl: number, fetcher: () => Promise<unknown>) =>
            fetcher()
    ),
}));
vi.mock('@/shared/api/fmp/httpClient', () => ({ fmpGet }));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: () => e2e.value }));
vi.mock('@/shared/cache/getOrSetCache', () => ({ getOrSetCache }));
vi.mock('@/shared/api/fmp/getFundamentalDataProvider', () => ({
    getFundamentalDataProvider: () => ({ getGradesConsensus: providerGrades }),
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getFmpGradesConsensus } from '@/shared/api/fmp/getFmpGradesConsensus';

const ROW = { strongBuy: 40, buy: 70, hold: 32, sell: 2, strongSell: 1 };

describe('getFmpGradesConsensus', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        e2e.value = false;
        fmpGet.mockResolvedValue([ROW]);
    });

    it('FMP 자체 값을 원래 Redis 키(버전 없음)로 캐시해 읽는다 — Yahoo를 거치지 않는다', async () => {
        await expect(getFmpGradesConsensus('aapl')).resolves.toEqual(ROW);
        expect(getOrSetCache).toHaveBeenCalledWith(
            'fundamental:grades-consensus:AAPL',
            expect.any(Number),
            expect.any(Function)
        );
        expect(fmpGet).toHaveBeenCalledWith('grades-consensus', {
            symbol: 'aapl',
        });
        expect(providerGrades).not.toHaveBeenCalled();
    });

    it('FMP 행이 없으면 null', async () => {
        fmpGet.mockResolvedValue([]);
        await expect(getFmpGradesConsensus('SPY')).resolves.toBeNull();
    });

    it('E2E에서는 네트워크에 나가지 않고 기존 fake 프로바이더 경로를 탄다', async () => {
        e2e.value = true;
        providerGrades.mockResolvedValue(ROW);
        await expect(getFmpGradesConsensus('AAPL')).resolves.toEqual(ROW);
        expect(fmpGet).not.toHaveBeenCalled();
        expect(getOrSetCache).not.toHaveBeenCalled();
    });
});
