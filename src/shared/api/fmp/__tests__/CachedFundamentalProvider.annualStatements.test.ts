import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CachedFundamentalProvider } from '@/shared/api/fmp/CachedFundamentalProvider';
import { CachedFinancialStatementsProvider } from '@/shared/api/fmp/CachedFinancialStatementsProvider';
import { FmpHttpError } from '@/shared/api/fmp/FmpHttpError';
import { __resetInFlightForTests } from '@/shared/cache/getOrSetCache';
import type { FundamentalProvider } from '@/shared/api/fmp/fundamentalProvider.types';
import type {
    CashFlowRow,
    FinancialStatementsProvider,
    IncomeGrowthRow,
} from '@y0ngha/siglens-core';

// 펀더멘털 탭의 현금흐름·성장률이 재무제표 캐시와 FMP 응답·Redis 키를 함께 쓰는지 검증한다.
// 실제 두 데코레이터를 엮고, 바깥 경계(inner FMP 클라이언트·Redis)만 가짜로 둔다.
const { store, fakeRedis } = vi.hoisted(() => {
    const store = new Map<string, unknown>();
    const fakeRedis = {
        get: vi.fn(async (key: string) =>
            store.has(key) ? store.get(key) : null
        ),
        set: vi.fn(async (key: string, value: unknown) => {
            store.set(key, value);
        }),
    };
    return { store, fakeRedis };
});
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: () => fakeRedis,
}));

const CASH_FLOW_ROWS: CashFlowRow[] = [
    {
        fiscalYear: '2025',
        period: 'FY',
        date: '2025-12-31',
        reportedCurrency: 'TWD',
        operatingCashFlow: 2_274_975_625_000,
        capitalExpenditure: -1_000,
        freeCashFlow: 1_000,
        dividendsPaid: null,
        fcfMargin: null,
    },
    {
        fiscalYear: '2024',
        period: 'FY',
        date: '2024-12-31',
        reportedCurrency: 'TWD',
        operatingCashFlow: 1,
        capitalExpenditure: null,
        freeCashFlow: null,
        dividendsPaid: null,
        fcfMargin: null,
    },
];

const INCOME_GROWTH_ROWS: IncomeGrowthRow[] = [
    {
        fiscalYear: '2025',
        period: 'FY',
        growthRevenue: 0.33,
        growthNetIncome: 0.4,
        growthEPS: 0.44,
        growthOperatingIncome: 0.5,
    },
];

function makeStatementsInner(
    overrides: Partial<FinancialStatementsProvider> = {}
): FinancialStatementsProvider {
    return {
        getIncomeStatements: vi.fn(async () => []),
        getBalanceSheets: vi.fn(async () => []),
        getCashFlowStatements: vi.fn(async () => CASH_FLOW_ROWS),
        getIncomeStatementGrowths: vi.fn(async () => INCOME_GROWTH_ROWS),
        getFinancialGrowths: vi.fn(async () => []),
        getCashFlowGrowths: vi.fn(async () => []),
        ...overrides,
    } as FinancialStatementsProvider;
}

// 주입 경로에서는 펀더멘털 inner의 두 메서드가 불리면 안 된다 — 불리면 FMP 호출이 다시 둘로 갈린다.
function makeFundamentalInner(): FundamentalProvider {
    return {
        getCashFlowStatement: vi.fn(async () => {
            throw new Error('fundamental inner must not be called');
        }),
        getIncomeStatementGrowth: vi.fn(async () => {
            throw new Error('fundamental inner must not be called');
        }),
    } as unknown as FundamentalProvider;
}

function setup(statementsOverrides: Partial<FinancialStatementsProvider> = {}) {
    const statementsInner = makeStatementsInner(statementsOverrides);
    const statements = new CachedFinancialStatementsProvider(statementsInner);
    const fundamentalInner = makeFundamentalInner();
    const fundamental = new CachedFundamentalProvider(
        fundamentalInner,
        new CachedFinancialStatementsProvider(statementsInner)
    );
    return { statementsInner, statements, fundamentalInner, fundamental };
}

describe('CachedFundamentalProvider — annual statements shared with financials cache', () => {
    beforeEach(() => {
        store.clear();
        fakeRedis.get.mockClear();
        fakeRedis.set.mockClear();
        __resetInFlightForTests();
    });

    it('maps the latest annual cash-flow row and reads the financials key', async () => {
        const { statementsInner, fundamental, fundamentalInner } = setup();

        expect(await fundamental.getCashFlowStatement('tsm')).toEqual({
            operatingCashFlow: 2_274_975_625_000,
            reportedCurrency: 'TWD',
        });
        expect(statementsInner.getCashFlowStatements).toHaveBeenCalledWith(
            'tsm',
            'annual',
            40
        );
        expect([...store.keys()]).toEqual(['financials:cashflow:TSM:annual']);
        expect(fundamentalInner.getCashFlowStatement).not.toHaveBeenCalled();
    });

    it('maps the latest annual income-growth row and reads the financials key', async () => {
        const { fundamental, fundamentalInner } = setup();

        expect(await fundamental.getIncomeStatementGrowth('TSM')).toEqual({
            growthRevenue: 0.33,
            growthEPS: 0.44,
        });
        expect([...store.keys()]).toEqual([
            'financials:income-growth:TSM:annual',
        ]);
        expect(
            fundamentalInner.getIncomeStatementGrowth
        ).not.toHaveBeenCalled();
    });

    it('serves the fundamental tab from the entry the financials tab already cached', async () => {
        const { statementsInner, statements, fundamental } = setup();

        await statements.getCashFlowStatements('TSM', 'annual', 5);
        await statements.getIncomeStatementGrowths('TSM', 'annual', 5);
        await fundamental.getCashFlowStatement('TSM');
        await fundamental.getIncomeStatementGrowth('TSM');

        expect(statementsInner.getCashFlowStatements).toHaveBeenCalledTimes(1);
        expect(statementsInner.getIncomeStatementGrowths).toHaveBeenCalledTimes(
            1
        );
    });

    it('lets the financials tab reuse the full history cached by the fundamental tab', async () => {
        const { statementsInner, statements, fundamental } = setup();

        await fundamental.getCashFlowStatement('TSM');
        const rows = await statements.getCashFlowStatements('TSM', 'annual', 5);

        expect(rows).toEqual(CASH_FLOW_ROWS);
        expect(statementsInner.getCashFlowStatements).toHaveBeenCalledTimes(1);
    });

    it('returns null for a symbol without statements', async () => {
        const { fundamental } = setup({
            getCashFlowStatements: vi.fn(async () => []),
            getIncomeStatementGrowths: vi.fn(async () => []),
        });

        expect(await fundamental.getCashFlowStatement('SPY')).toBeNull();
        expect(await fundamental.getIncomeStatementGrowth('SPY')).toBeNull();
    });

    it('throws on an FMP failure instead of degrading to null, and caches nothing', async () => {
        const failure = new FmpHttpError(
            'cash-flow-statement',
            429,
            null,
            'TSM'
        );
        const { fundamental } = setup({
            getCashFlowStatements: vi.fn(async () => {
                throw failure;
            }),
            getIncomeStatementGrowths: vi.fn(async () => {
                throw failure;
            }),
        });

        await expect(fundamental.getCashFlowStatement('TSM')).rejects.toBe(
            failure
        );
        await expect(fundamental.getIncomeStatementGrowth('TSM')).rejects.toBe(
            failure
        );
        expect(store.size).toBe(0);
    });
});
