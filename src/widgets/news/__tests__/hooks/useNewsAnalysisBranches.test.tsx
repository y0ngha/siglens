/**
 * Branch coverage tests for useNewsAnalysis — targets uncovered branches in
 * fetchNewsAnalysis: error codes (no_news, usage_limit_exceeded, key_error,
 * gate blocked), non-Error query error wrapping, and the hydration gate path.
 *
 * Poll/cancel machinery has been removed; run* functions return results directly.
 */

import type { Mock } from 'vitest';
import koMessages from '../../../../../messages/ko.json';
import { useNewsAnalysis } from '@/widgets/news/hooks/useNewsAnalysis';
import { runAnalysisStream } from '@/shared/hooks/useAnalysisStream';
import { isGateBlockedResult } from '@/entities/analysis';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { NewsAnalysisResponse } from '@y0ngha/siglens-core';
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
        mockIsGateBlocked.mockReturnValue(false);
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
        /**
         * core가 준 문구는 **전 로케일 영어**(`Daily analysis usage limit exceeded.`)라
         * 그대로 통과시키면 한국어 사용자도 영어를 본다. 코드만 믿고 카탈로그로
         * 갈아끼우는지 본다 — 액션이 준 문구가 그대로 나오면 실패다.
         */
        expect(result.current.error.message).toBe(
            koMessages.app.api.stream.limitExceeded
        );
        expect(result.current.error.message).not.toBe(
            '사용량 한도 초과입니다.'
        );
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
        // core의 `USER_API_KEY_REQUIRED_MESSAGE`는 전 로케일 한국어다.
        expect(result.current.error.message).toBe(
            koMessages.app.api.stream.keyRequired
        );
        expect(result.current.error.message).not.toBe('API key is missing');
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

    it('does not fetch while the settings-hydration gate is closed (enabled defaults true)', async () => {
        mockSubmit.mockResolvedValue({
            status: 'cached',
            result: {
                overallSentiment: 'bullish',
                currentDriverKo: '테스트',
                keyEventsKo: [],
                upcomingEventsKo: [],
            } as NewsAnalysisResponse,
        });

        const { result } = renderHook(
            () =>
                useNewsAnalysis('AAPL', 'Apple Inc.', 'gemini-2.5-flash-lite', {
                    isSettingsHydrated: false,
                }),
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
