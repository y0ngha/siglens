import type { Mock } from 'vitest';
import type { StreamErrorMessages } from '@/shared/lib/sse/runAnalysisStream';
import { runAnalysisStream } from '@/shared/lib/sse/runAnalysisStream';
import { AwaitingInteractionError } from '@/shared/lib/AwaitingInteractionError';
import {
    fetchOverallAnalysis,
    type FetchOverallAnalysisRequest,
} from '@/widgets/overall/utils/fetchOverallAnalysis';
import {
    OverallAnalysisError,
    OverallCooldownError,
} from '@/widgets/overall/utils/overallErrors';

vi.mock('@/shared/lib/sse/runAnalysisStream', () => ({
    runAnalysisStream: vi.fn(),
}));

const mockStream = runAnalysisStream as Mock;

const MESSAGES = {
    analysisFailed: '분석 실패 문구',
    limitExceeded: '한도 문구',
    keyRequired: '키 문구',
    unexpected: '예상 밖 문구',
    reanalyzeCooldown: (seconds: number) => `${seconds}초 뒤 다시`,
} as unknown as StreamErrorMessages;

const REQUEST: FetchOverallAnalysisRequest = {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    timeframe: '1Hour',
    modelId: 'claude-sonnet-5-5',
    reasoning: true,
    intent: 'generate',
};

const BASE_PARAMS = {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    timeframe: '1Hour',
    modelId: 'claude-sonnet-5-5',
    reasoning: true,
};

describe('fetchOverallAnalysis', () => {
    beforeEach(() => {
        mockStream.mockReset();
    });

    describe('요청 의도 → 파라미터', () => {
        beforeEach(() => {
            mockStream.mockResolvedValue({ status: 'cached', result: {} });
        });

        it('generate는 추가 파라미터 없이 보낸다', async () => {
            await fetchOverallAnalysis(REQUEST, MESSAGES);

            expect(mockStream).toHaveBeenCalledWith({
                type: 'overall',
                params: BASE_PARAMS,
                signal: undefined,
                messages: MESSAGES,
            });
        });

        it('cache는 cacheOnly만 더한다', async () => {
            await fetchOverallAnalysis(
                { ...REQUEST, intent: 'cache' },
                MESSAGES
            );

            expect(mockStream).toHaveBeenCalledWith(
                expect.objectContaining({
                    params: { ...BASE_PARAMS, cacheOnly: true },
                })
            );
        });

        it('reanalyze는 reanalyze 의도만 더하고 force는 보내지 않는다', async () => {
            await fetchOverallAnalysis(
                { ...REQUEST, intent: 'reanalyze' },
                MESSAGES
            );

            expect(mockStream).toHaveBeenCalledWith(
                expect.objectContaining({
                    params: { ...BASE_PARAMS, reanalyze: true },
                })
            );
        });

        it('abort signal을 스트림에 넘긴다', async () => {
            const controller = new AbortController();

            await fetchOverallAnalysis(REQUEST, MESSAGES, controller.signal);

            expect(mockStream).toHaveBeenCalledWith(
                expect.objectContaining({ signal: controller.signal })
            );
        });
    });

    describe('결과 매핑', () => {
        it('plain 산문이 있으면 결과와 함께 돌려준다', async () => {
            mockStream.mockResolvedValue({
                status: 'done',
                result: { headlineKo: '헤드라인' },
                plain: '쉬운 설명',
            });

            await expect(
                fetchOverallAnalysis(REQUEST, MESSAGES)
            ).resolves.toEqual({
                data: { headlineKo: '헤드라인' },
                plain: '쉬운 설명',
            });
        });

        it('쿨다운 응답은 남은 초를 올림한 OverallCooldownError다', async () => {
            mockStream.mockResolvedValue({
                status: 'reanalyze_cooldown',
                remainingMs: 1_500,
            });

            const failure = await fetchOverallAnalysis(REQUEST, MESSAGES).catch(
                (e: unknown) => e
            );

            expect(failure).toBeInstanceOf(OverallCooldownError);
            expect((failure as Error).message).toBe('2초 뒤 다시');
        });

        it('cache 의도의 miss_no_trigger는 대기 센티넬이다', async () => {
            mockStream.mockResolvedValue({ status: 'miss_no_trigger' });

            await expect(
                fetchOverallAnalysis({ ...REQUEST, intent: 'cache' }, MESSAGES)
            ).rejects.toBeInstanceOf(AwaitingInteractionError);
        });

        it.each(['generate', 'reanalyze'] as const)(
            '%s 의도의 miss_no_trigger는 예상 밖 응답 오류다',
            async intent => {
                mockStream.mockResolvedValue({ status: 'miss_no_trigger' });

                const failure = await fetchOverallAnalysis(
                    { ...REQUEST, intent },
                    MESSAGES
                ).catch((e: unknown) => e);

                expect(failure).toBeInstanceOf(OverallAnalysisError);
                expect((failure as Error).message).toBe('예상 밖 문구');
            }
        );

        it('실패 응답의 axis를 오류에 보존한다', async () => {
            mockStream.mockResolvedValue({
                status: 'error',
                axis: 'options',
                error: 'Profile not found',
            });

            const failure = await fetchOverallAnalysis(REQUEST, MESSAGES).catch(
                (e: unknown) => e
            );

            expect(failure).toMatchObject({
                message: '분석 실패 문구',
                axis: 'options',
            });
        });
    });
});
