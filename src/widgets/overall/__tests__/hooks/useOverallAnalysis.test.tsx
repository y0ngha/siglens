import koMessages from '../../../../../messages/ko.json';
import type { Mock } from 'vitest';
import { useOverallAnalysis } from '@/widgets/overall/hooks/useOverallAnalysis';
import { runAnalysisStream } from '@/shared/lib/sse/runAnalysisStream';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { OverallAnalysisResponse } from '@y0ngha/siglens-core';
import { createQueryClientWrapper } from '@/__tests__/utils/createQueryClientWrapper';

vi.mock('@/shared/lib/sse/runAnalysisStream', () => ({
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

const SEED_RESULT: OverallAnalysisResponse = {
    ...OVERALL_RESULT,
    headlineKo: 'SSR seed 종합 분석',
};

const MEMBER_MODEL = 'claude-sonnet-5-5';

/** `reasoning: false`까지 포함한 일반(생성 허용) 요청의 파라미터. */
const PLAIN_PARAMS = {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    timeframe: '1Day',
    modelId: 'gemini-3.5-flash-lite',
    reasoning: false,
};

/**
 * 요청 하나의 모양. `toHaveBeenCalledWith`는 정의되지 않은 속성을 무시하지만 값이
 * 있는 속성은 그대로 비교하므로, 기대에 없는 `reanalyze`/`cacheOnly`가 실려 나가면
 * 실패한다.
 */
function request(extraParams: Record<string, unknown> = {}) {
    return expect.objectContaining({
        type: 'overall',
        params: { ...PLAIN_PARAMS, ...extraParams },
    });
}

const queryClients: QueryClient[] = [];

function makeClientWrapper() {
    const { wrapper, client } = createQueryClientWrapper();
    queryClients.push(client);
    return { wrapper, client };
}

function makeWrapper() {
    return makeClientWrapper().wrapper;
}

function hookArgs() {
    return ['AAPL', 'Apple Inc.', '1Day', 'gemini-3.5-flash-lite'] as const;
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
                () => useOverallAnalysis(...hookArgs(), SEED_RESULT),
                { wrapper: makeWrapper() }
            );

            expect(result.current.state).toEqual({
                status: 'done',
                result: SEED_RESULT,
                plain: null,
                reanalyzing: false,
                notice: null,
            });
            expect(mockSubmit).not.toHaveBeenCalled();
        });

        it('seed가 있어도 마운트 key에서는 어떤 요청도 보내지 않는다 (캐시 읽기 포함)', async () => {
            renderHook(() => useOverallAnalysis(...hookArgs(), SEED_RESULT), {
                wrapper: makeWrapper(),
            });

            await act(async () => {});

            expect(mockSubmit).not.toHaveBeenCalled();
        });
    });

    describe('SSR seed + key 변경 (하이드레이션 뒤 저장 모델 확정)', () => {
        function renderSeeded() {
            return renderHook(
                ({ modelId }: { modelId: string }) =>
                    useOverallAnalysis(
                        'AAPL',
                        'Apple Inc.',
                        '1Day',
                        modelId as never,
                        SEED_RESULT,
                        false,
                        true
                    ),
                {
                    wrapper: makeWrapper(),
                    initialProps: { modelId: PLAIN_PARAMS.modelId },
                }
            );
        }

        it('새 key는 캐시만 읽는다 — 클릭 없이 생성 요청을 보내지 않는다', async () => {
            mockSubmit.mockResolvedValue({ status: 'miss_no_trigger' });
            const { rerender } = renderSeeded();

            rerender({ modelId: MEMBER_MODEL });

            await waitFor(() =>
                expect(mockSubmit).toHaveBeenCalledWith(
                    request({ modelId: MEMBER_MODEL, cacheOnly: true })
                )
            );
            expect(mockSubmit).not.toHaveBeenCalledWith(
                request({ modelId: MEMBER_MODEL })
            );
        });

        it('새 key의 캐시가 미스면 idle로 돌아가 클릭을 기다린다', async () => {
            mockSubmit.mockResolvedValue({ status: 'miss_no_trigger' });
            const { result, rerender } = renderSeeded();

            rerender({ modelId: MEMBER_MODEL });

            await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
            await waitFor(() =>
                expect(result.current.state.status).toBe('idle')
            );
        });

        it('새 key의 캐시가 적중하면 클릭 없이 그 결과를 보여 준다', async () => {
            mockSubmit.mockResolvedValue({
                status: 'cached',
                result: OVERALL_RESULT,
            });
            const { result, rerender } = renderSeeded();

            rerender({ modelId: MEMBER_MODEL });

            await waitFor(() =>
                expect(result.current.state).toEqual({
                    status: 'done',
                    result: OVERALL_RESULT,
                    plain: null,
                    reanalyzing: false,
                    notice: null,
                })
            );
        });

        it('캐시 미스 뒤 trigger를 누르면 그때 생성 요청(캐시 우회 없음)을 보낸다', async () => {
            mockSubmit.mockResolvedValueOnce({ status: 'miss_no_trigger' });
            mockSubmit.mockResolvedValueOnce({
                status: 'done',
                result: OVERALL_RESULT,
            });
            const { result, rerender } = renderSeeded();
            rerender({ modelId: MEMBER_MODEL });
            await waitFor(() =>
                expect(result.current.state.status).toBe('idle')
            );

            act(() => {
                result.current.trigger();
            });

            await waitFor(() =>
                expect(mockSubmit).toHaveBeenCalledWith(
                    request({ modelId: MEMBER_MODEL })
                )
            );
            await waitFor(() =>
                expect(result.current.state.status).toBe('done')
            );
        });
    });

    describe('React Query 캐시에 이미 있는 key', () => {
        it('클릭 없이 그 결과를 done으로 보여 주고 요청을 보내지 않는다', () => {
            const { wrapper, client } = makeClientWrapper();
            client.setQueryData(
                QUERY_KEYS.overallAnalysis(
                    'AAPL',
                    'Apple Inc.',
                    '1Day',
                    'gemini-3.5-flash-lite',
                    false,
                    'ko'
                ),
                { data: OVERALL_RESULT, plain: '쉬운 설명' }
            );

            const { result } = renderHook(
                () => useOverallAnalysis(...hookArgs()),
                { wrapper }
            );

            expect(result.current.state).toEqual({
                status: 'done',
                result: OVERALL_RESULT,
                plain: '쉬운 설명',
                reanalyzing: false,
                notice: null,
            });
            expect(mockSubmit).not.toHaveBeenCalled();
        });

        it('마운트 뒤 바뀐 key의 캐시 결과도 클릭 없이 보여 준다', () => {
            const { wrapper, client } = makeClientWrapper();
            client.setQueryData(
                QUERY_KEYS.overallAnalysis(
                    'AAPL',
                    'Apple Inc.',
                    '1Day',
                    MEMBER_MODEL,
                    false,
                    'ko'
                ),
                { data: OVERALL_RESULT, plain: null }
            );

            const { result, rerender } = renderHook(
                ({ modelId }: { modelId: string }) =>
                    useOverallAnalysis(
                        'AAPL',
                        'Apple Inc.',
                        '1Day',
                        modelId as never
                    ),
                { wrapper, initialProps: { modelId: PLAIN_PARAMS.modelId } }
            );
            expect(result.current.state.status).toBe('idle');

            rerender({ modelId: MEMBER_MODEL });

            expect(result.current.state.status).toBe('done');
            expect(mockSubmit).not.toHaveBeenCalled();
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

    describe('trigger (첫 분석)', () => {
        it('일반 생성 요청을 보낸다 — reanalyze·cacheOnly·force 없이', async () => {
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

            // 캐시 우회 여부는 서버가 재분석 쿨다운에서 판단한다 — `force`는 보내지 않는다.
            expect(mockSubmit).toHaveBeenCalledWith(request());
            expect(mockSubmit).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    params: expect.objectContaining({ force: true }),
                })
            );
        });

        it('이미 결과가 있으면 아무 요청도 보내지 않는다', async () => {
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
            await act(async () => {});

            expect(mockSubmit).toHaveBeenCalledTimes(1);
        });
    });

    describe('reanalyze (재분석)', () => {
        async function renderDone() {
            mockSubmit.mockResolvedValueOnce({
                status: 'cached',
                result: OVERALL_RESULT,
            });
            const hook = renderHook(() => useOverallAnalysis(...hookArgs()), {
                wrapper: makeWrapper(),
            });
            act(() => {
                hook.result.current.trigger();
            });
            await waitFor(() =>
                expect(hook.result.current.state.status).toBe('done')
            );
            return hook;
        }

        it('reanalyze 의도를 보내되 force는 보내지 않는다', async () => {
            const { result } = await renderDone();
            mockSubmit.mockResolvedValueOnce({
                status: 'done',
                result: OVERALL_RESULT,
            });

            act(() => {
                result.current.reanalyze();
            });

            // 사용자가 누른 재분석이라는 의도를 보내야 서버가 쿨다운을 잡는다 —
            // 안 보내면 종합 탭 재분석이 영원히 캐시만 돌려준다.
            await waitFor(() =>
                expect(mockSubmit).toHaveBeenCalledWith(
                    request({ reanalyze: true })
                )
            );
            expect(mockSubmit).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    params: expect.objectContaining({ force: true }),
                })
            );
        });

        it('재분석 의도는 그 요청 하나에만 쓰인다', async () => {
            const { result } = await renderDone();
            mockSubmit.mockResolvedValueOnce({
                status: 'done',
                result: OVERALL_RESULT,
            });
            act(() => {
                result.current.reanalyze();
            });
            await waitFor(() =>
                expect(mockSubmit).toHaveBeenCalledWith(
                    request({ reanalyze: true })
                )
            );
            await waitFor(() =>
                expect(result.current.state).toMatchObject({
                    reanalyzing: false,
                })
            );
            mockSubmit.mockClear();
            mockSubmit.mockResolvedValueOnce({
                status: 'done',
                result: OVERALL_RESULT,
            });

            act(() => {
                result.current.reanalyze();
            });

            await waitFor(() => expect(mockSubmit).toHaveBeenCalledTimes(1));
            expect(mockSubmit).toHaveBeenCalledWith(
                request({ reanalyze: true })
            );
        });

        it('진행 중에는 reanalyzing=true로 결과를 유지한 채 알린다', async () => {
            const { result } = await renderDone();
            let finish: (value: unknown) => void = () => {};
            mockSubmit.mockImplementationOnce(
                () =>
                    new Promise(resolve => {
                        finish = resolve;
                    })
            );

            act(() => {
                result.current.reanalyze();
            });

            await waitFor(() =>
                expect(result.current.state).toMatchObject({
                    status: 'done',
                    result: OVERALL_RESULT,
                    reanalyzing: true,
                })
            );

            await act(async () => {
                finish({ status: 'done', result: OVERALL_RESULT });
            });
            await waitFor(() =>
                expect(result.current.state).toMatchObject({
                    reanalyzing: false,
                })
            );
        });

        it('진행 중 다시 눌러도 실행 중인 분석을 취소하지 않고 새 요청도 보내지 않는다', async () => {
            const { result } = await renderDone();
            let runningSignal: AbortSignal | undefined;
            let finish: (value: unknown) => void = () => {};
            mockSubmit.mockImplementationOnce(
                ({ signal }: { signal?: AbortSignal }) =>
                    new Promise(resolve => {
                        runningSignal = signal;
                        finish = resolve;
                    })
            );
            act(() => {
                result.current.reanalyze();
            });
            await waitFor(() =>
                expect(result.current.state).toMatchObject({
                    reanalyzing: true,
                })
            );
            mockSubmit.mockClear();

            act(() => {
                result.current.reanalyze();
            });
            await act(async () => {});

            expect(mockSubmit).not.toHaveBeenCalled();
            expect(runningSignal?.aborted).toBe(false);

            await act(async () => {
                finish({ status: 'done', result: OVERALL_RESULT });
            });
            await waitFor(() =>
                expect(result.current.state).toMatchObject({
                    status: 'done',
                    reanalyzing: false,
                })
            );
        });

        it('쿨다운으로 거절돼도 직전 분석을 지키고 쿨다운 안내를 노출한다', async () => {
            const { result } = await renderDone();
            mockSubmit.mockResolvedValueOnce({
                status: 'reanalyze_cooldown',
                remainingMs: 120_000,
            });

            act(() => {
                result.current.reanalyze();
            });

            await waitFor(() =>
                expect(result.current.state).toMatchObject({
                    notice: { kind: 'cooldown' },
                })
            );
            const state = result.current.state;
            if (state.status !== 'done') throw new Error('expected done');
            // `plain`도 함께 지켜져야 한다 — 빠지면 같은 분석을 보는데 쉽게보기
            // 토글만 사라진다.
            expect(state).toMatchObject({
                result: OVERALL_RESULT,
                plain: null,
                reanalyzing: false,
            });
            expect(state.notice?.message).toContain('120');
        });

        it('다음 재분석이 시작되면 직전 안내를 거둔다', async () => {
            const { result } = await renderDone();
            mockSubmit.mockResolvedValueOnce({
                status: 'reanalyze_cooldown',
                remainingMs: 120_000,
            });
            act(() => {
                result.current.reanalyze();
            });
            await waitFor(() =>
                expect(result.current.state).toMatchObject({
                    notice: { kind: 'cooldown' },
                })
            );
            mockSubmit.mockImplementationOnce(() => new Promise(() => {}));

            act(() => {
                result.current.reanalyze();
            });

            await waitFor(() =>
                expect(result.current.state).toMatchObject({
                    reanalyzing: true,
                    notice: null,
                })
            );
        });

        it('일반 실패여도 직전 분석을 지키고 실패 안내를 노출한다', async () => {
            const { result } = await renderDone();
            mockSubmit.mockResolvedValueOnce({
                status: 'error',
                axis: 'technical' as const,
                error: 'Profile not found for symbol: AAPL',
            });

            act(() => {
                result.current.reanalyze();
            });

            await waitFor(() =>
                expect(result.current.state).toMatchObject({
                    status: 'done',
                    result: OVERALL_RESULT,
                    notice: {
                        kind: 'failed',
                        message: koMessages.app.api.stream.analysisFailed,
                    },
                })
            );
        });
    });

    describe('쿨다운 거절 (직전 결과 없음)', () => {
        it('남은 시간을 담은 에러로 알린다', async () => {
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

    describe('retry (오류 뒤 다시 시도)', () => {
        async function renderErrored() {
            mockSubmit.mockResolvedValueOnce({
                status: 'error',
                axis: 'technical' as const,
                error: '분석 실패',
            });
            const hook = renderHook(() => useOverallAnalysis(...hookArgs()), {
                wrapper: makeWrapper(),
            });
            act(() => {
                hook.result.current.trigger();
            });
            await waitFor(() =>
                expect(hook.result.current.state.status).toBe('error')
            );
            return hook;
        }

        it('error 후 trigger를 재호출하면 분석을 재시도한다', async () => {
            const { result } = await renderErrored();
            mockSubmit.mockResolvedValueOnce({
                status: 'cached',
                result: OVERALL_RESULT,
            });

            act(() => {
                result.current.trigger();
            });
            await waitFor(() =>
                expect(result.current.state.status).toBe('done')
            );

            expect(mockSubmit).toHaveBeenCalledTimes(2);
        });

        it('재시도는 일반 요청이다 — 캐시를 우회하는 reanalyze 의도를 보내지 않는다', async () => {
            const { result } = await renderErrored();
            mockSubmit.mockClear();
            mockSubmit.mockResolvedValueOnce({
                status: 'cached',
                result: OVERALL_RESULT,
            });

            act(() => {
                result.current.trigger();
            });

            await waitFor(() =>
                expect(mockSubmit).toHaveBeenCalledWith(request())
            );
            expect(mockSubmit).not.toHaveBeenCalledWith(
                request({ reanalyze: true })
            );
        });

        it('쿨다운 에러 뒤 재시도도 reanalyze를 다시 보내지 않는다', async () => {
            mockSubmit.mockResolvedValueOnce({
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
                expect(result.current.state.status).toBe('error')
            );
            mockSubmit.mockClear();
            mockSubmit.mockResolvedValueOnce({
                status: 'cached',
                result: OVERALL_RESULT,
            });

            act(() => {
                result.current.trigger();
            });

            await waitFor(() =>
                expect(mockSubmit).toHaveBeenCalledWith(request())
            );
            expect(mockSubmit).not.toHaveBeenCalledWith(
                request({ reanalyze: true })
            );
        });

        it('재시도가 진행되는 동안에는 submitting으로 보인다', async () => {
            const { result } = await renderErrored();
            mockSubmit.mockImplementationOnce(() => new Promise(() => {}));

            act(() => {
                result.current.trigger();
            });

            await waitFor(() =>
                expect(result.current.state.status).toBe('submitting')
            );
        });
    });
});
