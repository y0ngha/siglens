import type { MockedFunction } from 'vitest';
import { useOptionsAnalysis } from '@/widgets/options/hooks/useOptionsAnalysis';
import {
    submitOptionsAnalysisAction,
    pollOptionsAnalysisAction,
    cancelOptionsAnalysisJobAction,
} from '@/entities/options-chain/actions';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { OptionsAnalysisResponse } from '@y0ngha/siglens-core';
import type { ReactNode } from 'react';

vi.mock('@/entities/options-chain/actions', () => ({
    submitOptionsAnalysisAction: vi.fn(),
    pollOptionsAnalysisAction: vi.fn(),
    cancelOptionsAnalysisJobAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

const mockSubmit = submitOptionsAnalysisAction as MockedFunction<
    typeof submitOptionsAnalysisAction
>;
const mockPoll = pollOptionsAnalysisAction as MockedFunction<
    typeof pollOptionsAnalysisAction
>;
const mockCancel = cancelOptionsAnalysisJobAction as MockedFunction<
    typeof cancelOptionsAnalysisJobAction
>;

const OPTIONS_RESULT: OptionsAnalysisResponse = {
    summary: 'Bullish options flow',
    perExpiration: [],
    signals: [],
    analyzedAt: '2025-01-15T10:00:00Z',
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

const INPUT = {
    symbol: 'AAPL',
    companyName: 'Apple',
    expirationDate: '2025-06-20' as const,
    modelId: 'gemini-2.5-flash-lite' as const,
};

describe('useOptionsAnalysis — trigger coverage', () => {
    beforeEach(() => {
        mockSubmit.mockReset();
        mockPoll.mockReset();
        mockCancel.mockReset();
        mockCancel.mockResolvedValue(undefined);
    });

    afterEach(() => {
        queryClients.splice(0).forEach(client => {
            client.clear();
        });
    });

    it('loading 상태에서 trigger 함수를 노출한다', async () => {
        mockSubmit.mockReturnValue(new Promise(() => undefined));

        const wrapper = makeWrapper();
        const { result } = renderHook(() => useOptionsAnalysis(INPUT), {
            wrapper,
        });

        expect(result.current.status).toBe('loading');
        expect(typeof result.current.trigger).toBe('function');
    });

    it('done 상태에서 trigger 함수를 노출한다', async () => {
        mockSubmit.mockResolvedValue({
            status: 'cached',
            result: OPTIONS_RESULT,
        });

        const wrapper = makeWrapper();
        const { result } = renderHook(() => useOptionsAnalysis(INPUT), {
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.status).toBe('done');
        });
        expect(typeof result.current.trigger).toBe('function');
    });

    it('bot_blocked 상태에서 trigger 함수를 노출한다', async () => {
        mockSubmit.mockResolvedValue({ status: 'miss_no_trigger' });

        const wrapper = makeWrapper();
        const { result } = renderHook(() => useOptionsAnalysis(INPUT), {
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.status).toBe('bot_blocked');
        });
        expect(typeof result.current.trigger).toBe('function');
    });

    it('error 상태에서 trigger 함수를 노출한다', async () => {
        mockSubmit.mockResolvedValue({
            status: 'no_chains_error',
            code: 'no_options_chains',
            error: '옵션 데이터가 없습니다.',
        });

        const wrapper = makeWrapper();
        const { result } = renderHook(() => useOptionsAnalysis(INPUT), {
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });
        expect(typeof result.current.trigger).toBe('function');
    });
});
