vi.mock('server-only', () => ({}));

const m = vi.hoisted(() => ({
    tabAllowed: vi.fn(),
    scorecard: vi.fn(),
    krRows: vi.fn(),
}));
vi.mock('@/entities/ticker/api', () => ({
    isTabAllowedForSymbol: m.tabAllowed,
}));
vi.mock('@/entities/investor-flows/server/getInvestorFlowsScorecard', () => ({
    getInvestorFlowsScorecard: m.scorecard,
}));
vi.mock('@/entities/investor-flows/lib/investorFlowsReadiness', () => ({
    maskUncollectedSections: (snapshot: unknown) => snapshot,
}));
vi.mock(
    '@/entities/investor-flows/server/krInvestorTrend',
    async importOriginal => ({
        ...(await importOriginal<
            typeof import('@/entities/investor-flows/server/krInvestorTrend')
        >()),
        loadKrInvestorTrendRows: m.krRows,
    })
);

import type { InvestorFlowsSnapshot } from '@y0ngha/siglens-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VisualBuildEnv } from '@/features/agent-tools/lib/visualBlocks/types';
import {
    buildFlowsBlock,
    krDaysFrom,
    trailingMonths,
    usFlowsFrom,
} from '@/features/agent-tools/server/visualBlocks/flows';

const env: VisualBuildEnv = {
    locale: 'ko',
    userId: 'u',
    allowUnofficialSources: true,
    now: new Date('2026-11-19T12:00:00Z'),
};

const quarter = (period: string, complete: boolean, net: number) => ({
    period,
    complete,
    holders: 1000,
    shares: 1,
    valueUsd: 1,
    newHolders: 0,
    increased: 0,
    decreased: 0,
    exited: 0,
    netShareChange: net,
});

const tx = (
    date: string,
    type: 'buy' | 'sell' | 'other',
    value: number | null
) => ({
    date,
    filingDate: date,
    name: 'x',
    role: 'officer',
    type,
    shares: 1,
    price: null,
    value,
    sharesOwnedAfter: null,
    url: '',
});

const snapshot = (
    over: Partial<{
        quarters: ReturnType<typeof quarter>[];
        transactions: ReturnType<typeof tx>[];
    }> = {}
): InvestorFlowsSnapshot =>
    ({
        asOf: '2026-11-19',
        institutional: {
            quarters: over.quarters ?? [],
            topHolders: [],
            topHoldersPeriod: null,
        },
        insider: { transactions: over.transactions ?? [] },
    }) as unknown as InvestorFlowsSnapshot;

beforeEach(() => {
    Object.values(m).forEach(fn => fn.mockReset());
    m.tabAllowed.mockResolvedValue(true);
});

describe('trailingMonths', () => {
    it('기준 달부터 거슬러 올라간 n개월을 오래된 순으로(연도 경계 포함)', () => {
        expect(trailingMonths('2026-02-10', 4)).toEqual([
            '2025-11',
            '2025-12',
            '2026-01',
            '2026-02',
        ]);
    });
});

describe('usFlowsFrom', () => {
    it('기관 분기는 오래된 순 최근 8개이고, 진행 중 분기는 complete: false로 싣는다', () => {
        const quarters = Array.from({ length: 10 }, (_, i) =>
            quarter(`2024-${String(i + 1).padStart(2, '0')}-28`, true, i)
        );
        const out = usFlowsFrom(
            snapshot({
                quarters: [...quarters, quarter('2026-09-30', false, 999)],
            })
        );
        expect(out.institutional).toHaveLength(8);
        expect(out.institutional[0]?.netShareChange).toBe(3);
        expect(out.institutional.at(-1)).toMatchObject({
            period: '2026-09-30',
            complete: false,
            netShareChange: 999,
        });
        expect(out.institutional.slice(0, -1).every(q => q.complete)).toBe(
            true
        );
    });

    it('내부자는 월별 공개시장 매수−매도(금액을 아는 거래만), 거래 없는 달은 0, 12개월', () => {
        const out = usFlowsFrom(
            snapshot({
                transactions: [
                    tx('2026-11-03', 'buy', 5000),
                    tx('2026-11-10', 'sell', 2000),
                    tx('2026-11-12', 'other', 9999),
                    tx('2026-10-01', 'sell', 700),
                    tx('2026-10-02', 'buy', null),
                ],
            })
        );
        expect(out.insiderNetValue).toHaveLength(12);
        expect(out.insiderNetValue.at(-1)).toEqual({
            month: '2026-11',
            value: 3000,
        });
        expect(out.insiderNetValue.at(-2)).toEqual({
            month: '2026-10',
            value: -700,
        });
        expect(out.insiderNetValue[0]).toEqual({ month: '2025-12', value: 0 });
    });

    it('내부자 거래가 전혀 없으면 월별 열을 비운다', () => {
        expect(usFlowsFrom(snapshot()).insiderNetValue).toEqual([]);
    });
});

