// spy → vi.mock → imports 순서 (MISTAKES.md Tests §17)
const {
    mockGetIncomeStatements,
    mockGetBalanceSheets,
    mockGetCashFlowStatements,
    mockGetIncomeStatementGrowths,
    mockGetFinancialGrowths,
    mockGetCashFlowGrowths,
    mockProvider,
    mockStaticSymbolCache,
} = vi.hoisted(() => {
    const mockGetIncomeStatements = vi.fn();
    const mockGetBalanceSheets = vi.fn();
    const mockGetCashFlowStatements = vi.fn();
    const mockGetIncomeStatementGrowths = vi.fn();
    const mockGetFinancialGrowths = vi.fn();
    const mockGetCashFlowGrowths = vi.fn();
    const mockProvider = {
        getIncomeStatements: mockGetIncomeStatements,
        getBalanceSheets: mockGetBalanceSheets,
        getCashFlowStatements: mockGetCashFlowStatements,
        getIncomeStatementGrowths: mockGetIncomeStatementGrowths,
        getFinancialGrowths: mockGetFinancialGrowths,
        getCashFlowGrowths: mockGetCashFlowGrowths,
    };
    // pass-through stub that ALSO records keyParts/extraTags so we can assert the
    // exact cache key shape + tag (the contract the Next data cache relies on).
    const mockStaticSymbolCache = vi.fn(
        (
            _keyParts: readonly string[],
            _symbol: string,
            fetcher: () => Promise<unknown>,
            _extraTags?: readonly string[]
        ) => fetcher()
    );
    return {
        mockGetIncomeStatements,
        mockGetBalanceSheets,
        mockGetCashFlowStatements,
        mockGetIncomeStatementGrowths,
        mockGetFinancialGrowths,
        mockGetCashFlowGrowths,
        mockProvider,
        mockStaticSymbolCache,
    };
});

vi.mock('@/shared/api/fmp/getFinancialStatementsProvider', () => ({
    getFinancialStatementsProvider: vi.fn(() => mockProvider),
}));

vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: mockStaticSymbolCache,
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    getFinancialsSnapshot,
    ANNUAL_LIMIT,
    QUARTER_LIMIT,
} from '@/entities/financials-statements/lib/getFinancialsSnapshot';
import { normalizeFinancialsSnapshot } from '@y0ngha/siglens-core';

