import koMessages from '../../../../../messages/ko.json';
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
                // 다만 "사용자가 누른 재분석"이라는 의도는 보내야 한다 — 안 보내면
                // 서버가 쿨다운을 잡지 않아 종합 탭 재분석이 영원히 캐시만 돌려준다.
                expect(lastCall?.[0]?.params).toMatchObject({
                    reanalyze: true,
                });
            });
        });

        it('첫 trigger에는 reanalyze 의도를 보내지 않는다 — 최초 분석은 재분석이 아니다', async () => {
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

            expect(mockSubmit.mock.calls[0]?.[0]?.params).not.toHaveProperty(
                'reanalyze'
            );
        });

        it('쿨다운으로 거절돼도 직전 분석을 계속 보여 준다', async () => {
            /**
             * 이 테스트는 useOverallAnalysis의 OverallCooldownError 가드를 검증한다:
             *
             *   if (err instanceof OverallCooldownError && query.data !== undefined)
             *       return { status: 'done', result: query.data };
             *
             * 가드를 삭제하면 query.isError=true + data 보존 상태에서 일반 error 경로로
             * 빠져 state.status === 'error'가 되어 이 테스트가 실패한다.
             *
             * 이전 버전의 이 테스트는 `waitFor(() => mockSubmit.toHaveBeenCalledTimes(2))`
             * 로 두 번째 호출만 대기했다 — mockSubmit이 두 번 호출됐다고 해서 React Query가
             * 에러를 처리하고 state를 재계산했다는 보장이 없어, 가드를 삭제해도 테스트가
             * 여전히 통과하는 구조였다.
             *
             * 수정: `act(async () => {})` 로 마이크로태스크/promises를 명시적으로 플러시해
             * React Query가 에러를 완전히 처리하고 state 재계산까지 마친 뒤 단언한다.
             */
            mockSubmit
                .mockResolvedValueOnce({
                    status: 'cached',
                    result: OVERALL_RESULT,
                })
                .mockResolvedValueOnce({
                    status: 'reanalyze_cooldown',
                    remainingMs: 120_000,
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

            // mockSubmit이 두 번 호출될 때까지 대기한다.
            await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(2));

            // React Query가 OverallCooldownError를 처리해 state를 재계산하도록
            // 남은 마이크로태스크/프로미스를 모두 플러시한다. 이 없으면 단언이
            // 에러 settle 이전에 통과해 가드 삭제를 감지하지 못한다.
            await act(async () => {});

            // 가드가 있으면: query.isError=true + query.data=OVERALL_RESULT → done 유지
            // 가드가 없으면: query.isError=true → error 경로 → state.status === 'error' → 실패 ✓
            expect(result.current.state).toEqual({
                status: 'done',
                result: OVERALL_RESULT,
            });
        });

        it('직전 결과가 없는 상태의 쿨다운 거절은 남은 시간을 담은 에러로 알린다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'reanalyze_cooldown',
                remainingMs: 120_000,
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
            expect(
                result.current.state.status === 'error' &&
                    result.current.state.error
            ).toContain('120');
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
                // core가 실제로 주는 값은 영어 예외 문자열이다.
                error: 'Profile not found for symbol: AAPL',
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
            // 원문이 그대로 새면 전 로케일에 영어가 나간다 — 카탈로그를 거쳐야 한다.
            expect(state.error).toBe(koMessages.app.api.stream.analysisFailed);
            expect(state.error).not.toContain('Profile not found');
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
            expect(state.error).toBe(koMessages.app.api.stream.limitExceeded);
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