describe('krDaysFrom', () => {
    it('최신순 행을 오래된 순 최대 20일로 뒤집는다', () => {
        const rows = Array.from({ length: 25 }, (_, i) => ({
            date: `2026-10-${String(25 - i).padStart(2, '0')}`,
            foreignNet: i,
            institutionNet: -i,
            individualNet: i === 0 ? null : 1,
            close: 1,
        }));
        const days = krDaysFrom(rows);
        expect(days).toHaveLength(20);
        expect(days[0]?.date).toBe('2026-10-06');
        expect(days.at(-1)).toEqual({
            date: '2026-10-25',
            foreign: 0,
            institution: -0,
            individual: null,
        });
    });
});

describe('buildFlowsBlock', () => {
    it('미국: 스코어카드 스냅샷으로 기관·내부자 블록과 요약을 만든다', async () => {
        m.scorecard.mockResolvedValue({
            degraded: false,
            readiness: {},
            snapshot: snapshot({
                quarters: [quarter('2026-06-30', true, 500)],
                transactions: [tx('2026-11-03', 'buy', 1000)],
            }),
        });
        const out = await buildFlowsBlock('NVDA', env);
        if ('error' in out) throw new Error(out.reason);
        expect(out.block).toMatchObject({
            kind: 'flows',
            market: 'us',
            symbol: 'NVDA',
            institutional: [
                { period: '2026-06-30', complete: true, netShareChange: 500 },
            ],
        });
        expect(out.summary).toMatchObject({ insiderNetValueUsd12m: 1000 });
    });

    it('미국: 인프라 장애·데이터 없음·둘 다 빈 경우는 no_data', async () => {
        m.scorecard.mockResolvedValueOnce({ degraded: true, snapshot: null });
        expect(await buildFlowsBlock('NVDA', env)).toMatchObject({
            reason: 'provider_failed',
        });
        m.scorecard.mockResolvedValueOnce({ degraded: false, snapshot: null });
        expect(await buildFlowsBlock('NVDA', env)).toMatchObject({
            reason: 'no_flows_data',
        });
        m.scorecard.mockResolvedValueOnce({
            degraded: false,
            readiness: {},
            snapshot: snapshot(),
        });
        expect(await buildFlowsBlock('NVDA', env)).toMatchObject({
            reason: 'no_flows_data',
        });
    });

    it('한국: 네이버 일별 순매수 20일 블록과 합계 요약', async () => {
        m.krRows.mockResolvedValue(
            Array.from({ length: 20 }, (_, i) => ({
                date: `2026-10-${String(23 - i).padStart(2, '0')}`,
                foreignNet: 1,
                institutionNet: 2,
                individualNet: 3,
                close: 1,
            }))
        );
        const out = await buildFlowsBlock('005930.KS', env);
        if ('error' in out) throw new Error(out.reason);
        expect(out.block).toMatchObject({ market: 'kr', symbol: '005930.KS' });
        expect(
            out.block.kind === 'flows' &&
                out.block.market === 'kr' &&
                out.block.days
        ).toHaveLength(20);
        expect(out.summary).toMatchObject({
            sum20d: { foreignNet: 20, institutionNet: 40, individualNet: 60 },
        });
        expect(m.scorecard).not.toHaveBeenCalled();
    });

    it('한국: 비공식 소스 비허용이면 네이버를 읽지 않고 no_data', async () => {
        expect(
            await buildFlowsBlock('005930.KS', {
                ...env,
                allowUnofficialSources: false,
            })
        ).toEqual({ error: 'no_data', reason: 'source_not_allowed' });
        expect(m.krRows).not.toHaveBeenCalled();
    });

    it('한국: 네이버 행이 없으면 no_data', async () => {
        m.krRows.mockResolvedValue(null);
        expect(await buildFlowsBlock('005930.KS', env)).toMatchObject({
            error: 'no_data',
        });
    });

    it('수급 탭이 없는 종목(크립토)은 no_data', async () => {
        m.tabAllowed.mockResolvedValue(false);
        expect(await buildFlowsBlock('BTCUSD', env)).toMatchObject({
            error: 'no_data',
        });
    });
});
