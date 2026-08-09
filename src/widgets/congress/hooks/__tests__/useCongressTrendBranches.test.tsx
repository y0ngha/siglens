/**
 * Branch coverage tests for useCongressTrend — targets previously-uncovered
 * branches: non-Error query error wrapping, hydration gate, BYOK gate, and
 * the skip-refetch path.
 *
 * Poll/cancel machinery has been removed; run* functions return results directly.
 */

import type { Mock, MockedFunction } from 'vitest';
import { useCongressTrend } from '@/widgets/congress/hooks/useCongressTrend';
import { runAnalysisStream } from '@/shared/hooks/useAnalysisStream';
import { isGateBlockedResult } from '@/entities/analysis';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { CongressTrendResponse } from '@y0ngha/siglens-core';
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
const mockIsGateBlocked = isGateBlockedResult as unknown as MockedFunction<
    typeof isGateBlockedResult
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

describe('useCongressTrend — branch coverage', () => {
    beforeEach(() => {
        mockSubmit.mockReset();
        mockIsGateBlocked.mockReturnValue(false);
    });

    afterEach(() => {
        queryClients.splice(0).forEach(client => client.clear());
    });

    describe('BYOK 게이트 차단', () => {
        it('게이트 차단 결과는 error.message를 그대로 사용한 Error로 throw된다', async () => {
            mockIsGateBlocked.mockReturnValue(true);
            mockSubmit.mockResolvedValue({
                status: 'error',
                error: {
                    code: 'tier_premium_blocked',
                    message:
                        '선택한 모델은 프리미엄 등급에서만 사용 가능합니다.',
                },
            } as never);

            const wrapper = makeWrapper();
            const { result } = renderHook(
                () => useCongressTrend('AAPL', 'claude-opus-4-7'),
                { wrapper }
            );

            await waitFor(() => {
                expect(result.current.status).toBe('error');
            });

            if (result.current.status !== 'error') {
                throw new Error('expected error state');
            }
            expect(result.current.error.message).toBe(
                '선택한 모델은 프리미엄 등급에서만 사용 가능합니다.'
            );
        });
    });

    describe('에러 처리', () => {
        it('non-Error query error는 Error로 래핑된다', async () => {
            mockSubmit.mockRejectedValue('string_error');

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
            expect(result.current.error).toBeInstanceOf(Error);
            expect(result.current.error.message).toContain(
                '오류가 발생했습니다'
            );
        });
    });

    describe('hydration gate', () => {
        it('설정(모델/reasoning) 확정 게이트가 닫혀 있으면 fetch를 실행하지 않는다', async () => {
            const wrapper = makeWrapper();
            const { result } = renderHook(
                () =>
                    useCongressTrend(
                        'AAPL',
                        'gemini-2.5-flash-lite',
                        false,
                        false
                    ),
                { wrapper }
            );

            await new Promise(resolve => setTimeout(resolve, 0));

            expect(mockSubmit).not.toHaveBeenCalled();
            expect(result.current.status).toBe('loading');
        });

        it('쿼리 데이터가 이미 존재하면 refetch를 건너뛴다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'cached',
                result: CONGRESS_RESULT,
            });

            const wrapper = makeWrapper();
            const { result, rerender } = renderHook(
                () => useCongressTrend('AAPL', 'gemini-2.5-flash-lite'),
                { wrapper }
            );

            await waitFor(() => {
                expect(result.current.status).toBe('done');
            });

            rerender();

            expect(mockSubmit).toHaveBeenCalledTimes(1);
        });
    });
});
