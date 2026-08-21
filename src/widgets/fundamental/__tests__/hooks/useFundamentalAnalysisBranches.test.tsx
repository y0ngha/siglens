/**
 * Branch coverage tests for useFundamentalAnalysis — targets uncovered branches in
 * fetchFundamentalAnalysis: miss_no_trigger, gate blocked, fetch_failed, key_error,
 * non-Error query error wrapping, and the hydration gate path.
 *
 * Poll/cancel machinery has been removed; run* functions return results directly.
 */

import koMessages from '../../../../../messages/ko.json';
import type { Mock } from 'vitest';
import { useFundamentalAnalysis } from '@/widgets/fundamental/hooks/useFundamentalAnalysis';
import { runAnalysisStream } from '@/shared/hooks/useAnalysisStream';
import { isGateBlockedResult } from '@/entities/analysis';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { FundamentalAnalysisResponse } from '@y0ngha/siglens-core';
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

const mockSubmit = runAnalysisStream as Mock;
const mockIsGateBlocked = isGateBlockedResult as unknown as Mock;

const RESULT: FundamentalAnalysisResponse = {
    financialHealth: { score: 8 },
    futureDirection: { outlook: 'positive' },
    summary: '테스트',
    analyzedAt: '2025-01-01T00:00:00Z',
} as unknown as FundamentalAnalysisResponse;

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

describe('useFundamentalAnalysis — branch coverage', () => {
    beforeEach(() => {
        mockSubmit.mockReset();
        mockIsGateBlocked.mockReturnValue(false);
    });

    afterEach(() => {
        queryClients.splice(0).forEach(client => client.clear());
    });

    it('returns done when submit returns cached result', async () => {
        mockSubmit.mockResolvedValue({ status: 'cached', result: RESULT });

        const { result } = renderHook(
            () => useFundamentalAnalysis('AAPL', 'gemini-2.5-flash-lite'),
            { wrapper: makeWrapper() }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('done');
        });
    });

    it('returns bot_blocked when submit returns miss_no_trigger', async () => {
        mockSubmit.mockResolvedValue({ status: 'miss_no_trigger' } as never);

        const { result } = renderHook(
            () => useFundamentalAnalysis('AAPL', 'gemini-2.5-flash-lite'),
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
            () => useFundamentalAnalysis('AAPL', 'gemini-2.5-flash-lite'),
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
            // core가 실제로 주는 값은 영어 예외 문자열이다.
            error: 'Profile not found for symbol: AAPL',
        } as never);

        const { result } = renderHook(
            () => useFundamentalAnalysis('AAPL', 'gemini-2.5-flash-lite'),
            { wrapper: makeWrapper() }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });

        if (result.current.status !== 'error')
            throw new Error('expected error');
        // 원문이 그대로 새면 전 로케일에 영어가 나간다 — 카탈로그를 거쳐야 한다.
        expect(result.current.error.message).toBe(
            koMessages.app.api.stream.fetchFailed
        );
        expect(result.current.error.message).not.toContain('Profile not found');
    });

    it('returns fallback message for fetch_failed without error string', async () => {
        mockSubmit.mockResolvedValue({
            status: 'error',
            code: 'fetch_failed',
        } as never);

        const { result } = renderHook(
            () => useFundamentalAnalysis('AAPL', 'gemini-2.5-flash-lite'),
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
            () => useFundamentalAnalysis('AAPL', 'gemini-2.5-flash-lite'),
            { wrapper: makeWrapper() }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });

        if (result.current.status !== 'error')
            throw new Error('expected error');
        expect(result.current.error.message).toBe(
            koMessages.app.api.stream.limitExceeded
        );
    });

    it('returns error for key_error status', async () => {
        mockSubmit.mockResolvedValue({
            status: 'key_error',
            error: 'API key missing',
        } as never);

        const { result } = renderHook(
            () => useFundamentalAnalysis('AAPL', 'gemini-2.5-flash-lite'),
            { wrapper: makeWrapper() }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });

        if (result.current.status !== 'error')
            throw new Error('expected error');
        expect(result.current.error.message).toBe(
            koMessages.app.api.stream.keyRequired
        );
    });

    it('non-Error query error gets wrapped', async () => {
        mockSubmit.mockRejectedValue('string error');

        const { result } = renderHook(
            () => useFundamentalAnalysis('AAPL', 'gemini-2.5-flash-lite'),
            { wrapper: makeWrapper() }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });

        if (result.current.status !== 'error')
            throw new Error('expected error');
        expect(result.current.error).toBeInstanceOf(Error);
    });

    it('does not fetch while the settings-hydration gate is closed', async () => {
        mockSubmit.mockResolvedValue({
            status: 'cached',
            result: RESULT,
        });

        const { result } = renderHook(
            () =>
                useFundamentalAnalysis(
                    'AAPL',
                    'gemini-2.5-flash-lite',
                    false,
                    false
                ),
            { wrapper: makeWrapper() }
        );

        // Flush any (incorrectly) queued async work — if the gate leaked, the
        // auto-trigger effect would have called submit within this tick.
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockSubmit).not.toHaveBeenCalled();
        expect(result.current.status).toBe('loading');
    });

    it('skips refetch when query data already exists', async () => {
        mockSubmit.mockResolvedValue({ status: 'cached', result: RESULT });

        const wrapper = makeWrapper();
        const { result, rerender } = renderHook(
            () => useFundamentalAnalysis('AAPL', 'gemini-2.5-flash-lite'),
            { wrapper }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('done');
        });

        // Rerender should not trigger another submit
        rerender();

        expect(mockSubmit).toHaveBeenCalledTimes(1);
    });
});
