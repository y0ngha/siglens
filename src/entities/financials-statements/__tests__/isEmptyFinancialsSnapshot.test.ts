// getFinancialsSnapshot.ts pulls in server-only deps at import time; stub them
// so the pure isEmptyFinancialsSnapshot can be imported and tested in isolation.
vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: vi.fn(),
}));
vi.mock('@/shared/api/fmp/getFinancialStatementsProvider', () => ({
    getFinancialStatementsProvider: vi.fn(),
}));

import { describe, it, expect, vi } from 'vitest';
import type { FinancialsSnapshot } from '@y0ngha/siglens-core';
import { isEmptyFinancialsSnapshot } from '@/entities/financials-statements/lib/getFinancialsSnapshot';

const make = (o: Partial<FinancialsSnapshot> = {}): FinancialsSnapshot => ({
    income: [],
    balance: [],
    cashFlow: [],
    incomeGrowth: [],
    financialGrowth: [],
    cashFlowGrowth: [],
    ...o,
});

const row = {} as never;

describe('isEmptyFinancialsSnapshot', () => {
    it('returns true when all three statement sections are empty', () => {
        expect(isEmptyFinancialsSnapshot(make())).toBe(true);
    });

    it('returns false when income has data', () => {
        expect(isEmptyFinancialsSnapshot(make({ income: [row] }))).toBe(false);
    });

    it('returns false when balance has data', () => {
        expect(isEmptyFinancialsSnapshot(make({ balance: [row] }))).toBe(false);
    });

    it('returns false when cashFlow has data', () => {
        expect(isEmptyFinancialsSnapshot(make({ cashFlow: [row] }))).toBe(
            false
        );
    });

    it('returns false when all three sections have data', () => {
        expect(
            isEmptyFinancialsSnapshot(
                make({ income: [row], balance: [row], cashFlow: [row] })
            )
        ).toBe(false);
    });

    it('returns true when only growth sections have data (statements empty)', () => {
        // growth-only is treated as empty — the page degrades without statements
        expect(isEmptyFinancialsSnapshot(make({ incomeGrowth: [row] }))).toBe(
            true
        );
    });
});
