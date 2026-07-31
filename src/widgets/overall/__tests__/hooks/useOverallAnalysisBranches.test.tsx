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
import {
    ANALYSIS_POLL_MAX_DURATION_MS,
    ANALYSIS_POLL_TIMEOUT_MESSAGE,
} from '@/shared/config/pollingConfig';
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
const mockUseHydrated = vi.mocked(useHydrated);

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

        // Flush any (incorrectly) queued async work — if the gate leaked, the
        // trigger would have caused submit to fire within this tick.
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

    it('overall-phase poll ceiling → error state when stalled beyond ANALYSIS_POLL_MAX_DURATION_MS', async () => {
        // Mirrors the financials/options/fundamental/news poll-ceiling tests
        // (congress remains on the older call-count pattern — see
        // useCongressTrendBranches.test.tsx — it was not touched by this
        // branch): submitted then stuck in 'processing' (a genuinely
        // stalled job). Date.now() is keyed off an observable event — the
        // poll mock flipping `stalled` — rather than a raw Date.now() call
        // count: counting calls is brittle because any extra Date.now()
        // from React Query/React internals shifts the count and silently
        // breaks the freeze.
        //
        // NOTE: this case does NOT exercise the re-arm itself — submit
        // resolves directly to 'submitted' with no dependency phase in
        // between, so `dependencyPollStartTime` and `finalPollStartTime` are
        // both captured while `stalled === false` and both equal
        // `frozenStart`. That makes the two clocks indistinguishable here;
        // this test only proves the final-phase ceiling still fires when the
        // final job itself stalls. The re-arm (that the final phase's clock
        // is genuinely independent of a slow dependency phase) is covered by
        // the 're-armed final-phase budget' test below.
        mockSubmit.mockResolvedValue({
            status: 'submitted',
            jobId: 'overall-job-stalled',
        } as never);
        const frozenStart = Date.now();
        let stalled = false;
        mockPollOverall.mockImplementation(async () => {
            stalled = true;
            return { status: 'processing' } as never;
        });
        const dateSpy = vi
            .spyOn(Date, 'now')
            .mockImplementation(() =>
                stalled
                    ? frozenStart + ANALYSIS_POLL_MAX_DURATION_MS + 1
                    : frozenStart
            );

        try {
            const { result } = renderHook(
                () => useOverallAnalysis(...hookArgs()),
                { wrapper: makeWrapper() }
            );

            act(() => {
                result.current.trigger();
            });

            await waitFor(() => {
                expect(result.current.state.status).toBe('error');
            });

            const state = result.current.state;
            if (state.status !== 'error') throw new Error('expected error');
            expect(state.error).toBe(ANALYSIS_POLL_TIMEOUT_MESSAGE);
        } finally {
            dateSpy.mockRestore();
        }
    });

    it('dependency-phase poll ceiling → error state when stalled beyond ANALYSIS_POLL_MAX_DURATION_MS', async () => {
        mockSubmit.mockResolvedValue({
            status: 'pending_dependencies',
            pendingJobs: {
                technical: 'job-t',
                fundamental: undefined,
                news: undefined,
                options: undefined,
            },
        } as never);
        const frozenStart = Date.now();
        let stalled = false;
        (pollAnalysisAction as Mock).mockImplementation(async () => {
            stalled = true;
            return { status: 'processing' };
        });
        const dateSpy = vi
            .spyOn(Date, 'now')
            .mockImplementation(() =>
                stalled
                    ? frozenStart + ANALYSIS_POLL_MAX_DURATION_MS + 1
                    : frozenStart
            );

        try {
            const { result } = renderHook(
                () => useOverallAnalysis(...hookArgs()),
                { wrapper: makeWrapper() }
            );

            act(() => {
                result.current.trigger();
            });

            await waitFor(() => {
                expect(result.current.state.status).toBe('error');
            });

            const state = result.current.state;
            if (state.status !== 'error') throw new Error('expected error');
            expect(state.error).toBe(ANALYSIS_POLL_TIMEOUT_MESSAGE);
        } finally {
            dateSpy.mockRestore();
        }
    });

    it('re-armed final-phase budget: finalPollStartTime is captured fresh right after the dependency-phase clock jumps past the ceiling, so the final job completes instead of inheriting a stale timeout', async () => {
        // This is the scenario the re-arm exists for: unlike the two
        // poll-ceiling tests above, submit here goes through
        // pending_dependencies FIRST, so dependencyPollStartTime is captured
        // well before finalPollStartTime.
        //
        // PRE_JUMP_OFFSET (below) is a base offset baked into Date.now()
        // while `dependencyDone` is still false — it is NOT simulated
        // elapsed poll time. dependencyPollStartTime is captured at that
        // same offset (frozenStart + PRE_JUMP_OFFSET), so the dependency
        // loop's only ceiling check (`Date.now() - dependencyPollStartTime`)
        // measures elapsed 0 — the dependency phase never times out on its
        // own. Only once the dependency axis resolves does the mock's
        // Date.now() jump forward to `frozenStart + PRE_JUMP_OFFSET +
        // ANALYSIS_POLL_MAX_DURATION_MS + 1`, a value that is itself over
        // budget relative to `frozenStart` — that's the point: it is
        // deliberately the stale-clock value that WOULD immediately trip
        // the ceiling if the final phase measured elapsed against it. If
        // useOverallAnalysis.ts collapsed back to a single shared
        // `pollStartTime` threaded through both the dependency wait and the
        // final poll loop (instead of re-arming a fresh `finalPollStartTime`
        // after dependencies resolve), the final loop's very first ceiling
        // check would measure elapsed time against that stale
        // dependency-phase start and immediately throw
        // ANALYSIS_POLL_TIMEOUT_MESSAGE — even though the final job itself
        // resolves on the first poll. Under the re-armed (fixed) clock,
        // `finalPollStartTime` is captured fresh at that same jumped
        // instant, so the final loop's own ceiling check measures elapsed
        // ~0 against ITS OWN start, and the job is allowed to complete
        // normally.
        mockSubmit
            .mockResolvedValueOnce({
                status: 'pending_dependencies',
                pendingJobs: {
                    technical: 'job-t',
                    fundamental: undefined,
                    news: undefined,
                    options: undefined,
                },
            } as never)
            .mockResolvedValueOnce({
                status: 'submitted',
                jobId: 'overall-job-after-dependencies',
            } as never);

        const frozenStart = Date.now();
        // The instant the dependency axis resolves ('done'), the mock's
        // Date.now() jumps forward — this is what lets
        // dependencyPollStartTime and finalPollStartTime land on two
        // distinct clock values (see the comment above) even though both
        // are just `Date.now()` calls in the same synchronous test.
        let dependencyDone = false;
        (pollAnalysisAction as Mock).mockImplementation(async () => {
            dependencyDone = true;
            return { status: 'done' };
        });
        mockPollOverall.mockResolvedValue({
            status: 'done',
            result: {} as never,
        } as never);

        // PRE_JUMP_OFFSET is a base offset added to `frozenStart` before the
        // jump — NOT simulated elapsed poll time. dependencyPollStartTime is
        // captured while `dependencyDone` is still false, so it lands at
        // exactly `frozenStart + PRE_JUMP_OFFSET`, making the dependency
        // loop's only ceiling check measure elapsed 0 (see the comment
        // above the test body for why this value's exact magnitude doesn't
        // matter here beyond "some fixed pre-jump offset").
        const PRE_JUMP_OFFSET = ANALYSIS_POLL_MAX_DURATION_MS - 1;
        const dateSpy = vi
            .spyOn(Date, 'now')
            .mockImplementation(() =>
                dependencyDone
                    ? frozenStart +
                      PRE_JUMP_OFFSET +
                      ANALYSIS_POLL_MAX_DURATION_MS +
                      1
                    : frozenStart + PRE_JUMP_OFFSET
            );

        try {
            const { result } = renderHook(
                () => useOverallAnalysis(...hookArgs()),
                { wrapper: makeWrapper() }
            );

            act(() => {
                result.current.trigger();
            });

            await waitFor(() => {
                expect(result.current.state.status).toBe('done');
            });
        } finally {
            dateSpy.mockRestore();
        }
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
