// spy → vi.mock → imports 순서 (MISTAKES.md Tests §17)
const {
    mockGetIncomeStatements,
    mockGetBalanceSheets,
    mockGetCashFlowStatements,
    mockGetIncomeStatementGrowths,
    mockGetFinancialGrowths,
    mockGetCashFlowGrowths,
    mockProvider,
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
    return {
        mockGetIncomeStatements,
        mockGetBalanceSheets,
        mockGetCashFlowStatements,
        mockGetIncomeStatementGrowths,
        mockGetFinancialGrowths,
        mockGetCashFlowGrowths,
        mockProvider,
    };
});

vi.mock('@/shared/api/fmp/getFinancialStatementsProvider', () => ({
    getFinancialStatementsProvider: vi.fn(() => mockProvider),
}));

// staticSymbolCache: fetcher를 직접 호출하는 pass-through stub.
// keyParts/extraTags 단언은 불필요 — 이 파일의 단위 테스트는 provider 위임에
// 초점을 맞춘다(staticSymbolCache 자체는 staticSymbolCache.test.ts에서 커버).
vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: vi.fn(
        (
            _keyParts: readonly string[],
            _symbol: string,
            fetcher: () => Promise<unknown>
        ) => fetcher()
    ),
}));

// next/cache는 server-only 환경에서 작동하지 않으므로 stub한다.
vi.mock('next/cache', () => ({
    unstable_cache: (fn: () => unknown) => fn,
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    getFinancialsSnapshot,
    getFinancialsPageData,
} from '@/app/[symbol]/financials/financialData';
import { QUARTER_LIMIT } from '@/entities/financials-statements';
import {
    computeFinancialsScorecard,
    normalizeFinancialsSnapshot,
} from '@y0ngha/siglens-core';

describe('financialData', () => {
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

    describe('getFinancialsSnapshot', () => {
        it('기본값(annual, limit=5)으로 6개 provider 메서드를 모두 호출한다', async () => {
            await getFinancialsSnapshot('AAPL');

            expect(mockGetIncomeStatements).toHaveBeenCalledWith(
                'AAPL',
                'annual',
                5
            );
            expect(mockGetBalanceSheets).toHaveBeenCalledWith(
                'AAPL',
                'annual',
                5
            );
            expect(mockGetCashFlowStatements).toHaveBeenCalledWith(
                'AAPL',
                'annual',
                5
            );
            expect(mockGetIncomeStatementGrowths).toHaveBeenCalledWith(
                'AAPL',
                'annual',
                5
            );
            expect(mockGetFinancialGrowths).toHaveBeenCalledWith(
                'AAPL',
                'annual',
                5
            );
            expect(mockGetCashFlowGrowths).toHaveBeenCalledWith(
                'AAPL',
                'annual',
                5
            );
        });

        it('period/limit 오버라이드를 6개 provider 메서드에 모두 전달한다', async () => {
            await getFinancialsSnapshot('TSLA', 'quarter', 8);

            expect(mockGetIncomeStatements).toHaveBeenCalledWith(
                'TSLA',
                'quarter',
                8
            );
            expect(mockGetBalanceSheets).toHaveBeenCalledWith(
                'TSLA',
                'quarter',
                8
            );
            expect(mockGetCashFlowStatements).toHaveBeenCalledWith(
                'TSLA',
                'quarter',
                8
            );
            expect(mockGetIncomeStatementGrowths).toHaveBeenCalledWith(
                'TSLA',
                'quarter',
                8
            );
            expect(mockGetFinancialGrowths).toHaveBeenCalledWith(
                'TSLA',
                'quarter',
                8
            );
            expect(mockGetCashFlowGrowths).toHaveBeenCalledWith(
                'TSLA',
                'quarter',
                8
            );
        });

        it('normalizeFinancialsSnapshot이 반환한 FinancialsSnapshot을 반환한다', async () => {
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
    });

    describe('getFinancialsPageData', () => {
        it('{ snapshot, scorecard } 형태로 반환한다', async () => {
            const result = await getFinancialsPageData('AAPL');
            expect(result).toHaveProperty('snapshot');
            expect(result).toHaveProperty('scorecard');
        });

        it('scorecard는 snapshot으로부터 computeFinancialsScorecard로 계산된다', async () => {
            const result = await getFinancialsPageData('AAPL');
            const expectedScorecard = computeFinancialsScorecard(
                result.snapshot
            );
            expect(result.scorecard).toEqual(expectedScorecard);
        });

        it('provider 데이터가 비어 있으면 scorecard.composite.grade === "F"', async () => {
            const result = await getFinancialsPageData('AAPL');
            expect(result.scorecard.composite.grade).toBe('F');
        });

        it('getFinancialsPageData는 기본값으로 annual/5를 사용한다', async () => {
            await getFinancialsPageData('NVDA');

            expect(mockGetIncomeStatements).toHaveBeenCalledWith(
                'NVDA',
                'annual',
                5
            );
            expect(mockGetBalanceSheets).toHaveBeenCalledWith(
                'NVDA',
                'annual',
                5
            );
        });
    });

    describe('QUARTER_LIMIT', () => {
        it('QUARTER_LIMIT은 8이다', () => {
            expect(QUARTER_LIMIT).toBe(8);
        });
    });
});
