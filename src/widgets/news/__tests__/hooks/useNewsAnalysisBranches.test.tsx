/**
 * Branch coverage tests for useNewsAnalysis — targets uncovered branches in
 * fetchNewsAnalysis: error codes (no_news, usage_limit_exceeded, key_error,
 * gate blocked), poll error with/without error message, and aborted signal.
 */

import type { MockedFunction, Mock } from 'vitest';
import { useNewsAnalysis } from '@/widgets/news/hooks/useNewsAnalysis';
import { useHydrated } from '@/shared/hooks/useHydrated';
import {
    pollNewsAnalysisAction,
    submitNewsAnalysisAction,
} from '@/entities/news-article/actions';
import { isGateBlockedResult } from '@/entities/analysis';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { NewsAnalysisResponse } from '@y0ngha/siglens-core';
import type { ReactNode } from 'react';

vi.mock('@/entities/news-article/actions', () => ({
    submitNewsAnalysisAction: vi.fn(),
    pollNewsAnalysisAction: vi.fn(),
    cancelNewsAnalysisJobAction: vi.fn().mockResolvedValue(undefined),
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

const mockSubmit = submitNewsAnalysisAction as MockedFunction<
    typeof submitNewsAnalysisAction
>;
const mockPoll = pollNewsAnalysisAction as MockedFunction<
    typeof pollNewsAnalysisAction
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

describe('useNewsAnalysis — branch coverage', () => {
    beforeEach(() => {
        mockSubmit.mockReset();
        mockPoll.mockReset();
        mockIsGateBlocked.mockReturnValue(false);
        mockUseHydrated.mockReturnValue(true);
    });

    afterEach(() => {
        queryClients.splice(0).forEach(client => client.clear());
    });

    it('returns bot_blocked when submit returns miss_no_trigger', async () => {
        mockSubmit.mockResolvedValue({ status: 'miss_no_trigger' } as never);

        const { result } = renderHook(
            () =>
                useNewsAnalysis('AAPL', 'Apple Inc.', 'gemini-2.5-flash-lite'),
            { wrapper: makeWrapper() }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('bot_blocked');
        });
    });

    it('throws gate error when submit returns gate-blocked error', async () => {
        mockIsGateBlocked.mockReturnValue(true);
        mockSubmit.mockResolvedValue({
            status: 'error',
            error: { code: 'tier_exceeded', message: '한도 초과 메시지' },
        } as never);

        const { result } = renderHook(
            () =>
                useNewsAnalysis('AAPL', 'Apple Inc.', 'gemini-2.5-flash-lite'),
            { wrapper: makeWrapper() }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });

        if (result.current.status !== 'error')
            throw new Error('expected error');
        expect(result.current.error.message).toBe('한도 초과 메시지');
    });

    it('returns error for no_news code', async () => {
        mockSubmit.mockResolvedValue({
            status: 'error',
            code: 'no_news',
            error: { message: '' },
        } as never);

        const { result } = renderHook(
            () =>
                useNewsAnalysis('AAPL', 'Apple Inc.', 'gemini-2.5-flash-lite'),
            { wrapper: makeWrapper() }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });

        if (result.current.status !== 'error')
            throw new Error('expected error');
        expect(result.current.error.message).toContain('뉴스가 없습니다');
    });

    it('returns error for usage_limit_exceeded code', async () => {
        mockSubmit.mockResolvedValue({
            status: 'error',
            code: 'usage_limit_exceeded',
            error: { message: '사용량 한도 초과입니다.' },
        } as never);

        const { result } = renderHook(
            () =>
                useNewsAnalysis('AAPL', 'Apple Inc.', 'gemini-2.5-flash-lite'),
            { wrapper: makeWrapper() }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });

        if (result.current.status !== 'error')
            throw new Error('expected error');
        expect(result.current.error.message).toBe('사용량 한도 초과입니다.');
    });

    it('returns generic error for error status without known code', async () => {
        mockSubmit.mockResolvedValue({
            status: 'error',
            code: 'unknown',
            error: { message: '' },
        } as never);

        const { result } = renderHook(
            () =>
                useNewsAnalysis('AAPL', 'Apple Inc.', 'gemini-2.5-flash-lite'),
            { wrapper: makeWrapper() }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });

        if (result.current.status !== 'error')
            throw new Error('expected error');
        expect(result.current.error.message).toContain('오류가 발생했습니다');
    });

    it('returns error for key_error status', async () => {
        mockSubmit.mockResolvedValue({
            status: 'key_error',
            error: 'API key is missing',
        } as never);

        const { result } = renderHook(
            () =>
                useNewsAnalysis('AAPL', 'Apple Inc.', 'gemini-2.5-flash-lite'),
            { wrapper: makeWrapper() }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });

        if (result.current.status !== 'error')
            throw new Error('expected error');
        expect(result.current.error.message).toBe('API key is missing');
    });

    it('returns done when poll returns done', async () => {
        const newsResult: NewsAnalysisResponse = {
            overallSentiment: 'bullish',
            currentDriverKo: '테스트',
            keyEventsKo: [],
            upcomingEventsKo: [],
        };

        mockSubmit.mockResolvedValue({
            status: 'submitted',
            jobId: 'job-news-1',
        } as never);
        mockPoll.mockResolvedValueOnce({
            status: 'done',
            result: newsResult,
        });

        const { result } = renderHook(
            () =>
                useNewsAnalysis('AAPL', 'Apple Inc.', 'gemini-2.5-flash-lite'),
            { wrapper: makeWrapper() }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('done');
        });
    });

    it('returns error when poll returns error with message', async () => {
        mockSubmit.mockResolvedValue({
            status: 'submitted',
            jobId: 'job-news-1',
        } as never);
        mockPoll.mockResolvedValueOnce({
            status: 'error',
            error: '폴링 에러 메시지',
        });

        const { result } = renderHook(
            () =>
                useNewsAnalysis('AAPL', 'Apple Inc.', 'gemini-2.5-flash-lite'),
            { wrapper: makeWrapper() }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });

        if (result.current.status !== 'error')
            throw new Error('expected error');
        expect(result.current.error.message).toBe('폴링 에러 메시지');
    });

    it('returns generic error when poll returns error without message', async () => {
        mockSubmit.mockResolvedValue({
            status: 'submitted',
            jobId: 'job-news-1',
        } as never);
        mockPoll.mockResolvedValueOnce({
            status: 'error',
        } as { status: 'error'; error: string });

        const { result } = renderHook(
            () =>
                useNewsAnalysis('AAPL', 'Apple Inc.', 'gemini-2.5-flash-lite'),
            { wrapper: makeWrapper() }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });

        if (result.current.status !== 'error')
            throw new Error('expected error');
        expect(result.current.error.message).toContain('오류가 발생했습니다');
    });

    it('error that is not an Error instance gets wrapped', async () => {
        mockSubmit.mockRejectedValue('string error');

        const { result } = renderHook(
            () =>
                useNewsAnalysis('AAPL', 'Apple Inc.', 'gemini-2.5-flash-lite'),
            { wrapper: makeWrapper() }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });

        if (result.current.status !== 'error')
            throw new Error('expected error');
        expect(result.current.error).toBeInstanceOf(Error);
    });

    it('does not fetch while the SSR hydration gate is closed (enabled defaults true)', async () => {
        mockUseHydrated.mockReturnValue(false);
        mockSubmit.mockResolvedValue({
            status: 'submitted',
            jobId: 'gate-closed',
        } as never);

        const { result } = renderHook(
            () =>
                useNewsAnalysis('AAPL', 'Apple Inc.', 'gemini-2.5-flash-lite'),
            { wrapper: makeWrapper() }
        );

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockSubmit).not.toHaveBeenCalled();
        expect(result.current.status).toBe('loading');
    });

    it('enabled=false prevents fetching', async () => {
        const { result } = renderHook(
            () =>
                useNewsAnalysis('AAPL', 'Apple Inc.', 'gemini-2.5-flash-lite', {
                    enabled: false,
                }),
            { wrapper: makeWrapper() }
        );

        expect(result.current.status).toBe('loading');
        expect(mockSubmit).not.toHaveBeenCalled();
    });
});
