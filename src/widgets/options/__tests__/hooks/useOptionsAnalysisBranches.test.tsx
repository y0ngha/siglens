/**
 * Branch coverage tests for useOptionsAnalysis — targets uncovered branches in
 * fetchOptionsAnalysis: aborted signal, no_chains_error, gate blocked, key_error,
 * poll error with/without message, non-Error wrapping, onJobId guard.
 */

import type { MockedFunction, Mock } from 'vitest';
import { useOptionsAnalysis } from '@/widgets/options/hooks/useOptionsAnalysis';
import { useHydrated } from '@/shared/hooks/useHydrated';
import {
    pollOptionsAnalysisAction,
    submitOptionsAnalysisAction,
} from '@/entities/options-chain/actions';
import { isGateBlockedResult } from '@/entities/analysis';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { OptionsAnalysisResponse } from '@y0ngha/siglens-core';
import type { ReactNode } from 'react';

vi.mock('@/entities/options-chain/actions', () => ({
    submitOptionsAnalysisAction: vi.fn(),
    pollOptionsAnalysisAction: vi.fn(),
    cancelOptionsAnalysisJobAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/entities/analysis', () => ({
    isGateBlockedResult: vi.fn().mockReturnValue(false),
}));

vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/shared/hooks/usePageHideCancel', () => ({
    usePageHideCancel: vi.fn(),
}));

// SSR hydration gate — default hydrated so existing tests fetch on mount; the
// gate-closed test flips it to false to assert the auto-trigger is suppressed.
vi.mock('@/shared/hooks/useHydrated', () => ({
    useHydrated: vi.fn(() => true),
}));

const mockSubmit = submitOptionsAnalysisAction as MockedFunction<
    typeof submitOptionsAnalysisAction
>;
const mockPoll = pollOptionsAnalysisAction as MockedFunction<
    typeof pollOptionsAnalysisAction
>;
const mockIsGateBlocked = isGateBlockedResult as unknown as Mock;
const mockUseHydrated = vi.mocked(useHydrated);

const RESULT: OptionsAnalysisResponse = {
    summary: 'Bullish outlook',
    perExpiration: [],
    signals: [],
    analyzedAt: '2025-01-01T00:00:00Z',
};

const queryClients: QueryClient[] = [];

function makeWrapper() {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    queryClients.push(client);
    return function Wrapper({ children }: { children: ReactNode }) {
        return (
            <QueryClientProvider client={client}>
                {children}
            </QueryClientProvider>
        );
    };
}

const DEFAULT_PROPS = {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    expirationDate: '2025-06-20' as const,
    modelId: 'gemini-2.5-flash-lite' as const,
};

