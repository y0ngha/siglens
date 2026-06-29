import type { MockedFunction } from 'vitest';
import { useCongressTrend } from '@/widgets/congress/hooks/useCongressTrend';
import {
    cancelCongressTrendJobAction,
    pollCongressTrendAction,
    submitCongressTrendAction,
} from '@/entities/analysis/actions';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { CongressTrendResponse } from '@y0ngha/siglens-core';
import type { ReactNode } from 'react';

vi.mock('@/entities/analysis/actions', () => ({
    submitCongressTrendAction: vi.fn(),
    pollCongressTrendAction: vi.fn(),
    cancelCongressTrendJobAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

const mockSubmit = submitCongressTrendAction as MockedFunction<
    typeof submitCongressTrendAction
>;
const mockPoll = pollCongressTrendAction as MockedFunction<
    typeof pollCongressTrendAction
>;
const mockCancel = cancelCongressTrendJobAction as MockedFunction<
    typeof cancelCongressTrendJobAction
>;

const CONGRESS_RESULT: CongressTrendResponse = {
    summaryKo: '의회 매수세 우위',
    notableMembersKo: ['Nancy Pelosi'],
    riskNoteKo: '공시 지연 위험',
    overallSentiment: 'bullish',
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

describe('useCongressTrend', () => {
    beforeEach(() => {
        mockSubmit.mockReset();
        mockPoll.mockReset();
        mockCancel.mockReset();
        mockCancel.mockResolvedValue(undefined);
        mockSubmit.mockResolvedValue({
            status: 'cached',
            result: CONGRESS_RESULT,
        });
    });

    afterEach(() => {
        queryClients.splice(0).forEach(client => {
            client.clear();
        });
    });

    it('cached → done 상태로 전이한다', async () => {
        const wrapper = makeWrapper();

        const { result } = renderHook(
            () => useCongressTrend('AAPL', 'gemini-2.5-flash-lite'),
            { wrapper }
        );

        expect(result.current.status).toBe('loading');

        await waitFor(() => {
            expect(result.current.status).toBe('done');
        });

        if (result.current.status !== 'done') {
            throw new Error('expected done state');
        }
        expect(result.current.result).toEqual(CONGRESS_RESULT);
        expect(mockSubmit).toHaveBeenCalledWith(
            'AAPL',
            'gemini-2.5-flash-lite'
        );
    });

    it('모든 status variant에서 trigger 함수를 노출한다', async () => {
        const wrapper = makeWrapper();

        const { result } = renderHook(
            () => useCongressTrend('AAPL', 'gemini-2.5-flash-lite'),
            { wrapper }
        );

        // loading 상태 — trigger is a function
        expect(typeof result.current.trigger).toBe('function');

        await waitFor(() => {
            expect(result.current.status).toBe('done');
        });

        // done 상태 — trigger is still a function
        expect(typeof result.current.trigger).toBe('function');
    });

    it('submitted → poll → done 흐름', async () => {
        mockSubmit.mockResolvedValue({
            status: 'submitted',
            jobId: 'job-congress-123',
        });
        mockPoll.mockResolvedValueOnce({
            status: 'done',
            result: CONGRESS_RESULT,
        });

        const wrapper = makeWrapper();
        const { result } = renderHook(
            () => useCongressTrend('AAPL', 'gemini-2.5-flash-lite'),
            { wrapper }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('done');
        });
        expect(mockPoll).toHaveBeenCalledWith('job-congress-123');
    });

    it('miss_no_trigger → bot_blocked 상태', async () => {
        mockSubmit.mockResolvedValue({ status: 'miss_no_trigger' });

        const wrapper = makeWrapper();
        const { result } = renderHook(
            () => useCongressTrend('AAPL', 'gemini-2.5-flash-lite'),
            { wrapper }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('bot_blocked');
        });
    });

    it('no_trades → no_trades 상태 (congress 고유)', async () => {
        mockSubmit.mockResolvedValue({ status: 'no_trades' });

        const wrapper = makeWrapper();
        const { result } = renderHook(
            () => useCongressTrend('AAPL', 'gemini-2.5-flash-lite'),
            { wrapper }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('no_trades');
        });
        // LLM 잡을 enqueue하지 않으므로 poll/cancel은 호출되지 않는다.
        expect(mockPoll).not.toHaveBeenCalled();
        expect(mockCancel).not.toHaveBeenCalled();
    });

    it('error 상태를 반환하고 retry로 복구된다', async () => {
        mockSubmit
            .mockResolvedValueOnce({
                status: 'error',
                code: 'fetch_failed',
                error: '데이터 로드 실패',
            })
            .mockResolvedValueOnce({
                status: 'cached',
                result: CONGRESS_RESULT,
            });

        const wrapper = makeWrapper();
        const { result } = renderHook(
            () => useCongressTrend('AAPL', 'gemini-2.5-flash-lite'),
            { wrapper }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });

        if (result.current.status !== 'error') {
            throw new Error('expected error state');
        }
        expect(result.current.error.message).toBe('데이터 로드 실패');

        const state = result.current;
        act(() => {
            state.retry();
        });

        await waitFor(() => {
            expect(result.current.status).toBe('done');
        });
        expect(mockSubmit).toHaveBeenCalledTimes(2);
    });
});
