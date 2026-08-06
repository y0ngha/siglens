import type { Mock } from 'vitest';
import { useOverallAnalysis } from '@/widgets/overall/hooks/useOverallAnalysis';
import { runAnalysisStream } from '@/shared/hooks/useAnalysisStream';
import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { OverallAnalysisResponse } from '@y0ngha/siglens-core';
import { createQueryClientWrapper } from '@/__tests__/utils/createQueryClientWrapper';

vi.mock('@/shared/hooks/useAnalysisStream', () => ({
    runAnalysisStream: vi.fn(),
}));
vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

const mockSubmit = runAnalysisStream as Mock;

const OVERALL_RESULT: OverallAnalysisResponse = {
    headlineKo: 'AAPL 종합 분석',
    technicalBulletsKo: [],
    fundamentalBulletsKo: [],
    newsBulletsKo: [],
    optionsBulletsKo: [],
    financialsBulletsKo: [],
    integratedConclusionKo: '중립',
    scenarios: [],
    riskFactorsKo: [],
};

const queryClients: QueryClient[] = [];

function makeWrapper() {
    const { wrapper, client } = createQueryClientWrapper();
    queryClients.push(client);
    return wrapper;
}

function hookArgs() {
    return ['AAPL', 'Apple Inc.', '1Day', 'gemini-2.5-flash-lite'] as const;
}

describe('useOverallAnalysis', () => {
    beforeEach(() => {
        mockSubmit.mockReset();
    });

    afterEach(() => {
        queryClients.splice(0).forEach(client => client.clear());
    });

    describe('idle', () => {
        it('trigger 전에는 idle 상태이고 Server Action을 호출하지 않는다', () => {
            const { result } = renderHook(
                () => useOverallAnalysis(...hookArgs()),
                { wrapper: makeWrapper() }
            );
            expect(result.current.state.status).toBe('idle');
            expect(mockSubmit).not.toHaveBeenCalled();
        });
    });

    describe('SSR seed (initialResult)', () => {
        it('initialResult가 주어지면 마운트 즉시 done 상태이고 그 결과를 노출한다', () => {
            const { result } = renderHook(
                () => useOverallAnalysis(...hookArgs(), OVERALL_RESULT),
                { wrapper: makeWrapper() }
            );

            expect(result.current.state.status).toBe('done');
            const state = result.current.state;
            if (state.status !== 'done') throw new Error('expected done');
            expect(state.result).toEqual(OVERALL_RESULT);
            expect(mockSubmit).not.toHaveBeenCalled();
        });

        it('initialResult가 없으면 idle 상태를 유지한다', () => {
            const { result } = renderHook(
                () => useOverallAnalysis(...hookArgs()),
                { wrapper: makeWrapper() }
            );

            expect(result.current.state.status).toBe('idle');
        });
    });

    describe('cached', () => {
        it('submit이 cached를 반환하면 즉시 done 상태가 된다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'cached',
                result: OVERALL_RESULT,
            });

            const { result } = renderHook(
                () => useOverallAnalysis(...hookArgs()),
                { wrapper: makeWrapper() }
            );

            act(() => {
                result.current.trigger();
            });

            await waitFor(() => {
                expect(result.current.state.status).toBe('done');
            });

            const state = result.current.state;
            if (state.status !== 'done') throw new Error('expected done');
            expect(state.result).toEqual(OVERALL_RESULT);
            expect(mockSubmit).toHaveBeenCalledTimes(1);
        });
    });

    describe('trigger (재분석)', () => {
        it('done 상태에서 trigger를 다시 호출하면 재요청하되 force는 보내지 않는다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'cached',
                result: OVERALL_RESULT,
            });

            const { result } = renderHook(
                () => useOverallAnalysis(...hookArgs()),
                { wrapper: makeWrapper() }
            );

            act(() => {
                result.current.trigger();
            });
            await waitFor(() =>
                expect(result.current.state.status).toBe('done')
            );

            act(() => {
                result.current.trigger();
            });

            await waitFor(() => {
                const lastCall =
                    mockSubmit.mock.calls[mockSubmit.mock.calls.length - 1];
                expect(lastCall?.[0]).toEqual(
                    expect.objectContaining({
                        type: 'overall',
                        params: expect.objectContaining({ reasoning: false }),
                    })
                );
                // 캐시 우회 여부는 서버가 재분석 쿨다운에서 판단한다.
                expect(lastCall?.[0]?.params).not.toHaveProperty('force');
            });
        });

        it('첫 trigger에도 force를 보내지 않는다 (서버가 쿨다운에서 파생)', async () => {
            mockSubmit.mockResolvedValue({
                status: 'cached',
                result: OVERALL_RESULT,
            });

            const { result } = renderHook(
                () => useOverallAnalysis(...hookArgs()),
                { wrapper: makeWrapper() }
            );

            act(() => {
                result.current.trigger();
            });
            await waitFor(() =>
                expect(result.current.state.status).toBe('done')
            );

            const firstCall = mockSubmit.mock.calls[0];
            expect(firstCall?.[0]).toEqual(
                expect.objectContaining({
                    type: 'overall',
                    params: expect.objectContaining({
                        reasoning: false,
                    }),
                })
            );
        });
    });

    describe('error handling', () => {
        it('submit이 error를 반환하면 error 상태가 된다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'error',
                axis: 'technical' as const,
                error: 'submit 실패',
            });

            const { result } = renderHook(
                () => useOverallAnalysis(...hookArgs()),
                { wrapper: makeWrapper() }
            );

            act(() => {
                result.current.trigger();
            });

            await waitFor(() => {
                expect(result.current.state.status).toBe('error');
            });

            const state = result.current.state;
            if (state.status !== 'error') throw new Error('expected error');
            expect(state.error).toBe('submit 실패');
            expect(state.axis).toBe('technical');
        });

        it('limit_error를 반환하면 한도 초과 메시지로 error 상태가 된다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'limit_error',
                code: 'usage_limit_exceeded',
                error: {} as never,
            });

            const { result } = renderHook(
                () => useOverallAnalysis(...hookArgs()),
                { wrapper: makeWrapper() }
            );

            act(() => {
                result.current.trigger();
            });

            await waitFor(() => {
                expect(result.current.state.status).toBe('error');
            });

            const state = result.current.state;
            if (state.status !== 'error') throw new Error('expected error');
            expect(state.error).toContain('한도');
        });
    });

    describe('retry', () => {
        it('error 후 trigger를 재호출하면 분석을 재시도한다', async () => {
            mockSubmit
                .mockResolvedValueOnce({
                    status: 'error',
                    axis: 'technical' as const,
                    error: '분석 실패',
                })
                .mockResolvedValueOnce({
                    status: 'cached',
                    result: OVERALL_RESULT,
                });

            const { result } = renderHook(
                () => useOverallAnalysis(...hookArgs()),
                { wrapper: makeWrapper() }
            );

            act(() => {
                result.current.trigger();
            });
            await waitFor(() =>
                expect(result.current.state.status).toBe('error')
            );

            act(() => {
                result.current.trigger();
            });
            await waitFor(() =>
                expect(result.current.state.status).toBe('done')
            );

            expect(mockSubmit).toHaveBeenCalledTimes(2);
        });
    });
});
