import type { Mock } from 'vitest';
import { useOptionsAnalysis } from '@/widgets/options/hooks/useOptionsAnalysis';
import { runAnalysisStream } from '@/shared/hooks/useAnalysisStream';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { OptionsAnalysisResponse } from '@y0ngha/siglens-core';
import type { ReactNode } from 'react';

vi.mock('@/shared/hooks/useAnalysisStream', () => ({
    runAnalysisStream: vi.fn(),
}));

vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

const mockSubmit = runAnalysisStream as Mock;

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
    });

    afterEach(() => {
        queryClients.splice(0).forEach(client => {
            client.clear();
        });
    });

    /**
     * `cacheOnly`는 OI가 stale할 때 "캐시에 있으면 읽고 없으면 만들지 않는다"를
     * 보장하는 유일한 장치다. 훅이 이 값을 스트림 params에 싣지 않으면 서버는
     * 평소대로 열화된 입력으로 새 분석을 만들어버린다.
     */
    it('cacheOnly를 runAnalysisStream params로 전달한다', async () => {
        mockSubmit.mockResolvedValue({
            status: 'cached',
            result: OPTIONS_RESULT,
        });

        const wrapper = makeWrapper();
        renderHook(() => useOptionsAnalysis({ ...INPUT, cacheOnly: true }), {
            wrapper,
        });

        await waitFor(() => {
            expect(mockSubmit).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'options',
                    params: expect.objectContaining({ cacheOnly: true }),
                })
            );
        });
    });

    it('cacheOnly를 넘기지 않으면 params에 undefined로 실린다', async () => {
        mockSubmit.mockResolvedValue({
            status: 'cached',
            result: OPTIONS_RESULT,
        });

        const wrapper = makeWrapper();
        renderHook(() => useOptionsAnalysis(INPUT), { wrapper });

        await waitFor(() => {
            expect(mockSubmit).toHaveBeenCalledWith(
                expect.objectContaining({
                    params: expect.objectContaining({ cacheOnly: false }),
                })
            );
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
        // type 문자열이 잘못되면 SSE 라우트가 400을 반환한다 — 프로덕션 버그를 테스트에서 잡는다.
        expect(mockSubmit).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'options' })
        );
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