describe('getFinancialsSnapshot (entity lib — single source)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // 기본값: 빈 배열 (데이터 없는 심볼)
        mockGetIncomeStatements.mockResolvedValue([]);
        mockGetBalanceSheets.mockResolvedValue([]);
        mockGetCashFlowStatements.mockResolvedValue([]);
        mockGetIncomeStatementGrowths.mockResolvedValue([]);
        mockGetFinancialGrowths.mockResolvedValue([]);
        mockGetCashFlowGrowths.mockResolvedValue([]);
    });

    describe('limit constants', () => {
        it('ANNUAL_LIMIT는 5, QUARTER_LIMIT는 8이다', () => {
            expect(ANNUAL_LIMIT).toBe(5);
            expect(QUARTER_LIMIT).toBe(8);
        });
    });

    describe('cache key + tag contract (byte-identical)', () => {
        it('6종 fetch의 staticSymbolCache keyParts가 정확히 일치한다', async () => {
            await getFinancialsSnapshot('AAPL');

            const keyParts = mockStaticSymbolCache.mock.calls.map(c => c[0]);
            expect(keyParts).toEqual([
                ['financials:income', 'AAPL', 'annual'],
                ['financials:balance', 'AAPL', 'annual'],
                ['financials:cashflow', 'AAPL', 'annual'],
                ['financials:income-growth', 'AAPL', 'annual'],
                ['financials:financial-growth', 'AAPL', 'annual'],
                ['financials:cashflow-growth', 'AAPL', 'annual'],
            ]);
        });

        it('모든 fetch에 `financials:${SYMBOL}` extraTag(대문자)를 전달한다', async () => {
            await getFinancialsSnapshot('aapl');

            // staticSymbolCache는 (keyParts, symbol, fetcher, extraTags) 시그니처.
            for (const call of mockStaticSymbolCache.mock.calls) {
                expect(call[3]).toEqual(['financials:AAPL']);
            }
            expect(mockStaticSymbolCache).toHaveBeenCalledTimes(6);
        });
    });

    describe('period / limit forwarding', () => {
        it('기본값(annual, ANNUAL_LIMIT)으로 6개 provider 메서드를 모두 호출한다', async () => {
            await getFinancialsSnapshot('AAPL');

            for (const m of [
                mockGetIncomeStatements,
                mockGetBalanceSheets,
                mockGetCashFlowStatements,
                mockGetIncomeStatementGrowths,
                mockGetFinancialGrowths,
                mockGetCashFlowGrowths,
            ]) {
                expect(m).toHaveBeenCalledWith('AAPL', 'annual', ANNUAL_LIMIT);
            }
        });

        it('period/limit 오버라이드를 6개 provider 메서드에 모두 전달한다', async () => {
            await getFinancialsSnapshot('TSLA', 'quarter', QUARTER_LIMIT);

            for (const m of [
                mockGetIncomeStatements,
                mockGetBalanceSheets,
                mockGetCashFlowStatements,
                mockGetIncomeStatementGrowths,
                mockGetFinancialGrowths,
                mockGetCashFlowGrowths,
            ]) {
                expect(m).toHaveBeenCalledWith(
                    'TSLA',
                    'quarter',
                    QUARTER_LIMIT
                );
            }

            const keyParts = mockStaticSymbolCache.mock.calls.map(c => c[0]);
            expect(keyParts[0]).toEqual([
                'financials:income',
                'TSLA',
                'quarter',
            ]);
        });
    });

    describe('normalization', () => {
        it('normalizeFinancialsSnapshot이 반환한 FinancialsSnapshot을 반환한다 (empty path)', async () => {
            const result = await getFinancialsSnapshot('AAPL');
            const expected = normalizeFinancialsSnapshot({
                income: [],
                balance: [],
                cashFlow: [],
                incomeGrowth: [],
                financialGrowth: [],
                cashFlowGrowth: [],
            });
            expect(result).toEqual(expected);
        });

        it('partial path — income만 있고 나머지는 비어도 정규화 결과를 반환한다', async () => {
            const incomeRaw = [
                {
                    fiscalYear: '2024',
                    period: 'FY',
                    date: '2024-12-31',
                    revenue: 1_000_000,
                    grossProfit: 600_000,
                    operatingIncome: 300_000,
                    netIncome: 200_000,
                    ebitda: 350_000,
                    eps: 1.0,
                    epsDiluted: 0.98,
                    grossMargin: 60,
                    operatingMargin: 30,
                    netMargin: 20,
                },
            ];
            mockGetIncomeStatements.mockResolvedValue(incomeRaw);

            const result = await getFinancialsSnapshot('AAPL');
            const expected = normalizeFinancialsSnapshot({
                income: incomeRaw,
                balance: [],
                cashFlow: [],
                incomeGrowth: [],
                financialGrowth: [],
                cashFlowGrowth: [],
            });
            expect(result).toEqual(expected);
            expect(result.balance).toEqual([]);
        });
    });

    describe('cacheNonEmpty — 빈 결과 graceful degrade (sentinel)', () => {
        it('provider가 빈 배열을 반환하면 sentinel throw를 삼키고 빈 섹션으로 degrade한다', async () => {
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});

            // 기본 mock이 6종 모두 [] 반환 → 각 fetcher가 EmptyResultError를 throw해
            // unstable_cache(staticSymbolCache)가 set을 건너뛰고, cacheNonEmpty가
            // catch해 []로 degrade한다. 함수는 reject하지 않는다.
            const result = await getFinancialsSnapshot('AAPL');

            expect(result.income).toEqual([]);
            expect(result.balance).toEqual([]);
            expect(result.cashFlow).toEqual([]);
            // sentinel은 의도된 흐름이므로 로깅하지 않는다.
            expect(errorSpy).not.toHaveBeenCalled();

            errorSpy.mockRestore();
        });

        it('sentinel이 아닌 예기치 못한 에러는 로깅하고 []로 degrade한다', async () => {
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            // EmptyResultError가 아닌 throw → instanceof 분기에서 로깅 경로로 간다.
            mockGetIncomeStatements.mockRejectedValue(new Error('FMP 5xx'));

            const result = await getFinancialsSnapshot('AAPL');

            // 예기치 못한 에러도 []로 graceful degrade한다(Promise.all 전체 실패 방지).
            expect(result.income).toEqual([]);
            expect(errorSpy).toHaveBeenCalledWith(
                '[cacheNonEmpty] unexpected cache error:',
                expect.objectContaining({ message: 'FMP 5xx' })
            );

            errorSpy.mockRestore();
        });
    });
});
