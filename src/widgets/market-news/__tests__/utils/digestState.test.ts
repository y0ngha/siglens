import type { NewsAnalysisResponse } from '@y0ngha/siglens-core';
import {
    resolveDigestState,
    toDigestError,
} from '@/widgets/market-news/utils/digestState';

const RESULT: NewsAnalysisResponse = {
    overallSentiment: 'bullish',
    currentDriverKo: '동인',
    keyEventsKo: [],
    upcomingEventsKo: [],
};
const retry = (): void => {};
const waitError = new Error('wait');
const queryError = new Error('query');

describe('resolveDigestState', () => {
    it('결과가 있으면 대기·쿼리 실패보다 우선한다', () => {
        expect(
            resolveDigestState({ result: RESULT, waitError, queryError, retry })
        ).toEqual({ status: 'done', result: RESULT });
    });

    it('결과가 없고 대기 실패면 대기 오류를 쿼리 오류보다 먼저 낸다', () => {
        expect(
            resolveDigestState({
                result: undefined,
                waitError,
                queryError,
                retry,
            })
        ).toEqual({ status: 'error', error: waitError, retry });
    });

    it('결과가 없고 쿼리만 실패했으면 쿼리 오류를 낸다', () => {
        expect(
            resolveDigestState({
                result: undefined,
                waitError: null,
                queryError,
                retry,
            })
        ).toEqual({ status: 'error', error: queryError, retry });
    });

    it('아무것도 없으면 loading이다', () => {
        expect(
            resolveDigestState({
                result: undefined,
                waitError: null,
                queryError: null,
                retry,
            })
        ).toEqual({ status: 'loading' });
    });
});

describe('toDigestError', () => {
    it('Error는 그대로 돌려준다', () => {
        expect(toDigestError(queryError, '대체')).toBe(queryError);
    });

    it('Error가 아니면 대체 문구의 Error로 바꾼다', () => {
        expect(toDigestError('boom', '대체').message).toBe('대체');
    });
});
