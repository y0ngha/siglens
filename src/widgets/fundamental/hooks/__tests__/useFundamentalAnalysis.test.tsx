import type { Mock } from 'vitest';
import { useFundamentalAnalysis } from '@/widgets/fundamental/hooks/useFundamentalAnalysis';
import { runAnalysisStream } from '@/shared/hooks/useAnalysisStream';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { FundamentalAnalysisResponse } from '@y0ngha/siglens-core';
import type { ReactNode } from 'react';

vi.mock('@/shared/hooks/useAnalysisStream', () => ({
    runAnalysisStream: vi.fn(),
}));

vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

const mockSubmit = runAnalysisStream as Mock;

const FUNDAMENTAL_RESULT: FundamentalAnalysisResponse = {
    overallSentiment: 'bullish',
    overallConclusionKo: '강세 전망입니다',
    categoryAssessments: [],
    riskFactorsKo: [],
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

describe('useFundamentalAnalysis — trigger coverage', () => {
    beforeEach(() => {
        mockSubmit.mockReset();
    });

    afterEach(() => {
        queryClients.splice(0).forEach(client => {
            client.clear();
        });
    });

    it('loading 상태에서 trigger 함수를 노출한다', async () => {
        mockSubmit.mockReturnValue(new Promise(() => undefined));

        const wrapper = makeWrapper();
        const { result } = renderHook(
            () => useFundamentalAnalysis('AAPL', 'gemini-3.5-flash-lite'),
            { wrapper }
        );

        expect(result.current.status).toBe('loading');
        expect(typeof result.current.trigger).toBe('function');
    });

    it('done 상태에서 trigger 함수를 노출한다', async () => {
        mockSubmit.mockResolvedValue({
            status: 'cached',
            result: FUNDAMENTAL_RESULT,
        });

        const wrapper = makeWrapper();
        const { result } = renderHook(
            () => useFundamentalAnalysis('AAPL', 'gemini-3.5-flash-lite'),
            { wrapper }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('done');
        });
        expect(typeof result.current.trigger).toBe('function');
    });

    it('bot_blocked 상태에서 trigger 함수를 노출한다', async () => {
        mockSubmit.mockResolvedValue({ status: 'miss_no_trigger' });

        const wrapper = makeWrapper();
        const { result } = renderHook(
            () => useFundamentalAnalysis('AAPL', 'gemini-3.5-flash-lite'),
            { wrapper }
        );

        await waitFor(() => {
            expect(result.current.status).toBe('bot_blocked');
        });
        expect(typeof result.current.trigger).toBe('function');
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
