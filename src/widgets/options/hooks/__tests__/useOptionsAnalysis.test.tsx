import type { Mock } from 'vitest';
import { useOptionsAnalysis } from '@/widgets/options/hooks/useOptionsAnalysis';
import { runAnalysisStream } from '@/shared/lib/sse/runAnalysisStream';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { OptionsAnalysisResponse } from '@y0ngha/siglens-core';
import type { ReactNode } from 'react';

vi.mock('@/shared/lib/sse/runAnalysisStream', () => ({
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
    modelId: 'gemini-3.5-flash-lite' as const,
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

    /**
     * `cacheOnly`가 OI-stale 경로의 유일한 남은 `miss_no_trigger` producer다
     * (2026-09-27 bot parity fix 이후 다른 다섯 축은 skipEnqueueIfMiss를
     * 하드코딩된 false로 보낸다). 캐시 미스면 새로 분석을 만들지 않고
     * "분석 없음" 상태로 떨어져야 한다 — 결과 데이터도, 안내문도 없어야 한다
     * (컴포넌트 레벨 "안내문 없음" 검증은 OptionsAiAnalysis.test.tsx 참고).
     */
    it('cacheOnly 캐시 미스(miss_no_trigger) → cache_miss 상태, 결과 데이터 없음', async () => {
        mockSubmit.mockResolvedValue({ status: 'miss_no_trigger' });

        const wrapper = makeWrapper();
        const { result } = renderHook(
            () => useOptionsAnalysis({ ...INPUT, cacheOnly: true }),
            { wrapper }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('cache_miss');
        });
        expect(result.current).not.toHaveProperty('result');
        expect(result.current).not.toHaveProperty('plain');
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

    it('cache_miss 상태에서 trigger 함수를 노출한다', async () => {
        mockSubmit.mockResolvedValue({ status: 'miss_no_trigger' });

        const wrapper = makeWrapper();
        const { result } = renderHook(
            () => useOptionsAnalysis({ ...INPUT, cacheOnly: true }),
            { wrapper }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('cache_miss');
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

describe('useOptionsAnalysis — AI 자동 실행 게이트', () => {
    beforeEach(() => {
        mockSubmit.mockReset();
    });

    it('게이트가 닫혀 있으면 캐시 전용으로 묻고, 미스면 cache_miss가 아니라 awaiting_interaction이다', async () => {
        mockSubmit.mockResolvedValue({ status: 'miss_no_trigger' });
        const { result } = renderHook(
            () => useOptionsAnalysis({ ...INPUT, autoRunAllowed: false }),
            { wrapper: makeWrapper() }
        );
        await waitFor(() =>
            expect(result.current.status).toBe('awaiting_interaction')
        );
        expect(mockSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                params: expect.objectContaining({ cacheOnly: true }),
            })
        );
    });

    it('OI stale(cacheOnly)이면 게이트와 무관하게 cache_miss다 — 입력해도 생성하지 않는다', async () => {
        mockSubmit.mockResolvedValue({ status: 'miss_no_trigger' });
        const { result } = renderHook(
            () =>
                useOptionsAnalysis({
                    ...INPUT,
                    cacheOnly: true,
                    autoRunAllowed: false,
                }),
            { wrapper: makeWrapper() }
        );
        await waitFor(() => expect(result.current.status).toBe('cache_miss'));
    });
});
