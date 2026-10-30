// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { FinancialsSnapshot } from '@y0ngha/siglens-core';

const mockGetFinancialsQuarterAction = vi.fn();

vi.mock(
    '@/entities/financials-statements/actions/getFinancialsQuarterAction',
    () => ({
        getFinancialsQuarterAction: (symbol: string) =>
            mockGetFinancialsQuarterAction(symbol),
    })
);

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
    const mod = await import('@/widgets/financials/hooks/useFinancialsPeriod');
    return mod.useFinancialsPeriod;
}

async function importStateMachine() {
    const mod =
        await import('@/widgets/financials/utils/financialsPeriodUtils');
    return mod.fetchAndApplyQuarterSnapshot;
}

describe('fetchAndApplyQuarterSnapshot', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calls setQuarterSnapshot on success', async () => {
        mockGetFinancialsQuarterAction.mockResolvedValue(QUARTER_SNAPSHOT);
        const fetchAndApplyQuarterSnapshot = await importStateMachine();

        const setPeriodState = vi.fn();
        const setQuarterSnapshot = vi.fn();
        const setIsLoading = vi.fn();
        const setQuarterUnavailable = vi.fn();

        await fetchAndApplyQuarterSnapshot('AAPL', {
            setPeriodState,
            setQuarterSnapshot,
            setIsLoading,
            setQuarterUnavailable,
        });

        expect(setQuarterSnapshot).toHaveBeenCalledWith(QUARTER_SNAPSHOT);
        expect(setPeriodState).not.toHaveBeenCalled();
        expect(setQuarterUnavailable).not.toHaveBeenCalled();
        expect(setIsLoading).toHaveBeenCalledWith(false);
    });

    it('calls setPeriodState("annual") when action resolves with empty snapshot', async () => {
        mockGetFinancialsQuarterAction.mockResolvedValue(EMPTY_SNAPSHOT);
        const fetchAndApplyQuarterSnapshot = await importStateMachine();

        const setPeriodState = vi.fn();
        const setQuarterSnapshot = vi.fn();
        const setIsLoading = vi.fn();
        const setQuarterUnavailable = vi.fn();

        await fetchAndApplyQuarterSnapshot('AAPL', {
            setPeriodState,
            setQuarterSnapshot,
            setIsLoading,
            setQuarterUnavailable,
        });

        expect(setPeriodState).toHaveBeenCalledWith('annual');
        expect(setQuarterUnavailable).toHaveBeenCalledWith(true);
        expect(setQuarterSnapshot).not.toHaveBeenCalled();
        expect(setIsLoading).toHaveBeenCalledWith(false);
    });

    it('calls setPeriodState("annual") when action rejects', async () => {
        mockGetFinancialsQuarterAction.mockRejectedValue(new Error('network'));
        const fetchAndApplyQuarterSnapshot = await importStateMachine();

        const setPeriodState = vi.fn();
        const setQuarterSnapshot = vi.fn();
        const setIsLoading = vi.fn();
        const setQuarterUnavailable = vi.fn();

        await fetchAndApplyQuarterSnapshot('AAPL', {
            setPeriodState,
            setQuarterSnapshot,
            setIsLoading,
            setQuarterUnavailable,
        });

        expect(setPeriodState).toHaveBeenCalledWith('annual');
        expect(setQuarterUnavailable).toHaveBeenCalledWith(true);
        expect(setQuarterSnapshot).not.toHaveBeenCalled();
        expect(setIsLoading).toHaveBeenCalledWith(false);
    });

    it('always calls setIsLoading(false) even when the action rejects mid-fetch', async () => {
        // Confirms the finally guarantee for an async rejection case where
        // no data path is entered at all (the try block throws immediately).
        mockGetFinancialsQuarterAction.mockRejectedValue(new Error('timeout'));
        const fetchAndApplyQuarterSnapshot = await importStateMachine();

        const setPeriodState = vi.fn();
        const setQuarterSnapshot = vi.fn();
        const setIsLoading = vi.fn();
        const setQuarterUnavailable = vi.fn();

        await fetchAndApplyQuarterSnapshot('AAPL', {
            setPeriodState,
            setQuarterSnapshot,
            setIsLoading,
            setQuarterUnavailable,
        });

        expect(setIsLoading).toHaveBeenCalledWith(false);
        expect(setIsLoading).toHaveBeenCalledTimes(1);
    });
});

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

    it('does not start a second request when quarter is clicked again while loading', async () => {
        let resolveAction: (snapshot: FinancialsSnapshot) => void = () =>
            undefined;
        mockGetFinancialsQuarterAction.mockReturnValue(
            new Promise<FinancialsSnapshot>(resolve => {
                resolveAction = resolve;
            })
        );

        const useFinancialsPeriod = await importHook();
        const { result } = renderHook(() =>
            useFinancialsPeriod('AAPL', ANNUAL_SNAPSHOT)
        );

        act(() => {
            result.current.setPeriod('quarter');
            result.current.setPeriod('quarter');
        });
        act(() => {
            result.current.setPeriod('quarter');
        });

        expect(mockGetFinancialsQuarterAction).toHaveBeenCalledTimes(1);
        expect(result.current.isLoading).toBe(true);

        await act(async () => {
            resolveAction(QUARTER_SNAPSHOT);
        });

        expect(result.current.snapshot).toBe(QUARTER_SNAPSHOT);
        expect(result.current.period).toBe('quarter');
        expect(mockGetFinancialsQuarterAction).toHaveBeenCalledTimes(1);
    });

    it('keeps the quarter view when quarter is clicked again after annual during loading', async () => {
        let resolveAction: (snapshot: FinancialsSnapshot) => void = () =>
            undefined;
        mockGetFinancialsQuarterAction.mockReturnValue(
            new Promise<FinancialsSnapshot>(resolve => {
                resolveAction = resolve;
            })
        );

        const useFinancialsPeriod = await importHook();
        const { result } = renderHook(() =>
            useFinancialsPeriod('AAPL', ANNUAL_SNAPSHOT)
        );

        act(() => result.current.setPeriod('quarter'));
        act(() => result.current.setPeriod('annual'));
        act(() => result.current.setPeriod('quarter'));

        expect(result.current.period).toBe('quarter');
        expect(mockGetFinancialsQuarterAction).toHaveBeenCalledTimes(1);

        await act(async () => {
            resolveAction(QUARTER_SNAPSHOT);
        });

        expect(result.current.snapshot).toBe(QUARTER_SNAPSHOT);
    });

    it('surfaces an unavailable notice when the quarter fetch fails and clears it on a later switch', async () => {
        mockGetFinancialsQuarterAction.mockRejectedValueOnce(
            new Error('network error')
        );

        const useFinancialsPeriod = await importHook();
        const { result } = renderHook(() =>
            useFinancialsPeriod('AAPL', ANNUAL_SNAPSHOT)
        );
        expect(result.current.quarterUnavailable).toBe(false);

        act(() => result.current.setPeriod('quarter'));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.period).toBe('annual');
        expect(result.current.quarterUnavailable).toBe(true);

        mockGetFinancialsQuarterAction.mockResolvedValue(QUARTER_SNAPSHOT);
        act(() => result.current.setPeriod('quarter'));

        expect(result.current.quarterUnavailable).toBe(false);
        await waitFor(() =>
            expect(result.current.snapshot).toBe(QUARTER_SNAPSHOT)
        );
        expect(mockGetFinancialsQuarterAction).toHaveBeenCalledTimes(2);
    });

    it('surfaces the notice when the action resolves with an all-empty snapshot', async () => {
        mockGetFinancialsQuarterAction.mockResolvedValue(EMPTY_SNAPSHOT);

        const useFinancialsPeriod = await importHook();
        const { result } = renderHook(() =>
            useFinancialsPeriod('AAPL', ANNUAL_SNAPSHOT)
        );

        act(() => result.current.setPeriod('quarter'));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.quarterUnavailable).toBe(true);
    });

    it('does not raise the notice when a late failure lands after the user went back to annual', async () => {
        let rejectAction: (error: Error) => void = () => undefined;
        mockGetFinancialsQuarterAction.mockReturnValue(
            new Promise<FinancialsSnapshot>((_, reject) => {
                rejectAction = reject;
            })
        );

        const useFinancialsPeriod = await importHook();
        const { result } = renderHook(() =>
            useFinancialsPeriod('AAPL', ANNUAL_SNAPSHOT)
        );

        act(() => result.current.setPeriod('quarter'));
        act(() => result.current.setPeriod('annual'));
        await act(async () => {
            rejectAction(new Error('late failure'));
        });

        expect(result.current.period).toBe('annual');
        expect(result.current.quarterUnavailable).toBe(false);
    });
});
