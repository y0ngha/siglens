/**
 * Branch coverage tests for useOverallAnalysis — targets uncovered branches:
 * miss_no_trigger (bot blocked), key_error, gate blocked error,
 * non-string error in submit, hydration gate, submitting state.
 *
 * Poll/cancel/pending_dependencies machinery has been removed; run* functions
 * return results directly.
 */

import type { Mock } from 'vitest';
import { useOverallAnalysis } from '@/widgets/overall/hooks/useOverallAnalysis';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { runAnalysisStream } from '@/shared/hooks/useAnalysisStream';
import { isGateBlockedResult } from '@/entities/analysis';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

vi.mock('@/shared/hooks/useAnalysisStream', () => ({
    runAnalysisStream: vi.fn(),
}));
vi.mock('@/entities/analysis', () => ({
    isGateBlockedResult: vi.fn().mockReturnValue(false),
}));
vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));
// SSR hydration gate — default hydrated so existing tests fetch on trigger; the
// gate-closed test flips it to false to assert the query stays disabled.
vi.mock('@/shared/hooks/useHydrated', () => ({
    useHydrated: vi.fn(() => true),
}));

const mockSubmit = runAnalysisStream as Mock;
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
        mockSubmit.mockReset();
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
            status: 'cached',
            result: {
                headlineKo: 'test',
                technicalBulletsKo: [],
                fundamentalBulletsKo: [],
                newsBulletsKo: [],
                optionsBulletsKo: [],
                financialsBulletsKo: [],
                integratedConclusionKo: '중립',
                scenarios: [],
                riskFactorsKo: [],
            } as never,
        });

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
});
