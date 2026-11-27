const { mockSummary, mockE2E } = vi.hoisted(() => ({
    mockSummary: vi.fn(),
    mockE2E: vi.fn(() => false),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/shared/api/yahoo/yahooAnalystSource', () => ({
    getYahooAnalystSummary: mockSummary,
}));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2EFakeMode: mockE2E }));

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadAnalystEstimateTrend } from '@/entities/analyst-views/server/loadAnalystEstimateTrend';

const PERIOD = {
    period: '0q',
    endDate: '2026-12-31',
    epsAvg: 1.3,
    epsAnalysts: 40,
    eps7dAgo: 1.29,
    eps30dAgo: 1.25,
    eps60dAgo: 1.2,
    eps90dAgo: 1.1,
    up7d: 2,
    down7d: 0,
    up30d: 8,
    down30d: 1,
    revenueAvg: 54_000_000_000,
    revenueAnalysts: 38,
    revenueGrowth: 0.62,
};

describe('loadAnalystEstimateTrend', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockE2E.mockReturnValue(false);
    });

    it('변경 이력 없이 추정치 모듈만 요청해 기간별 추정치 변화를 만든다', async () => {
        mockSummary.mockResolvedValue({ estimates: [PERIOD] });
        const out = await loadAnalystEstimateTrend('NVDA');
        expect(mockSummary).toHaveBeenCalledWith('NVDA', {
            includeActions: false,
            includeEstimates: true,
        });
        expect(out).toHaveLength(1);
        expect(out?.[0]).toMatchObject({
            period: '0q',
            eps: { avg: 1.3, analysts: 40 },
            revisions: { up30d: 8, down30d: 1 },
            revenue: { growthPct: 62 },
        });
        expect(out?.[0]?.eps.change30d).toBeCloseTo(0.05, 10);
    });

    it('Yahoo 조회 실패(null)는 던져서 하루 캐시에 굳지 않게 한다', async () => {
        mockSummary.mockResolvedValue(null);
        await expect(loadAnalystEstimateTrend('NVDA')).rejects.toThrow(
            'Yahoo estimate trend unavailable for NVDA'
        );
    });

    it('추정치가 없으면 정상 null이고, E2E에서는 부르지 않는다', async () => {
        mockSummary.mockResolvedValue({ estimates: [] });
        await expect(loadAnalystEstimateTrend('SPY')).resolves.toBeNull();
        mockE2E.mockReturnValue(true);
        mockSummary.mockClear();
        await expect(loadAnalystEstimateTrend('NVDA')).resolves.toBeNull();
        expect(mockSummary).not.toHaveBeenCalled();
    });
});
