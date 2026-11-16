import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { yahoo, e2e } = vi.hoisted(() => ({
    yahoo: { summary: vi.fn() },
    e2e: { fake: false },
}));
vi.mock('@/shared/api/yahoo/yahooAnalystSource', () => ({
    getYahooAnalystSummary: yahoo.summary,
}));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2EFakeMode: () => e2e.fake }));

import { getAnalystActionHistory } from '../getAnalystActionHistory';

const summary = (actions: unknown[]) => ({
    targets: {
        mean: null,
        median: null,
        low: null,
        high: null,
        analysts: null,
    },
    trend: null,
    actions,
    earnings: null,
});

beforeEach(() => {
    yahoo.summary.mockReset();
    e2e.fake = false;
});

describe('getAnalystActionHistory', () => {
    it('Yahoo 이력을 변경 이력 행(최신순, 목표가 포함)으로 돌려주고 이력 모듈을 요청한다', async () => {
        yahoo.summary.mockResolvedValue(
            summary([
                {
                    dateIso: '2026-11-05T12:00:00.000Z',
                    firm: 'Needham',
                    fromGrade: 'Buy',
                    toGrade: 'Buy',
                    action: 'main',
                    priceTargetAction: 'Lowers',
                    priorPriceTarget: 65,
                    currentPriceTarget: 48,
                },
                {
                    dateIso: '2026-11-07T12:00:00.000Z',
                    firm: 'Jefferies',
                    fromGrade: 'Buy',
                    toGrade: 'Buy',
                    action: 'main',
                    priceTargetAction: 'Lowers',
                    priorPriceTarget: 80,
                    currentPriceTarget: 65,
                },
            ])
        );
        const rows = await getAnalystActionHistory('IONQ');
        expect(yahoo.summary).toHaveBeenCalledWith('IONQ', {
            includeActions: true,
        });
        expect(
            rows?.map(r => [r.date, r.firm, r.priorTarget, r.target])
        ).toEqual([
            ['2026-11-07', 'Jefferies', 80, 65],
            ['2026-11-05', 'Needham', 65, 48],
        ]);
    });

    it('Yahoo가 실패하면(null) 던진다 — "이력 없음"이 캐시에 굳지 않게', async () => {
        yahoo.summary.mockResolvedValue(null);
        await expect(getAnalystActionHistory('IONQ')).rejects.toThrow(
            'Yahoo analyst history unavailable'
        );
    });

    it('Yahoo가 서비스하지 않는 심볼(빈 이력)은 실패가 아니라 빈 배열', async () => {
        yahoo.summary.mockResolvedValue(summary([]));
        expect(await getAnalystActionHistory('SPY')).toEqual([]);
    });

    it('한국 종목·E2E는 Yahoo를 부르지 않고 null', async () => {
        expect(await getAnalystActionHistory('005930.KS')).toBeNull();
        e2e.fake = true;
        expect(await getAnalystActionHistory('IONQ')).toBeNull();
        expect(yahoo.summary).not.toHaveBeenCalled();
    });
});
