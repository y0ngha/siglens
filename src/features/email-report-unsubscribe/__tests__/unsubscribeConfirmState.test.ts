import {
    readUnsubscribeInput,
    resolveUnsubscribeErrorMessage,
} from '@/features/email-report-unsubscribe/lib/unsubscribeConfirmState';

describe('readUnsubscribeInput', () => {
    it('u·sig가 모두 있으면 id·서명을 돌려준다', () => {
        expect(
            readUnsubscribeInput(new URLSearchParams('u=user-1&sig=abc'))
        ).toEqual({ userId: 'user-1', signature: 'abc' });
    });

    it.each(['u=user-1', 'sig=abc', 'u=&sig=abc', 'u=user-1&sig=', ''])(
        '하나라도 비면 null이다 (%s)',
        query => {
            expect(readUnsubscribeInput(new URLSearchParams(query))).toBeNull();
        }
    );
});

describe('resolveUnsubscribeErrorMessage', () => {
    it('서버 오류 결과는 그 문구를 쓴다', () => {
        expect(
            resolveUnsubscribeErrorMessage(
                {
                    status: 'error',
                    code: 'invalid_link',
                    message: '서버 문구',
                },
                false,
                '일반 문구'
            )
        ).toBe('서버 문구');
    });

    it('요청 자체가 실패하면 fallback을 쓴다', () => {
        expect(
            resolveUnsubscribeErrorMessage(undefined, true, '일반 문구')
        ).toBe('일반 문구');
    });

    it('성공했거나 아직 요청 전이면 null이다', () => {
        expect(
            resolveUnsubscribeErrorMessage({ status: 'ok' }, false, '일반 문구')
        ).toBeNull();
        expect(
            resolveUnsubscribeErrorMessage(undefined, false, '일반 문구')
        ).toBeNull();
    });
});
