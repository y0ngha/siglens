vi.mock('server-only', () => ({}));

const m = vi.hoisted(() => ({
    tabAllowed: vi.fn(),
    incomeStatements: vi.fn(),
    reportedEps: vi.fn(),
    assetOf: vi.fn(),
}));
vi.mock('@/entities/ticker/api', () => ({
    isTabAllowedForSymbol: m.tabAllowed,
}));
vi.mock('@/app/api/ai/chat/tools/resolveAssetInfo', () => ({
    resolveAssetInfoOrNull: m.assetOf,
}));
vi.mock('@/shared/api/fmp/getFinancialStatementsProvider', () => ({
    getFinancialStatementsProvider: () => ({
        getIncomeStatements: m.incomeStatements,
    }),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));
vi.mock('@/entities/earnings-report/server/earningsReportsRepository', () => ({
    DrizzleEarningsReportsRepository: class {
        listReportedEps = m.reportedEps;
    },
}));

import type { IncomeStatementRow } from '@y0ngha/siglens-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    buildFinancialsBlock,
    FINANCIAL_QUARTERS_MAX,
    financialsQuartersFrom,
} from '@/app/api/ai/chat/tools/visualBlocks/financials';
import type { VisualBuildEnv } from '@/app/api/ai/chat/tools/visualBlocks/types';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';

const env: VisualBuildEnv = {
    locale: 'ko',
    userId: 'u',
    allowUnofficialSources: true,
    now: new Date('2026-11-19T12:00:00Z'),
};

const row = (
    date: string,
    fiscalYear: string,
    period: string,
    over: Partial<IncomeStatementRow> = {}
): IncomeStatementRow => ({
    fiscalYear,
    period,
    date,
    reportedCurrency: 'USD',
    revenue: 100,
    grossProfit: null,
    operatingIncome: null,
    netIncome: 10,
    ebitda: null,
    eps: 1,
    epsDiluted: 0.9,
    grossMargin: null,
    operatingMargin: null,
    netMargin: null,
    ...over,
});

const asset = (marketProfile?: MarketProfileId) => ({
    symbol: 'X',
    name: 'X Inc',
    ...(marketProfile ? { marketProfile } : {}),
});

beforeEach(() => {
    Object.values(m).forEach(fn => fn.mockReset());
    m.tabAllowed.mockResolvedValue(true);
    m.assetOf.mockResolvedValue(asset('us-equity'));
    m.reportedEps.mockResolvedValue([]);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('financialsQuartersFrom', () => {
    it('분기 행만, 오래된 순으로, 희석 EPS를 먼저 쓴다', () => {
        const q = financialsQuartersFrom(
            [
                row('2026-06-30', '2026', 'Q2'),
                row('2025-12-31', '2025', 'FY'),
                row('2026-03-31', '2026', 'Q1', { epsDiluted: null }),
            ],
            []
        );
        expect(q.map(x => [x.period, x.eps])).toEqual([
            ['2026 Q1', 1],
            ['2026 Q2', 0.9],
        ]);
    });

    it('분기 말일 뒤 130일 안에 처음 발표된 EPS(예상·실제)를 잇는다', () => {
        const q = financialsQuartersFrom(
            [row('2026-06-30', '2026', 'Q2')],
            [
                { earningsDate: '2026-10-30', epsActual: 9, epsEstimated: 9 },
                {
                    earningsDate: '2026-07-30',
                    epsActual: 1.1,
                    epsEstimated: 1.0,
                },
                { earningsDate: '2026-04-30', epsActual: 7, epsEstimated: 7 },
            ]
        );
        expect(q[0]).toMatchObject({ epsActual: 1.1, epsEstimated: 1.0 });
    });

    it('발표 행이 없으면 EPS 예상·실제는 null', () => {
        expect(
            financialsQuartersFrom([row('2026-06-30', '2026', 'Q2')], [])[0]
        ).toMatchObject({ epsActual: null, epsEstimated: null });
    });

    it(`값이 모두 빈 분기는 빼고 최근 ${FINANCIAL_QUARTERS_MAX}개만 남긴다`, () => {
        const rows = [
            row('2024-03-31', '2024', 'Q1', {
                revenue: null,
                netIncome: null,
                eps: null,
                epsDiluted: null,
            }),
            ...Array.from({ length: 10 }, (_, i) =>
                row(
                    `2024-${String(4 + i).padStart(2, '0')}-28`,
                    '2024',
                    `Q${(i % 4) + 1}`
                )
            ),
        ];
        const q = financialsQuartersFrom(rows, []);
        expect(q).toHaveLength(FINANCIAL_QUARTERS_MAX);
        expect(q.every(x => x.revenue !== null)).toBe(true);
    });
});

describe('buildFinancialsBlock', () => {
    it('블록과 모델용 요약(통화 포함)을 만든다', async () => {
        m.incomeStatements.mockResolvedValue([
            row('2026-03-31', '2026', 'Q1'),
            row('2026-06-30', '2026', 'Q2'),
        ]);
        m.reportedEps.mockResolvedValue([
            { earningsDate: '2026-07-30', epsActual: 1.1, epsEstimated: 1.0 },
        ]);
        const out = await buildFinancialsBlock('AAPL', env);
        if ('error' in out) throw new Error(out.reason);
        expect(m.incomeStatements).toHaveBeenCalledWith('AAPL', 'quarter', 8);
        expect(out.block).toMatchObject({
            kind: 'financials',
            symbol: 'AAPL',
            currency: 'USD',
        });
        expect(out.summary).toMatchObject({
            quarters: [
                { period: '2026 Q1' },
                { period: '2026 Q2', epsActual: 1.1, epsEstimated: 1.0 },
            ],
        });
    });

    it('자산 조회가 null이어도 블록을 만들고 통화는 기본 시장(USD)으로 내려간다', async () => {
        m.assetOf.mockResolvedValue(null);
        m.incomeStatements.mockResolvedValue([row('2026-06-30', '2026', 'Q2')]);
        const out = await buildFinancialsBlock('ZZZZ', env);
        if ('error' in out) throw new Error(out.reason);
        expect(out.block).toMatchObject({
            kind: 'financials',
            currency: 'USD',
        });
    });

    it('이 종목에 재무 탭이 없으면(크립토 등) no_data', async () => {
        m.tabAllowed.mockResolvedValue(false);
        expect(await buildFinancialsBlock('BTCUSD', env)).toMatchObject({
            error: 'no_data',
        });
        expect(m.incomeStatements).not.toHaveBeenCalled();
    });

    it('분기 행이 없으면 no_data', async () => {
        m.incomeStatements.mockResolvedValue([]);
        expect(await buildFinancialsBlock('AAPL', env)).toEqual({
            error: 'no_data',
            reason: 'no_quarterly_statements',
        });
    });

    it('실적 발표 DB 조회가 실패해도 EPS 예상 없이 그린다', async () => {
        m.incomeStatements.mockResolvedValue([row('2026-06-30', '2026', 'Q2')]);
        m.reportedEps.mockRejectedValue(new Error('db'));
        const out = await buildFinancialsBlock('AAPL', env);
        expect('block' in out).toBe(true);
    });
});
