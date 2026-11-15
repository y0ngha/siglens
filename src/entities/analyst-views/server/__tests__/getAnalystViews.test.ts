import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getYahooAnalystSummary, getProvider } = vi.hoisted(() => ({
    getYahooAnalystSummary: vi.fn(),
    getProvider: vi.fn(),
}));
vi.mock('@/shared/api/yahoo/yahooAnalystSource', () => ({
    getYahooAnalystSummary,
}));
vi.mock('@/shared/api/fmp/getFundamentalDataProvider', () => ({
    getFundamentalDataProvider: getProvider,
}));

import { getAnalystViews } from '@/entities/analyst-views/server/getAnalystViews';

const YAHOO = {
    targets: { mean: 100, median: 100, low: 80, high: 120, analysts: 20 },
    trend: { strongBuy: 5, buy: 5, hold: 5, sell: 0, strongSell: 0 },
    actions: [],
    earnings: null,
};
const CONSENSUS = {
    targetConsensus: 130,
    targetMedian: 125,
    targetLow: 90,
    targetHigh: 150,
};
const SUMMARY = {
    lastMonth: { avgPriceTarget: 128 },
    lastQuarter: { avgPriceTarget: 126 },
    lastYear: { avgPriceTarget: 110 },
};

function provider(over: Record<string, unknown> = {}) {
    return {
        getPriceTargetConsensus: vi.fn().mockResolvedValue(CONSENSUS),
        getPriceTargetSummary: vi.fn().mockResolvedValue(SUMMARY),
        ...over,
    };
}

describe('getAnalystViews', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getYahooAnalystSummary.mockResolvedValue(YAHOO);
        getProvider.mockReturnValue(provider());
    });

    it('미국 종목: 이력을 포함해 Yahoo를 부르고 FMP 목표가를 병기한다', async () => {
        const v = await getAnalystViews('NVDA');
        expect(getYahooAnalystSummary).toHaveBeenCalledWith('NVDA', {
            includeActions: true,
        });
        expect(v.targets.yahoo?.mean).toBe(100);
        expect(v.targets.fmp?.consensus).toBe(130);
        expect(v.targets.sourcesDisagree).toBe(true);
        expect(v.actions.available).toBe(true);
        expect(v.degraded).toEqual([]);
    });

    it('한국 종목: 이력 없이 Yahoo만, FMP는 부르지도 degraded에 올리지도 않는다', async () => {
        const v = await getAnalystViews('005930.KS');
        expect(getYahooAnalystSummary).toHaveBeenCalledWith('005930.KS', {
            includeActions: false,
        });
        expect(getProvider).not.toHaveBeenCalled();
        expect(v.targets.fmp).toBeNull();
        expect(v.earnings).toBeNull();
        expect(v.actions.available).toBe(false);
        expect(v.degraded).toEqual([]);
    });

    it('한국 종목에서 Yahoo가 null이면 yahoo만 degraded', async () => {
        getYahooAnalystSummary.mockResolvedValue(null);
        const v = await getAnalystViews('005930.KS');
        expect(v.degraded).toEqual(['yahoo']);
    });

    it('FMP가 거부하면 Yahoo만으로 채우고 fmp를 degraded에 적는다', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        getProvider.mockReturnValue(
            provider({
                getPriceTargetConsensus: vi
                    .fn()
                    .mockRejectedValue(new Error('x')),
            })
        );
        const v = await getAnalystViews('NVDA');
        expect(v.targets.yahoo?.mean).toBe(100);
        expect(v.targets.fmp).toBeNull();
        expect(v.degraded).toEqual(['fmp']);
        warn.mockRestore();
    });

    it('프로바이더 생성이 동기적으로 던져도 던지지 않고 fmp degraded', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        getProvider.mockImplementation(() => {
            throw new Error('construction');
        });
        const v = await getAnalystViews('NVDA');
        expect(v.degraded).toEqual(['fmp']);
        warn.mockRestore();
    });

    it('Yahoo가 null이면 FMP만으로 채우고 yahoo를 degraded에 적는다', async () => {
        getYahooAnalystSummary.mockResolvedValue(null);
        const v = await getAnalystViews('NVDA');
        expect(v.targets.fmp?.consensus).toBe(130);
        expect(v.targets.yahoo).toBeNull();
        expect(v.degraded).toEqual(['yahoo']);
    });

    it('FMP에 목표가가 단순히 없으면(null) degraded가 아니다', async () => {
        getProvider.mockReturnValue(
            provider({
                getPriceTargetConsensus: vi.fn().mockResolvedValue(null),
                getPriceTargetSummary: vi.fn().mockResolvedValue(null),
            })
        );
        const v = await getAnalystViews('LAES');
        expect(v.targets.fmp).toBeNull();
        expect(v.degraded).toEqual([]);
    });

    it("detail 'lite': 이력 모듈과 FMP 기간 평균을 요청하지 않고 목표가·분포는 그대로 채운다", async () => {
        const consensus = vi.fn().mockResolvedValue(CONSENSUS);
        const summary = vi.fn().mockResolvedValue(SUMMARY);
        getProvider.mockReturnValue(
            provider({
                getPriceTargetConsensus: consensus,
                getPriceTargetSummary: summary,
            })
        );
        getYahooAnalystSummary.mockResolvedValue({ ...YAHOO, actions: null });
        const v = await getAnalystViews('NVDA', { detail: 'lite' });
        expect(getYahooAnalystSummary).toHaveBeenCalledWith('NVDA', {
            includeActions: false,
        });
        expect(consensus).toHaveBeenCalledTimes(1);
        expect(summary).not.toHaveBeenCalled();
        expect(v.targets.fmp?.consensus).toBe(130);
        expect(v.targets.fmp?.lastMonth.avg).toBeNull();
        expect(v.ratings?.analysts).toBe(15);
        expect(v.actions.available).toBe(false);
        expect(v.actions.tally).toBeNull();
        expect(v.degraded).toEqual([]);
    });

    it("기본(detail 생략)은 'full'과 같다", async () => {
        const summary = vi.fn().mockResolvedValue(SUMMARY);
        getProvider.mockReturnValue(
            provider({ getPriceTargetSummary: summary })
        );
        await getAnalystViews('NVDA');
        expect(summary).toHaveBeenCalledTimes(1);
        expect(getYahooAnalystSummary).toHaveBeenCalledWith('NVDA', {
            includeActions: true,
        });
    });

    it('Yahoo가 실패하면(null) 이력 집계는 null이고 yahoo가 degraded', async () => {
        getYahooAnalystSummary.mockResolvedValue(null);
        const v = await getAnalystViews('NVDA');
        expect(v.actions.available).toBe(false);
        expect(v.actions.tally).toBeNull();
        expect(v.degraded).toContain('yahoo');
    });
});
