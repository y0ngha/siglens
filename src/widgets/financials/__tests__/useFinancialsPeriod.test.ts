// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { FinancialsSnapshot } from '@y0ngha/siglens-core';

const mockGetFinancialsQuarterAction = vi.fn();

vi.mock('@/entities/financials-statements/actions', () => ({
    getFinancialsQuarterAction: (symbol: string) =>
        mockGetFinancialsQuarterAction(symbol),
}));

// Minimal FinancialsSnapshot fixture
const makeSnapshot = (tag: string): FinancialsSnapshot => ({
    income: [
        {
            fiscalYear: tag,
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
    ],
    balance: [],
    cashFlow: [],
    incomeGrowth: [],
    financialGrowth: [],
    cashFlowGrowth: [],
});

const ANNUAL_SNAPSHOT = makeSnapshot('annual');
const QUARTER_SNAPSHOT = makeSnapshot('quarter');

// An all-empty snapshot — the shape the action RESOLVES with when the upstream
// provider swallows an FMP throw and returns [] for every endpoint.
const EMPTY_SNAPSHOT: FinancialsSnapshot = {
    income: [],
    balance: [],
    cashFlow: [],
    incomeGrowth: [],
    financialGrowth: [],
    cashFlowGrowth: [],
};

// Lazy import so the vi.mock above registers first
async function importHook() {
    const mod = await import('../hooks/useFinancialsPeriod');
    return mod.useFinancialsPeriod;
}

describe('useFinancialsPeriod', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('starts with period="annual" and the SSR initial snapshot', async () => {
        const useFinancialsPeriod = await importHook();
        const { result } = renderHook(() =>
            useFinancialsPeriod('AAPL', ANNUAL_SNAPSHOT)
        );

        expect(result.current.period).toBe('annual');
        expect(result.current.snapshot).toBe(ANNUAL_SNAPSHOT);
        expect(result.current.isLoading).toBe(false);
    });

    it('lazily fetches quarter data when period is set to "quarter"', async () => {
        mockGetFinancialsQuarterAction.mockResolvedValue(QUARTER_SNAPSHOT);

        const useFinancialsPeriod = await importHook();
        const { result } = renderHook(() =>
            useFinancialsPeriod('AAPL', ANNUAL_SNAPSHOT)
        );

        act(() => {
            result.current.setPeriod('quarter');
        });

        expect(result.current.period).toBe('quarter');

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.snapshot).toBe(QUARTER_SNAPSHOT);
        expect(mockGetFinancialsQuarterAction).toHaveBeenCalledWith('AAPL');
    });

    it('falls back to annual snapshot on quarter fetch failure', async () => {
        mockGetFinancialsQuarterAction.mockRejectedValue(
            new Error('network error')
        );

        const useFinancialsPeriod = await importHook();
        const { result } = renderHook(() =>
            useFinancialsPeriod('AAPL', ANNUAL_SNAPSHOT)
        );

        act(() => {
            result.current.setPeriod('quarter');
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        // On failure stays on annual snapshot and reverts to annual period
        expect(result.current.snapshot).toBe(ANNUAL_SNAPSHOT);
        expect(result.current.period).toBe('annual');
    });

    it('reverts to annual when the action RESOLVES with an all-empty snapshot', async () => {
        // Provider swallows the FMP throw → action resolves (no rejection) with
        // an all-empty snapshot. The hook must treat this as a failure too.
        mockGetFinancialsQuarterAction.mockResolvedValue(EMPTY_SNAPSHOT);

        const useFinancialsPeriod = await importHook();
        const { result } = renderHook(() =>
            useFinancialsPeriod('AAPL', ANNUAL_SNAPSHOT)
        );

        act(() => {
            result.current.setPeriod('quarter');
        });

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        // The empty snapshot is NOT cached; period reverts to annual and the
        // annual snapshot is shown.
        expect(result.current.period).toBe('annual');
        expect(result.current.snapshot).toBe(ANNUAL_SNAPSHOT);
    });

    it('returns to annual snapshot when period is switched back', async () => {
        mockGetFinancialsQuarterAction.mockResolvedValue(QUARTER_SNAPSHOT);

        const useFinancialsPeriod = await importHook();
        const { result } = renderHook(() =>
            useFinancialsPeriod('AAPL', ANNUAL_SNAPSHOT)
        );

        act(() => {
            result.current.setPeriod('quarter');
        });
        await waitFor(() =>
            expect(result.current.snapshot).toBe(QUARTER_SNAPSHOT)
        );

        act(() => {
            result.current.setPeriod('annual');
        });

        expect(result.current.period).toBe('annual');
        expect(result.current.snapshot).toBe(ANNUAL_SNAPSHOT);
    });

    it('swaps cached quarter data instantly without re-fetching on a second switch', async () => {
        mockGetFinancialsQuarterAction.mockResolvedValue(QUARTER_SNAPSHOT);

        const useFinancialsPeriod = await importHook();
        const { result } = renderHook(() =>
            useFinancialsPeriod('AAPL', ANNUAL_SNAPSHOT)
        );

        // First switch → fetch + cache quarter snapshot.
        act(() => {
            result.current.setPeriod('quarter');
        });
        await waitFor(() =>
            expect(result.current.snapshot).toBe(QUARTER_SNAPSHOT)
        );

        // Back to annual, then to quarter again — second quarter switch must use
        // the cached snapshot (instant swap) and NOT call the action again.
        act(() => {
            result.current.setPeriod('annual');
        });
        act(() => {
            result.current.setPeriod('quarter');
        });

        expect(result.current.period).toBe('quarter');
        expect(result.current.snapshot).toBe(QUARTER_SNAPSHOT);
        expect(result.current.isLoading).toBe(false);
        expect(mockGetFinancialsQuarterAction).toHaveBeenCalledTimes(1);
    });

    it('does not call the action when switching back to annual', async () => {
        mockGetFinancialsQuarterAction.mockResolvedValue(QUARTER_SNAPSHOT);

        const useFinancialsPeriod = await importHook();
        const { result } = renderHook(() =>
            useFinancialsPeriod('AAPL', ANNUAL_SNAPSHOT)
        );

        // Switch to quarter, wait for fetch
        act(() => {
            result.current.setPeriod('quarter');
        });
        await waitFor(() =>
            expect(result.current.snapshot).toBe(QUARTER_SNAPSHOT)
        );

        vi.clearAllMocks();

        // Switch back to annual — no new action call expected
        act(() => {
            result.current.setPeriod('annual');
        });

        expect(mockGetFinancialsQuarterAction).not.toHaveBeenCalled();
    });
});
