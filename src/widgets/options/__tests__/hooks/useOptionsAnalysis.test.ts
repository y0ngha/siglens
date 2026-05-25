// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { useOptionsAnalysis } from '@/widgets/options/hooks/useOptionsAnalysis';
import {
    submitOptionsAnalysisAction,
    pollOptionsAnalysisAction,
} from '@/entities/options-chain/actions';
import type { OptionsAnalysisResponse } from '@y0ngha/siglens-core';

vi.mock('@/entities/options-chain/actions', () => ({
    submitOptionsAnalysisAction: vi.fn(),
    pollOptionsAnalysisAction: vi.fn(),
    cancelOptionsAnalysisJobAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/entities/analysis', () => ({
    isGateBlockedResult: () => false,
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

const mockSubmit = submitOptionsAnalysisAction as ReturnType<typeof vi.fn>;
const mockPoll = pollOptionsAnalysisAction as ReturnType<typeof vi.fn>;

const RESULT: OptionsAnalysisResponse = {
    summary: 'Bullish outlook',
    perExpiration: [],
    signals: [],
    analyzedAt: '2025-01-01T00:00:00Z',
};

function makeWrapper() {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return {
        client,
        wrapper: ({ children }: { children: ReactNode }) =>
            createElement(QueryClientProvider, { client }, children),
    };
}

describe('useOptionsAnalysis', () => {
    afterEach(() => {
        mockSubmit.mockReset();
        mockPoll.mockReset();
    });

    it('returns loading initially and auto-triggers on mount', () => {
        mockSubmit.mockImplementation(() => new Promise(() => {}));
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(
            () =>
                useOptionsAnalysis({
                    symbol: 'AAPL',
                    companyName: 'Apple Inc.',
                    expirationDate: '2025-06-20',
                    modelId: 'gemini-2.5-flash-lite',
                }),
            { wrapper }
        );
        expect(result.current.status).toBe('loading');
        client.clear();
    });

    it('returns done when submit returns cached result', async () => {
        mockSubmit.mockResolvedValue({
            status: 'cached',
            result: RESULT,
        });
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(
            () =>
                useOptionsAnalysis({
                    symbol: 'AAPL',
                    companyName: 'Apple Inc.',
                    expirationDate: '2025-06-20',
                    modelId: 'gemini-2.5-flash-lite',
                }),
            { wrapper }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('done');
        });

        if (result.current.status !== 'done') throw new Error('expected done');
        expect(result.current.result).toEqual(RESULT);
        client.clear();
    });

    it('returns error when submit returns limit_error', async () => {
        mockSubmit.mockResolvedValue({
            status: 'limit_error',
            error: { message: '한도 초과' },
        });
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(
            () =>
                useOptionsAnalysis({
                    symbol: 'AAPL',
                    companyName: 'Apple Inc.',
                    expirationDate: '2025-06-20',
                    modelId: 'gemini-2.5-flash-lite',
                }),
            { wrapper }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });

        if (result.current.status !== 'error')
            throw new Error('expected error');
        expect(result.current.error.message).toBe('한도 초과');
        client.clear();
    });

    it('returns bot_blocked when submit returns miss_no_trigger', async () => {
        mockSubmit.mockResolvedValue({
            status: 'miss_no_trigger',
        });
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(
            () =>
                useOptionsAnalysis({
                    symbol: 'AAPL',
                    companyName: 'Apple Inc.',
                    expirationDate: '2025-06-20',
                    modelId: 'gemini-2.5-flash-lite',
                }),
            { wrapper }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('bot_blocked');
        });
        client.clear();
    });

    it('polls and returns done when poll resolves', async () => {
        mockSubmit.mockResolvedValue({
            status: 'submitted',
            jobId: 'opt-job-1',
        });
        mockPoll.mockResolvedValueOnce({
            status: 'done',
            result: RESULT,
        });

        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(
            () =>
                useOptionsAnalysis({
                    symbol: 'AAPL',
                    companyName: 'Apple Inc.',
                    expirationDate: '2025-06-20',
                    modelId: 'gemini-2.5-flash-lite',
                }),
            { wrapper }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('done');
        });
        client.clear();
    });
});
