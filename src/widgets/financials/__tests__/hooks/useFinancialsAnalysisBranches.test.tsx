/**
 * Branch coverage tests for useFinancialsAnalysis — targets uncovered branches in
 * fetchFinancialsAnalysis: miss_no_trigger, gate blocked, fetch_failed, key_error,
 * poll error with/without message, non-Error query error wrapping, query data.
 */

import type { MockedFunction, Mock } from 'vitest';
import { useFinancialsAnalysis } from '@/widgets/financials/hooks/useFinancialsAnalysis';
import { useHydrated } from '@/shared/hooks/useHydrated';
import {
    pollFinancialsAnalysisAction,
    submitFinancialsAnalysisAction,
} from '@/entities/analysis/actions';
import { isGateBlockedResult } from '@/entities/analysis';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { FinancialsAnalysisResponse } from '@y0ngha/siglens-core';
import type { ReactNode } from 'react';

vi.mock('@/entities/analysis/actions', () => ({
    submitFinancialsAnalysisAction: vi.fn(),
    pollFinancialsAnalysisAction: vi.fn(),
    cancelFinancialsAnalysisJobAction: vi.fn().mockResolvedValue(undefined),
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

vi.mock('@/widgets/symbol-page', () => ({
    BotBlockedError: class BotBlockedError extends Error {
        constructor() {
            super('bot_blocked');
            this.name = 'BotBlockedError';
        }
    },
}));

// SSR hydration gate — default hydrated so existing tests fetch on mount; the
// gate-closed test flips it to false to assert the auto-trigger is suppressed.
vi.mock('@/shared/hooks/useHydrated', () => ({
    useHydrated: vi.fn(() => true),
}));

const mockSubmit = submitFinancialsAnalysisAction as MockedFunction<
    typeof submitFinancialsAnalysisAction
>;
const mockPoll = pollFinancialsAnalysisAction as MockedFunction<
    typeof pollFinancialsAnalysisAction
>;
const mockIsGateBlocked = isGateBlockedResult as unknown as Mock;
const mockUseHydrated = vi.mocked(useHydrated);

const RESULT: FinancialsAnalysisResponse = {
    overallSentiment: 'bullish',
    overallConclusionKo: '테스트',
    axisAssessments: [],
    riskFactorsKo: [],
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

describe('useFinancialsAnalysis — branch coverage', () => {
    beforeEach(() => {
        mockSubmit.mockReset();
        mockPoll.mockReset();
        mockIsGateBlocked.mockReturnValue(false);
        mockUseHydrated.mockReturnValue(true);
    });

    afterEach(() => {
        queryClients.splice(0).forEach(client => client.clear());
    });

    it('returns done when submit returns cached result', async () => {
        mockSubmit.mockResolvedValue({ status: 'cached', result: RESULT });

        const { result } = renderHook(
            () => useFinancialsAnalysis('AAPL', 'gemini-2.5-flash-lite'),
            { wrapper: makeWrapper() }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('done');
        });
    });

    it('returns bot_blocked when submit returns miss_no_trigger', async () => {
        mockSubmit.mockResolvedValue({ status: 'miss_no_trigger' } as never);

        const { result } = renderHook(
            () => useFinancialsAnalysis('AAPL', 'gemini-2.5-flash-lite'),
            { wrapper: makeWrapper() }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('bot_blocked');
        });
    });

    it('returns error when gate blocked', async () => {
        mockIsGateBlocked.mockReturnValue(true);
        mockSubmit.mockResolvedValue({
            status: 'error',
            error: { code: 'tier_exceeded', message: '한도 초과' },
        } as never);

        const { result } = renderHook(
            () => useFinancialsAnalysis('AAPL', 'gemini-2.5-flash-lite'),
            { wrapper: makeWrapper() }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });

        if (result.current.status !== 'error')
            throw new Error('expected error');
        expect(result.current.error.message).toBe('한도 초과');
    });

    it('returns error for fetch_failed code', async () => {
        mockSubmit.mockResolvedValue({
            status: 'error',
            code: 'fetch_failed',
            error: '데이터 로드 실패',
        } as never);

        const { result } = renderHook(
            () => useFinancialsAnalysis('AAPL', 'gemini-2.5-flash-lite'),
            { wrapper: makeWrapper() }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });

        if (result.current.status !== 'error')
            throw new Error('expected error');
        expect(result.current.error.message).toBe('데이터 로드 실패');
    });

    it('returns fallback message for fetch_failed without error string', async () => {
        mockSubmit.mockResolvedValue({
            status: 'error',
            code: 'fetch_failed',
        } as never);

        const { result } = renderHook(
            () => useFinancialsAnalysis('AAPL', 'gemini-2.5-flash-lite'),
            { wrapper: makeWrapper() }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });

        if (result.current.status !== 'error')
            throw new Error('expected error');
        expect(result.current.error.message).toContain('불러오지 못했습니다');
    });

    it('returns usage limit error for non-fetch_failed code', async () => {
        mockSubmit.mockResolvedValue({
            status: 'error',
            code: 'usage_limit_exceeded',
        } as never);

        const { result } = renderHook(
            () => useFinancialsAnalysis('AAPL', 'gemini-2.5-flash-lite'),
            { wrapper: makeWrapper() }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });

        if (result.current.status !== 'error')
            throw new Error('expected error');
        expect(result.current.error.message).toContain('사용량 한도');
    });

    it('returns error for key_error status', async () => {
        mockSubmit.mockResolvedValue({
            status: 'key_error',
            error: 'API key missing',
        } as never);

        const { result } = renderHook(
            () => useFinancialsAnalysis('AAPL', 'gemini-2.5-flash-lite'),
            { wrapper: makeWrapper() }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });

        if (result.current.status !== 'error')
            throw new Error('expected error');
        expect(result.current.error.message).toBe('API key missing');
    });

    it('returns done when poll returns done', async () => {
        mockSubmit.mockResolvedValue({
            status: 'submitted',
            jobId: 'job-financials-1',
        } as never);
        mockPoll.mockResolvedValueOnce({
            status: 'done',
            result: RESULT,
        });

        const { result } = renderHook(
            () => useFinancialsAnalysis('AAPL', 'gemini-2.5-flash-lite'),
            { wrapper: makeWrapper() }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('done');
        });
    });

    it('returns error when poll returns error with message', async () => {
        mockSubmit.mockResolvedValue({
            status: 'submitted',
            jobId: 'job-financials-1',
        } as never);
        mockPoll.mockResolvedValueOnce({
            status: 'error',
            error: '분석 실패',
        });

        const { result } = renderHook(
            () => useFinancialsAnalysis('AAPL', 'gemini-2.5-flash-lite'),
            { wrapper: makeWrapper() }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });

        if (result.current.status !== 'error')
            throw new Error('expected error');
        expect(result.current.error.message).toBe('분석 실패');
    });

    it('returns generic error when poll returns error without message', async () => {
        mockSubmit.mockResolvedValue({
            status: 'submitted',
            jobId: 'job-financials-1',
        } as never);
        mockPoll.mockResolvedValueOnce({
            status: 'error',
        } as { status: 'error'; error: string });

        const { result } = renderHook(
            () => useFinancialsAnalysis('AAPL', 'gemini-2.5-flash-lite'),
            { wrapper: makeWrapper() }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });

        if (result.current.status !== 'error')
            throw new Error('expected error');
        expect(result.current.error.message).toContain('오류가 발생했습니다');
    });

    it('non-Error query error gets wrapped', async () => {
        mockSubmit.mockRejectedValue('string error');

        const { result } = renderHook(
            () => useFinancialsAnalysis('AAPL', 'gemini-2.5-flash-lite'),
            { wrapper: makeWrapper() }
        );

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

        const { result } = renderHook(
            () => useFinancialsAnalysis('AAPL', 'gemini-2.5-flash-lite'),
            { wrapper: makeWrapper() }
        );

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockSubmit).not.toHaveBeenCalled();
        expect(result.current.status).toBe('loading');
    });

    it('skips refetch when query data already exists', async () => {
        mockSubmit.mockResolvedValue({ status: 'cached', result: RESULT });

        const wrapper = makeWrapper();
        const { result, rerender } = renderHook(
            () => useFinancialsAnalysis('AAPL', 'gemini-2.5-flash-lite'),
            { wrapper }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('done');
        });

        rerender();

        expect(mockSubmit).toHaveBeenCalledTimes(1);
    });
});
