/**
 * Branch coverage tests for useOptionsAnalysis — targets uncovered branches in
 * fetchOptionsAnalysis: no_chains_error, gate blocked, key_error,
 * non-Error wrapping, and the hydration gate path.
 *
 * Poll/cancel machinery has been removed; run* functions return results directly.
 */

import koMessages from '../../../../../messages/ko.json';
import type { Mock } from 'vitest';
import { useOptionsAnalysis } from '@/widgets/options/hooks/useOptionsAnalysis';
import { runAnalysisStream } from '@/shared/hooks/useAnalysisStream';
import { isGateBlockedResult } from '@/entities/analysis';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { OptionsAnalysisResponse } from '@y0ngha/siglens-core';
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
        mockIsGateBlocked.mockReturnValue(false);
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
        expect(result.current.error.message).toBe(
            koMessages.app.api.stream.keyRequired
        );
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

    it('does not fetch while the settings-hydration gate is closed', async () => {
        mockSubmit.mockResolvedValue({
            status: 'cached',
            result: RESULT,
        });

        const { result } = renderHook(
            () =>
                useOptionsAnalysis({
                    ...DEFAULT_PROPS,
                    isSettingsHydrated: false,
                }),
            { wrapper: makeWrapper() }
        );

        // Flush any (incorrectly) queued async work — if the gate leaked, the
        // auto-trigger effect would have called submit within this tick.
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockSubmit).not.toHaveBeenCalled();
        expect(result.current.status).toBe('loading');
    });
});
