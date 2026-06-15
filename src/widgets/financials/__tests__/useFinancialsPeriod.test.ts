// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { FinancialsSnapshot } from '@y0ngha/siglens-core';

// ── Mocks ────────────────────────────────────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────────────────────

// Lazy import so the vi.mock above registers first
async function importHook() {
    const mod = await import('../hooks/useFinancialsPeriod');
    return mod.useFinancialsPeriod;
}

// ── Tests ────────────────────────────────────────────────────────────────────

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
