// spy → vi.mock → imports 순서 (MISTAKES.md Tests §17)
const { mockGetFinancialsSnapshot } = vi.hoisted(() => ({
    mockGetFinancialsSnapshot: vi.fn(),
}));

vi.mock('@/entities/financials-statements/lib/getFinancialsSnapshot', () => ({
    getFinancialsSnapshot: mockGetFinancialsSnapshot,
    // Re-export the real limit constant value so the action's delegation can be
    // asserted against the expected 8.
    QUARTER_LIMIT: 8,
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FinancialsSnapshot } from '@y0ngha/siglens-core';
import { getFinancialsQuarterAction } from '@/entities/financials-statements/actions/getFinancialsQuarterAction';

const SNAPSHOT = {
    income: [],
    balance: [],
    cashFlow: [],
    incomeGrowth: [],
    financialGrowth: [],
    cashFlowGrowth: [],
} as unknown as FinancialsSnapshot;

describe('getFinancialsQuarterAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetFinancialsSnapshot.mockResolvedValue(SNAPSHOT);
    });

    it("entity getFinancialsSnapshot을 period='quarter', limit=8로 호출한다", async () => {
        await getFinancialsQuarterAction('AAPL');

        expect(mockGetFinancialsSnapshot).toHaveBeenCalledWith(
            'AAPL',
            'quarter',
            8
        );
        expect(mockGetFinancialsSnapshot).toHaveBeenCalledTimes(1);
    });

    it('lib이 반환한 snapshot을 그대로 반환한다', async () => {
        const result = await getFinancialsQuarterAction('TSLA');
        expect(result).toBe(SNAPSHOT);
    });

    describe('lib이 throw할 때 (§0.7)', () => {
        it('예외를 전파하지 않고 EMPTY snapshot을 반환한다', async () => {
            const consoleSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            mockGetFinancialsSnapshot.mockRejectedValueOnce(
                new Error('FMP down')
            );

            const result = await getFinancialsQuarterAction('AAPL');

            expect(result).toEqual({
                income: [],
                balance: [],
                cashFlow: [],
                incomeGrowth: [],
                financialGrowth: [],
                cashFlowGrowth: [],
            });
            consoleSpy.mockRestore();
        });

        it('catch에서 에러를 로깅한다', async () => {
            const consoleSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            const error = new Error('FMP down');
            mockGetFinancialsSnapshot.mockRejectedValueOnce(error);

            await getFinancialsQuarterAction('AAPL');

            expect(consoleSpy).toHaveBeenCalledWith(
                '[getFinancialsQuarterAction] quarter fetch failed:',
                'AAPL',
                error
            );
            consoleSpy.mockRestore();
        });
    });
});