describe('useOptionsAnalysis — branch coverage', () => {
    beforeEach(() => {
        mockSubmit.mockReset();
        mockPoll.mockReset();
        mockIsGateBlocked.mockReturnValue(false);
        mockUseHydrated.mockReturnValue(true);
    });

    afterEach(() => {
        queryClients.splice(0).forEach(client => client.clear());
    });

    it('returns error for no_chains_error with message', async () => {
        mockSubmit.mockResolvedValue({
            status: 'no_chains_error',
            error: '옵션 데이터가 없습니다.',
        } as never);

        const { result } = renderHook(() => useOptionsAnalysis(DEFAULT_PROPS), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });

        if (result.current.status !== 'error')
            throw new Error('expected error');
        expect(result.current.error.message).toBe('옵션 데이터가 없습니다.');
    });

    it('returns fallback for no_chains_error without message', async () => {
        mockSubmit.mockResolvedValue({
            status: 'no_chains_error',
        } as never);

        const { result } = renderHook(() => useOptionsAnalysis(DEFAULT_PROPS), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });

        if (result.current.status !== 'error')
            throw new Error('expected error');
        expect(result.current.error.message).toContain(
            '옵션 데이터가 없습니다'
        );
    });

    it('returns error for gate blocked', async () => {
        mockIsGateBlocked.mockReturnValue(true);
        mockSubmit.mockResolvedValue({
            status: 'error',
            error: { code: 'tier_exceeded', message: '한도 초과' },
        } as never);

        const { result } = renderHook(() => useOptionsAnalysis(DEFAULT_PROPS), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });

        if (result.current.status !== 'error')
            throw new Error('expected error');
        expect(result.current.error.message).toBe('한도 초과');
    });

    it('returns error for key_error', async () => {
        mockSubmit.mockResolvedValue({
            status: 'key_error',
            error: 'API key invalid',
        } as never);

        const { result } = renderHook(() => useOptionsAnalysis(DEFAULT_PROPS), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });

        if (result.current.status !== 'error')
            throw new Error('expected error');
        expect(result.current.error.message).toBe('API key invalid');
    });

    it('returns done when poll returns done after submitted', async () => {
        mockSubmit.mockResolvedValue({
            status: 'submitted',
            jobId: 'opt-job-1',
        } as never);
        mockPoll.mockResolvedValueOnce({
            status: 'done',
            result: RESULT,
        });

        const { result } = renderHook(() => useOptionsAnalysis(DEFAULT_PROPS), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => {
            expect(result.current.status).toBe('done');
        });
    });

    it('returns error when poll returns error with message', async () => {
        mockSubmit.mockResolvedValue({
            status: 'submitted',
            jobId: 'opt-job-1',
        } as never);
        mockPoll.mockResolvedValueOnce({
            status: 'error',
            error: '분석 실패',
        });

        const { result } = renderHook(() => useOptionsAnalysis(DEFAULT_PROPS), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });

        if (result.current.status !== 'error')
            throw new Error('expected error');
        expect(result.current.error.message).toBe('분석 실패');
    });

    it('returns generic error when poll error has no message', async () => {
        mockSubmit.mockResolvedValue({
            status: 'submitted',
            jobId: 'opt-job-1',
        } as never);
        mockPoll.mockResolvedValueOnce({
            status: 'error',
        } as { status: 'error'; error: string });

        const { result } = renderHook(() => useOptionsAnalysis(DEFAULT_PROPS), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });

        if (result.current.status !== 'error')
            throw new Error('expected error');
        expect(result.current.error.message).toContain('오류가 발생했습니다');
    });

    it('wraps non-Error thrown value', async () => {
        mockSubmit.mockRejectedValue('string error');

        const { result } = renderHook(() => useOptionsAnalysis(DEFAULT_PROPS), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });

        if (result.current.status !== 'error')
            throw new Error('expected error');
        expect(result.current.error).toBeInstanceOf(Error);
    });

    it('does not fetch while the SSR hydration gate is closed', async () => {
        mockUseHydrated.mockReturnValue(false);
        mockSubmit.mockResolvedValue({
            status: 'submitted',
            jobId: 'gate-closed',
        } as never);

        const { result } = renderHook(() => useOptionsAnalysis(DEFAULT_PROPS), {
            wrapper: makeWrapper(),
        });

        // Flush any (incorrectly) queued async work — if the gate leaked, the
        // auto-trigger effect would have called submit within this tick.
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockSubmit).not.toHaveBeenCalled();
        expect(result.current.status).toBe('loading');
    });

    it('cancels job on unmount when polling', async () => {
        const mockCancelOptions = (
            await import('@/entities/options-chain/actions')
        ).cancelOptionsAnalysisJobAction as MockedFunction<
            typeof import('@/entities/options-chain/actions').cancelOptionsAnalysisJobAction
        >;

        mockSubmit.mockResolvedValue({
            status: 'submitted',
            jobId: 'opt-job-cancel',
        } as never);
        mockPoll.mockImplementation(() => new Promise(() => {}));

        const { unmount } = renderHook(
            () => useOptionsAnalysis(DEFAULT_PROPS),
            { wrapper: makeWrapper() }
        );

        await waitFor(() => {
            expect(mockPoll).toHaveBeenCalled();
        });

        unmount();

        expect(mockCancelOptions).toHaveBeenCalledWith('opt-job-cancel');
    });
});
