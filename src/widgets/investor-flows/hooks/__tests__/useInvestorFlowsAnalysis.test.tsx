import type { Mock } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import koMessages from '../../../../../messages/ko.json';
import { runAnalysisStream } from '@/shared/lib/sse/runAnalysisStream';
import { useInvestorFlowsAnalysis } from '../useInvestorFlowsAnalysis';

vi.mock('@/shared/lib/sse/runAnalysisStream', () => ({
    runAnalysisStream: vi.fn(),
}));

const mockStream = runAnalysisStream as Mock;

const RESULT = {
    summaryKo: '기관 순매수',
    axisInterpretations: [],
    keySignalsKo: [],
    risksKo: [],
    dataNotesKo: [],
};

const clients: QueryClient[] = [];
function wrapper() {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    clients.push(client);
    return function Wrapper({ children }: { children: ReactNode }) {
        return (
            <QueryClientProvider client={client}>
                {children}
            </QueryClientProvider>
        );
    };
}

describe('useInvestorFlowsAnalysis', () => {
    beforeEach(() => {
        mockStream.mockReset();
        mockStream.mockResolvedValue({ status: 'cached', result: RESULT });
    });
    afterEach(() => {
        clients.splice(0).forEach(c => c.clear());
    });

    it('cached → done, investorFlows 타입으로 스트림을 요청한다', async () => {
        const { result } = renderHook(
            () =>
                useInvestorFlowsAnalysis('AAPL', 'gemini-3.5-flash-lite', true),
            { wrapper: wrapper() }
        );
        expect(result.current.status).toBe('loading');
        await waitFor(() => expect(result.current.status).toBe('done'));
        expect(mockStream).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'investorFlows',
                params: {
                    symbol: 'AAPL',
                    modelId: 'gemini-3.5-flash-lite',
                    reasoning: true,
                },
            })
        );
    });

    it('done 상태도 결과를 그대로 돌려준다', async () => {
        mockStream.mockResolvedValue({ status: 'done', result: RESULT });
        const { result } = renderHook(
            () => useInvestorFlowsAnalysis('AAPL', 'gemini-3.5-flash-lite'),
            { wrapper: wrapper() }
        );
        await waitFor(() => expect(result.current.status).toBe('done'));
        expect(result.current).toMatchObject({ result: RESULT });
    });

    it('no_data는 오류가 아니라 no_data 상태다', async () => {
        mockStream.mockResolvedValue({ status: 'no_data' });
        const { result } = renderHook(
            () => useInvestorFlowsAnalysis('ZZZZ', 'gemini-3.5-flash-lite'),
            { wrapper: wrapper() }
        );
        await waitFor(() => expect(result.current.status).toBe('no_data'));
    });

    it('miss_no_trigger는 awaiting_interaction이다(캐시 전용 조회가 미스)', async () => {
        mockStream.mockResolvedValue({ status: 'miss_no_trigger' });
        const { result } = renderHook(
            () =>
                useInvestorFlowsAnalysis(
                    'AAPL',
                    'gemini-3.5-flash-lite',
                    false,
                    true,
                    false
                ),
            { wrapper: wrapper() }
        );
        await waitFor(() =>
            expect(result.current.status).toBe('awaiting_interaction')
        );
        expect(mockStream).toHaveBeenCalledWith(
            expect.objectContaining({
                params: expect.objectContaining({ cacheOnly: true }),
            })
        );
    });

    it('core fetch_failed는 영어 원문 대신 카탈로그 문구로 바꾼다', async () => {
        const logs = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        mockStream.mockResolvedValue({
            status: 'error',
            code: 'fetch_failed',
            error: 'raw english',
        });
        const { result } = renderHook(
            () => useInvestorFlowsAnalysis('AAPL', 'gemini-3.5-flash-lite'),
            { wrapper: wrapper() }
        );
        await waitFor(() => expect(result.current.status).toBe('error'));
        expect(result.current).toMatchObject({
            error: expect.objectContaining({
                message: koMessages.app.api.stream.fetchFailed,
            }),
        });
        expect(logs).toHaveBeenCalledWith(
            '[investorFlowsFetchFailed]',
            'raw english'
        );
        logs.mockRestore();
    });

    it('게이트 차단 문구는 그대로 오류 메시지가 된다', async () => {
        mockStream.mockResolvedValue({
            status: 'error',
            error: { code: 'tier_premium_blocked', message: '키가 필요해요' },
        });
        const { result } = renderHook(
            () => useInvestorFlowsAnalysis('AAPL', 'gemini-3.5-flash-lite'),
            { wrapper: wrapper() }
        );
        await waitFor(() => expect(result.current.status).toBe('error'));
        expect(result.current).toMatchObject({
            error: expect.objectContaining({ message: '키가 필요해요' }),
        });
    });

    it('알 수 없는 status는 unexpected 오류다', async () => {
        mockStream.mockResolvedValue({ status: 'weird' });
        const { result } = renderHook(
            () => useInvestorFlowsAnalysis('AAPL', 'gemini-3.5-flash-lite'),
            { wrapper: wrapper() }
        );
        await waitFor(() => expect(result.current.status).toBe('error'));
    });

    it('설정이 하이드레이션되기 전에는 요청하지 않는다', () => {
        renderHook(
            () =>
                useInvestorFlowsAnalysis(
                    'AAPL',
                    'gemini-3.5-flash-lite',
                    false,
                    false
                ),
            { wrapper: wrapper() }
        );
        expect(mockStream).not.toHaveBeenCalled();
    });
});
