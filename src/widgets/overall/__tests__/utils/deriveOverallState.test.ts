import type { OverallAnalysisResponse } from '@y0ngha/siglens-core';
import { AwaitingInteractionError } from '@/shared/lib/AwaitingInteractionError';
import { deriveOverallState } from '@/widgets/overall/utils/deriveOverallState';
import {
    OverallAnalysisError,
    OverallCooldownError,
} from '@/widgets/overall/utils/overallErrors';

const RESULT: OverallAnalysisResponse = {
    headlineKo: '헤드라인',
    technicalBulletsKo: [],
    fundamentalBulletsKo: [],
    newsBulletsKo: [],
    optionsBulletsKo: [],
    financialsBulletsKo: [],
    integratedConclusionKo: '결론',
    scenarios: [],
    riskFactorsKo: [],
};

const DATA = { data: RESULT, plain: '쉬운 설명' };
const FALLBACK = '폴백 문구';

const IDLE_INPUT = {
    data: undefined,
    error: null,
    isFetching: false,
    isRequested: false,
    fallbackMessage: FALLBACK,
};

describe('deriveOverallState', () => {
    describe('결과가 없을 때', () => {
        it('요청한 적이 없으면 idle이다', () => {
            expect(deriveOverallState(IDLE_INPUT)).toEqual({ status: 'idle' });
        });

        it('요청했으면 submitting이다', () => {
            expect(
                deriveOverallState({ ...IDLE_INPUT, isRequested: true })
            ).toEqual({ status: 'submitting' });
        });

        it('캐시 미스 대기(AwaitingInteractionError)는 idle이다', () => {
            expect(
                deriveOverallState({
                    ...IDLE_INPUT,
                    isRequested: true,
                    error: new AwaitingInteractionError(),
                })
            ).toEqual({ status: 'idle' });
        });

        it('캐시 미스 대기 뒤 다시 요청이 도는 동안은 submitting이다', () => {
            expect(
                deriveOverallState({
                    ...IDLE_INPUT,
                    isRequested: true,
                    isFetching: true,
                    error: new AwaitingInteractionError(),
                })
            ).toEqual({ status: 'submitting' });
        });

        it('분류된 오류는 메시지와 axis를 담은 error다', () => {
            expect(
                deriveOverallState({
                    ...IDLE_INPUT,
                    isRequested: true,
                    error: new OverallAnalysisError('실패', 'news'),
                })
            ).toEqual({ status: 'error', error: '실패', axis: 'news' });
        });

        it('Error가 아닌 값은 폴백 문구를 쓴다', () => {
            expect(
                deriveOverallState({
                    ...IDLE_INPUT,
                    isRequested: true,
                    error: 'boom',
                })
            ).toEqual({
                status: 'error',
                error: FALLBACK,
                axis: undefined,
            });
        });

        it('오류 뒤 재시도가 도는 동안은 error 카드 대신 submitting이다', () => {
            expect(
                deriveOverallState({
                    ...IDLE_INPUT,
                    isRequested: true,
                    isFetching: true,
                    error: new OverallAnalysisError('실패'),
                })
            ).toEqual({ status: 'submitting' });
        });
    });

    describe('결과가 있을 때', () => {
        const DONE_INPUT = { ...IDLE_INPUT, data: DATA, isRequested: true };

        it('안내 없이 done이다', () => {
            expect(deriveOverallState(DONE_INPUT)).toEqual({
                status: 'done',
                result: RESULT,
                plain: '쉬운 설명',
                reanalyzing: false,
                notice: null,
            });
        });

        it('재요청이 도는 동안 reanalyzing=true다', () => {
            expect(
                deriveOverallState({ ...DONE_INPUT, isFetching: true })
            ).toMatchObject({ status: 'done', reanalyzing: true });
        });

        it('쿨다운 거절은 결과를 지키고 cooldown 안내를 단다', () => {
            expect(
                deriveOverallState({
                    ...DONE_INPUT,
                    error: new OverallCooldownError('120초 뒤'),
                })
            ).toEqual({
                status: 'done',
                result: RESULT,
                plain: '쉬운 설명',
                reanalyzing: false,
                notice: { kind: 'cooldown', message: '120초 뒤' },
            });
        });

        it('일반 실패는 결과를 지키고 failed 안내를 단다', () => {
            expect(
                deriveOverallState({
                    ...DONE_INPUT,
                    error: new OverallAnalysisError('실패'),
                })
            ).toMatchObject({
                status: 'done',
                notice: { kind: 'failed', message: '실패' },
            });
        });

        it('Error가 아닌 실패는 폴백 문구를 안내로 쓴다', () => {
            expect(
                deriveOverallState({ ...DONE_INPUT, error: 'boom' })
            ).toMatchObject({
                notice: { kind: 'failed', message: FALLBACK },
            });
        });

        it('캐시 미스 대기 오류는 안내로 쓰지 않는다', () => {
            expect(
                deriveOverallState({
                    ...DONE_INPUT,
                    error: new AwaitingInteractionError(),
                })
            ).toMatchObject({ notice: null });
        });

        it('새 요청이 도는 동안에는 직전 실패 안내를 거둔다', () => {
            expect(
                deriveOverallState({
                    ...DONE_INPUT,
                    isFetching: true,
                    error: new OverallCooldownError('120초 뒤'),
                })
            ).toMatchObject({ reanalyzing: true, notice: null });
        });
    });
});
