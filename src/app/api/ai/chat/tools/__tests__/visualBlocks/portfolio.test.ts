import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { load } = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('@/app/api/ai/chat/tools/getMyPortfolio', () => ({
    loadMyPortfolio: load,
}));

import type { HoldingView } from '@/app/api/ai/chat/tools/getMyPortfolio';
import {
    buildPortfolioBlock,
    PORTFOLIO_HOLDINGS_PER_GROUP_MAX,
    portfolioGroupsFrom,
} from '@/app/api/ai/chat/tools/visualBlocks/portfolio';

const env = {
    locale: 'ko' as const,
    userId: 'u1',
    allowUnofficialSources: true,
    now: new Date('2026-11-19T12:00:00Z'),
};

const holding = (
    symbol: string,
    currency: string,
    weightPct: number | null,
    pnlPct: number | null = 1
): HoldingView =>
    ({
        symbol,
        companyName: `${symbol} Inc`,
        currency,
        weightPct,
        pnlPct,
    }) as HoldingView;

beforeEach(() => load.mockReset());

describe('portfolioGroupsFrom', () => {
    it('통화별로 묶고 비중 큰 순으로 정렬한다(비중 모르는 종목은 뒤)', () => {
        expect(
            portfolioGroupsFrom([
                holding('A', 'USD', 10),
                holding('B', 'KRW', 100),
                holding('C', 'USD', null),
                holding('D', 'USD', 90),
            ]).map(g => [g.currency, g.holdings.map(h => h.symbol)])
        ).toEqual([
            ['USD', ['D', 'A', 'C']],
            ['KRW', ['B']],
        ]);
    });

    it(`통화 그룹마다 ${PORTFOLIO_HOLDINGS_PER_GROUP_MAX}개까지만 싣는다`, () => {
        const many = Array.from({ length: 20 }, (_, i) =>
            holding(`S${i}`, 'USD', 20 - i)
        );
        const [group] = portfolioGroupsFrom(many);
        expect(group?.holdings).toHaveLength(PORTFOLIO_HOLDINGS_PER_GROUP_MAX);
        expect(group?.holdings[0]?.symbol).toBe('S0');
    });
});

describe('buildPortfolioBlock', () => {
    it('get_my_portfolio와 같은 로더의 값으로 블록과 요약을 만든다', async () => {
        load.mockResolvedValue({
            asOf: '2026-11-19T12:00:00.000Z',
            count: 2,
            holdings: [holding('A', 'USD', 60), holding('B', 'USD', 40, -5)],
            totals: [{ currency: 'USD' }],
        });
        const out = await buildPortfolioBlock(env);
        if ('error' in out) throw new Error(out.reason);
        expect(load).toHaveBeenCalledWith('u1');
        expect(out.block).toMatchObject({
            kind: 'portfolio',
            asOf: '2026-11-19T12:00:00.000Z',
            groups: [
                {
                    currency: 'USD',
                    holdings: [
                        {
                            symbol: 'A',
                            name: 'A Inc',
                            weightPct: 60,
                            pnlPct: 1,
                        },
                        { symbol: 'B', weightPct: 40, pnlPct: -5 },
                    ],
                },
            ],
        });
        expect(out.summary).toMatchObject({
            holdingsCount: 2,
            weightScope: 'whole portfolio',
        });
    });

    it('통화가 둘 이상이면 비중이 통화별이라고 요약에 밝힌다', async () => {
        load.mockResolvedValue({
            asOf: 'x',
            count: 2,
            weightScope: 'currency',
            holdings: [holding('A', 'USD', 100), holding('B', 'KRW', 100)],
            totals: [],
        });
        const out = await buildPortfolioBlock(env);
        expect('summary' in out && out.summary.weightScope).toBe(
            'per currency (not a blend)'
        );
    });

    it('보유종목이 없으면 no_data', async () => {
        load.mockResolvedValue({
            asOf: 'x',
            count: 0,
            holdings: [],
            totals: [],
        });
        expect(await buildPortfolioBlock(env)).toEqual({
            error: 'no_data',
            reason: 'empty_portfolio',
        });
    });
});
