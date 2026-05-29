/**
 * Branch coverage tests for useOverallAnalysis — targets uncovered branches:
 * miss_no_trigger (bot blocked), key_error, gate blocked error,
 * non-string error in submit, poll error without message,
 * BotBlockedError in state memo, non-Error in state memo,
 * getPageHideJobs with partial dependency jobs.
 */

import type { MockedFunction, Mock } from 'vitest';
import { useOverallAnalysis } from '@/widgets/overall/hooks/useOverallAnalysis';
import { useHydrated } from '@/shared/hooks/useHydrated';
import {
    submitOverallAnalysisAction,
    pollOverallAnalysisAction,
    pollAnalysisAction,
} from '@/entities/analysis/actions';
import { isGateBlockedResult } from '@/entities/analysis';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

vi.mock('@/entities/analysis/actions', () => ({
    submitOverallAnalysisAction: vi.fn(),
    pollOverallAnalysisAction: vi.fn(),
    pollAnalysisAction: vi.fn(),
    pollFundamentalAnalysisAction: vi.fn(),
    cancelAnalysisJobAction: vi.fn().mockResolvedValue(undefined),
    cancelFundamentalAnalysisJobAction: vi.fn().mockResolvedValue(undefined),
    cancelOverallAnalysisJobAction: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/entities/news-article/actions', () => ({
    pollNewsAnalysisAction: vi.fn(),
    cancelNewsAnalysisJobAction: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/entities/options-chain/actions', () => ({
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
// SSR hydration gate — default hydrated so existing tests fetch on trigger; the
// gate-closed test flips it to false to assert the query stays disabled.
vi.mock('@/shared/hooks/useHydrated', () => ({
    useHydrated: vi.fn(() => true),
}));

const mockSubmit = submitOverallAnalysisAction as MockedFunction<
    typeof submitOverallAnalysisAction
>;
const mockPollOverall = pollOverallAnalysisAction as MockedFunction<
    typeof pollOverallAnalysisAction
>;
const mockIsGateBlocked = isGateBlockedResult as unknown as Mock;
const mockUseHydrated = useHydrated as Mock;

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

function hookArgs() {
    return ['AAPL', 'Apple Inc.', '1Day', 'gemini-2.5-flash-lite'] as const;
}

describe('useOverallAnalysis — branch coverage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsGateBlocked.mockReturnValue(false);
        mockUseHydrated.mockReturnValue(true);
    });

    afterEach(() => {
        queryClients.splice(0).forEach(client => client.clear());
    });

    it('returns bot_blocked when submit returns miss_no_trigger', async () => {
        mockSubmit.mockResolvedValue({
            status: 'miss_no_trigger',
        } as never);

        const { result } = renderHook(() => useOverallAnalysis(...hookArgs()), {
            wrapper: makeWrapper(),
        });

        act(() => {
            result.current.trigger();
        });

        await waitFor(() => {
            expect(result.current.state.status).toBe('bot_blocked');
        });
    });

    it('does not submit while the SSR hydration gate is closed even after trigger', async () => {
        mockUseHydrated.mockReturnValue(false);
        mockSubmit.mockResolvedValue({
            status: 'submitted',
            jobId: 'gate-closed',
        } as never);

        const { result } = renderHook(() => useOverallAnalysis(...hookArgs()), {
            wrapper: makeWrapper(),
        });

        act(() => {
            result.current.trigger();
        });

        // enabled = isHydrated && triggered → false while the gate is closed.
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockSubmit).not.toHaveBeenCalled();
        expect(result.current.state.status).toBe('submitting');
    });

    it('returns error for gate-blocked result', async () => {
        mockIsGateBlocked.mockReturnValue(true);
        mockSubmit.mockResolvedValue({
            status: 'error',
            error: { code: 'tier_exceeded', message: '등급 제한 초과' },
        } as never);

        const { result } = renderHook(() => useOverallAnalysis(...hookArgs()), {
            wrapper: makeWrapper(),
        });

        act(() => {
            result.current.trigger();
        });

        await waitFor(() => {
            expect(result.current.state.status).toBe('error');
        });

        const state = result.current.state;
        if (state.status !== 'error') throw new Error('expected error');
        expect(state.error).toBe('등급 제한 초과');
    });

    it('returns error for non-string error in submit', async () => {
        mockSubmit.mockResolvedValue({
            status: 'error',
            error: 12345,
            axis: 'fundamental',
        } as never);

        const { result } = renderHook(() => useOverallAnalysis(...hookArgs()), {
            wrapper: makeWrapper(),
        });

        act(() => {
            result.current.trigger();
        });

        await waitFor(() => {
            expect(result.current.state.status).toBe('error');
        });

        const state = result.current.state;
        if (state.status !== 'error') throw new Error('expected error');
        expect(state.error).toContain('오류가 발생했습니다');
    });

    it('returns error for key_error', async () => {
        mockSubmit.mockResolvedValue({
            status: 'key_error',
            error: 'API key invalid',
        } as never);

        const { result } = renderHook(() => useOverallAnalysis(...hookArgs()), {
            wrapper: makeWrapper(),
        });

        act(() => {
            result.current.trigger();
        });

        await waitFor(() => {
            expect(result.current.state.status).toBe('error');
        });

        const state = result.current.state;
        if (state.status !== 'error') throw new Error('expected error');
        expect(state.error).toBe('API key invalid');
    });

    it('returns error with generic message when poll error has no message', async () => {
        mockSubmit.mockResolvedValue({
            status: 'submitted',
            jobId: 'overall-job',
        } as never);
        mockPollOverall.mockResolvedValueOnce({
            status: 'error',
        } as { status: 'error'; error: string });

        const { result } = renderHook(() => useOverallAnalysis(...hookArgs()), {
            wrapper: makeWrapper(),
        });

        act(() => {
            result.current.trigger();
        });

        await waitFor(() => {
            expect(result.current.state.status).toBe('error');
        });

        const state = result.current.state;
        if (state.status !== 'error') throw new Error('expected error');
        expect(state.error).toContain('오류가 발생했습니다');
    });

    it('dependency poll error without message uses default', async () => {
        mockSubmit.mockResolvedValue({
            status: 'pending_dependencies',
            pendingJobs: {
                technical: 'job-t',
                fundamental: undefined,
                news: undefined,
                options: undefined,
            },
        } as never);
        (pollAnalysisAction as Mock).mockResolvedValue({
            status: 'error',
        });

        const { result } = renderHook(() => useOverallAnalysis(...hookArgs()), {
            wrapper: makeWrapper(),
        });

        act(() => {
            result.current.trigger();
        });

        await waitFor(() => {
            expect(result.current.state.status).toBe('error');
        });

        const state = result.current.state;
        if (state.status !== 'error') throw new Error('expected error');
        expect(state.error).toContain('오류가 발생했습니다');
        expect(state.axis).toBe('technical');
    });

    it('returns submitting status immediately after trigger', async () => {
        mockSubmit.mockImplementation(() => new Promise(() => {}));

        const { result } = renderHook(() => useOverallAnalysis(...hookArgs()), {
            wrapper: makeWrapper(),
        });

        act(() => {
            result.current.trigger();
        });

        // Should be submitting since we're waiting
        expect(result.current.state.status).toBe('submitting');
    });

    it('returns submitting/polling state during overall polling phase', async () => {
        mockSubmit.mockResolvedValue({
            status: 'submitted',
            jobId: 'overall-job',
        } as never);
        // Never resolve poll — stay in polling state
        mockPollOverall.mockImplementation(() => new Promise(() => {}));

        const { result, unmount } = renderHook(
            () => useOverallAnalysis(...hookArgs()),
            { wrapper: makeWrapper() }
        );

        act(() => {
            result.current.trigger();
        });

        await waitFor(() => {
            expect(result.current.state.status).toBe('polling');
        });

        unmount();
    });
});
