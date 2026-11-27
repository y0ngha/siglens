const { getAnalystViews } = vi.hoisted(() => ({ getAnalystViews: vi.fn() }));
vi.mock('@/entities/analyst-views/server/getAnalystViews', () => ({
    getAnalystViews,
}));

const { isE2EFakeMode } = vi.hoisted(() => ({ isE2EFakeMode: vi.fn() }));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2EFakeMode }));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadAnalystTargetsSummary } from '@/entities/analyst-views/server/loadAnalystTargetsSummary';

const views = (degraded: string[] = [], mean: number | null = 276.56) => ({
    targets: {
        yahoo: { mean, median: null, low: null, high: null, analysts: 53 },
        fmp: null,
        gapPct: 12,
        sourcesDisagree: true,
    },
    degraded,
});

describe('loadAnalystTargetsSummary', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        isE2EFakeMode.mockReturnValue(false);
    });

    it("미국 종목: 가벼운 조회('lite')로 부르고 요약을 돌려준다", async () => {
        getAnalystViews.mockResolvedValue(views());
        await expect(loadAnalystTargetsSummary('AAPL')).resolves.toEqual({
            yahooMean: 276.56,
            yahooAnalysts: 53,
        });
        expect(getAnalystViews).toHaveBeenCalledWith('AAPL', {
            detail: 'lite',
        });
    });

    it('Yahoo가 실패했으면 던진다(하루 캐시에 일시 장애가 굳지 않게)', async () => {
        getAnalystViews.mockResolvedValue(views(['yahoo'], null));
        await expect(loadAnalystTargetsSummary('AAPL')).rejects.toThrow(
            /unavailable/
        );
    });

    it('FMP만 실패한 경우는 던지지 않는다', async () => {
        getAnalystViews.mockResolvedValue(views(['fmp']));
        await expect(loadAnalystTargetsSummary('AAPL')).resolves.not.toBeNull();
    });

    it('Yahoo에 데이터가 없으면(ETF 등) 던지지 않고 null', async () => {
        getAnalystViews.mockResolvedValue(views([], null));
        await expect(loadAnalystTargetsSummary('SPY')).resolves.toBeNull();
    });

    it('한국 종목은 호출하지 않고 null', async () => {
        await expect(
            loadAnalystTargetsSummary('005930.KS')
        ).resolves.toBeNull();
        expect(getAnalystViews).not.toHaveBeenCalled();
    });

    it('E2E fake 모드에서는 호출도 오류도 없이 null', async () => {
        isE2EFakeMode.mockReturnValue(true);
        getAnalystViews.mockResolvedValue(views(['yahoo'], null));
        await expect(loadAnalystTargetsSummary('AAPL')).resolves.toBeNull();
        expect(getAnalystViews).not.toHaveBeenCalled();
    });
});
