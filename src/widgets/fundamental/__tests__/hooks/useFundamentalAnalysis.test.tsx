import type { Mock } from 'vitest';
import { IntlTestProvider } from '@/shared/test-utils/intlRenderWrapper';
import { useFundamentalAnalysis } from '@/widgets/fundamental/hooks/useFundamentalAnalysis';
import { runAnalysisStream } from '@/shared/lib/sse/runAnalysisStream';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { FundamentalAnalysisResponse } from '@y0ngha/siglens-core';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';

vi.mock('@/shared/lib/sse/runAnalysisStream', () => ({
    runAnalysisStream: vi.fn(),
}));

vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

const mockSubmit = runAnalysisStream as Mock;

const FUNDAMENTAL_RESULT: FundamentalAnalysisResponse = {
    overallSentiment: 'bullish',
    overallConclusionKo: 'AAPL 펀더멘털이 양호합니다.',
    categoryAssessments: [],
    riskFactorsKo: [],
};

const queryClients: QueryClient[] = [];

function makeWrapper() {
    const client = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    });
    queryClients.push(client);

    return function Wrapper({ children }: { children: ReactNode }) {
        return (
            <QueryClientProvider client={client}>
                {/* renderToString은 RTL을 우회하므로 전역 intl 래핑이 걸리지 않는다.
                    훅이 useTranslations를 쓰는 이상 여기서 직접 감싸야 한다. */}
                <IntlTestProvider>{children}</IntlTestProvider>
            </QueryClientProvider>
        );
    };
}

function Probe() {
    useFundamentalAnalysis('AAPL', 'gemini-3.5-flash-lite');
    return null;
}

describe('useFundamentalAnalysis', () => {
    beforeEach(() => {
        mockSubmit.mockReset();
        mockSubmit.mockResolvedValue({
            status: 'cached',
            result: FUNDAMENTAL_RESULT,
        });
    });

    afterEach(() => {
        queryClients.splice(0).forEach(client => {
            client.clear();
        });
    });

    it('서버 렌더 중 Server Action을 호출하지 않는다', () => {
        const Wrapper = makeWrapper();

        renderToString(
            <Wrapper>
                <Probe />
            </Wrapper>
        );

        expect(mockSubmit).not.toHaveBeenCalled();
    });

    it('클라이언트 마운트 후 Server Action을 호출한다', async () => {
        const wrapper = makeWrapper();

        const { result } = renderHook(
            () => useFundamentalAnalysis('AAPL', 'gemini-3.5-flash-lite'),
            { wrapper }
        );

        expect(result.current.status).toBe('loading');

        await waitFor(() => {
            expect(result.current.status).toBe('done');
        });
        expect(mockSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'fundamental',
                params: expect.objectContaining({
                    symbol: 'AAPL',
                    modelId: 'gemini-3.5-flash-lite',
                    reasoning: false,
                }),
            })
        );
    });

    it('모든 status variant에서 trigger 함수를 노출한다', async () => {
        const wrapper = makeWrapper();

        const { result } = renderHook(
            () => useFundamentalAnalysis('AAPL', 'gemini-3.5-flash-lite'),
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

    it('분석 실패 후 retry가 Server Action을 다시 호출한다', async () => {
        mockSubmit
            .mockRejectedValueOnce(new Error('temporary failure'))
            .mockResolvedValueOnce({
                status: 'cached',
                result: FUNDAMENTAL_RESULT,
            });
        const wrapper = makeWrapper();

        const { result } = renderHook(
            () => useFundamentalAnalysis('AAPL', 'gemini-3.5-flash-lite'),
            { wrapper }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });

        const state = result.current;
        if (state.status !== 'error') {
            throw new Error('expected error state');
        }

        act(() => {
            state.retry();
        });

        await waitFor(() => {
            expect(result.current.status).toBe('done');
        });
        expect(mockSubmit).toHaveBeenCalledTimes(2);
    });

    /**
     * 액션이 provider 장애를 `ai_server_unstable` 게이트 에러로 돌려주면 그
     * (서버에서 현지화된) 문구가 그대로 에러 배너로 가야 한다. 코드가
     * `GATE_ERROR_CODES`에 없으면 훅이 사용량 초과 문구로 잘못 바꾼다.
     */
    it('ai_server_unstable 게이트 에러는 서버 문구를 그대로 에러로 노출한다', async () => {
        const guidance =
            'AI 서버가 불안정해 분석하지 못했습니다. 우측 상단 톱니바퀴에서 모델을 변경해 주세요.';
        mockSubmit.mockResolvedValue({
            status: 'error',
            error: { code: 'ai_server_unstable', message: guidance },
        });

        const wrapper = makeWrapper();
        const { result } = renderHook(
            () => useFundamentalAnalysis('AAPL', 'gemini-3.5-flash-lite'),
            { wrapper }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });
        expect(
            result.current.status === 'error' && result.current.error.message
        ).toBe(guidance);
    });

    it('error 상태에서 trigger 함수를 노출한다', async () => {
        mockSubmit.mockResolvedValue({
            status: 'error',
            code: 'fetch_failed',
            error: '데이터 로드 실패',
        });

        const wrapper = makeWrapper();
        const { result } = renderHook(
            () => useFundamentalAnalysis('AAPL', 'gemini-3.5-flash-lite'),
            { wrapper }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });
        expect(typeof result.current.trigger).toBe('function');
    });
});
