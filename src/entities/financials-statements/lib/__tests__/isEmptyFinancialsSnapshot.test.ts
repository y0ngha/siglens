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
// same-slice internal segment → relative import (sibling getFinancialsSnapshot.test.ts와 동일)
import { isEmptyFinancialsSnapshot } from '../getFinancialsSnapshot';

const make = (o: Partial<FinancialsSnapshot> = {}): FinancialsSnapshot => ({
    income: [],
    balance: [],
    cashFlow: [],
    incomeGrowth: [],
    financialGrowth: [],
    cashFlowGrowth: [],
    ...o,
});

// 빈 객체를 섹션 행 타입으로 캐스팅 — isEmptyFinancialsSnapshot은 array length만
// 보므로 내용은 무관하다. as never(bottom type) 대신 섹션별 타입을 명시한다(MISTAKES §7).
const rowOf = <
    K extends keyof FinancialsSnapshot,
>(): FinancialsSnapshot[K][number] =>
    ({}) as unknown as FinancialsSnapshot[K][number];

describe('isEmptyFinancialsSnapshot', () => {
    it('returns true when all three statement sections are empty', () => {
        expect(isEmptyFinancialsSnapshot(make())).toBe(true);
    });

    it('returns false when income has data', () => {
        expect(
            isEmptyFinancialsSnapshot(make({ income: [rowOf<'income'>()] }))
        ).toBe(false);
    });

    it('returns false when balance has data', () => {
        expect(
            isEmptyFinancialsSnapshot(make({ balance: [rowOf<'balance'>()] }))
        ).toBe(false);
    });

    it('returns false when cashFlow has data', () => {
        expect(
            isEmptyFinancialsSnapshot(make({ cashFlow: [rowOf<'cashFlow'>()] }))
        ).toBe(false);
    });

    it('returns false when all three sections have data', () => {
        expect(
            isEmptyFinancialsSnapshot(
                make({
                    income: [rowOf<'income'>()],
                    balance: [rowOf<'balance'>()],
                    cashFlow: [rowOf<'cashFlow'>()],
                })
            )
        ).toBe(false);
    });

    it('returns true when only growth sections have data (statements empty)', () => {
        // growth-only is treated as empty — the page degrades without statements
        expect(
            isEmptyFinancialsSnapshot(
                make({ incomeGrowth: [rowOf<'incomeGrowth'>()] })
            )
        ).toBe(true);
    });
});
