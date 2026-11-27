const { getYahooAnalystSummary, fmpGet } = vi.hoisted(() => ({
    getYahooAnalystSummary: vi.fn(),
    fmpGet: vi.fn(),
}));
vi.mock('@/shared/api/yahoo/yahooAnalystSource', () => ({
    getYahooAnalystSummary,
}));
vi.mock('@/shared/api/fmp/httpClient', () => ({ fmpGet }));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CurrentGradesFmpClient } from '@/shared/api/fmp/CurrentGradesFmpClient';

const FMP_ROW = { strongBuy: 40, buy: 70, hold: 32, sell: 2, strongSell: 1 };
const withTrend = (trend: unknown) => ({
    targets: {},
    trend,
    actions: null,
    earnings: null,
});

describe('CurrentGradesFmpClient.getGradesConsensus', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fmpGet.mockResolvedValue([FMP_ROW]);
    });

    it('Yahoo 분포가 있으면 가벼운 요약(이력 없음)으로 읽어 source: yahoo로 돌려준다', async () => {
        getYahooAnalystSummary.mockResolvedValue(
            withTrend({
                strongBuy: 13,
                buy: 20,
                hold: 10,
                sell: 2,
                strongSell: 0,
            })
        );
        await expect(
            new CurrentGradesFmpClient().getGradesConsensus('AAPL')
        ).resolves.toEqual({
            strongBuy: 13,
            buy: 20,
            hold: 10,
            sell: 2,
            strongSell: 0,
            source: 'yahoo',
        });
        expect(getYahooAnalystSummary).toHaveBeenCalledWith('AAPL', {
            includeActions: false,
        });
        expect(fmpGet).not.toHaveBeenCalled();
    });

    it('Yahoo가 빈 결과면 FMP 값을 source: fmp로 돌려준다', async () => {
        getYahooAnalystSummary.mockResolvedValue(withTrend(null));
        await expect(
            new CurrentGradesFmpClient().getGradesConsensus('SPY')
        ).resolves.toEqual({ ...FMP_ROW, source: 'fmp' });
        expect(fmpGet).toHaveBeenCalledWith('grades-consensus', {
            symbol: 'SPY',
        });
    });

    it('Yahoo가 빈 결과이고 FMP도 행이 없으면 null', async () => {
        getYahooAnalystSummary.mockResolvedValue(withTrend(null));
        fmpGet.mockResolvedValue([]);
        await expect(
            new CurrentGradesFmpClient().getGradesConsensus('SPY')
        ).resolves.toBeNull();
    });

    it('Yahoo가 실패하면 던지지 않고 FMP 값을 source: fmp + yahooFailed로 돌려준다', async () => {
        getYahooAnalystSummary.mockResolvedValue(null);
        await expect(
            new CurrentGradesFmpClient().getGradesConsensus('AAPL')
        ).resolves.toEqual({ ...FMP_ROW, source: 'fmp', yahooFailed: true });
    });

    it('Yahoo가 실패하고 FMP도 던지면 FMP 오류가 전파된다(종전 동작)', async () => {
        getYahooAnalystSummary.mockResolvedValue(null);
        fmpGet.mockRejectedValue(new Error('fmp down'));
        await expect(
            new CurrentGradesFmpClient().getGradesConsensus('AAPL')
        ).rejects.toThrow('fmp down');
    });
});
