import {
    isVisibleFor,
    UNFILTERED_TOKEN,
    VISIBILITY_ATTR,
    visibilityAttrs,
} from '../lib/caseListVisibility';

describe('caseListVisibility', () => {
    it('visibilityAttrs는 토큰을 공백으로 이어 표기 속성 하나로 만든다', () => {
        expect(visibilityAttrs([UNFILTERED_TOKEN, 'AAPL'])).toEqual({
            [VISIBILITY_ATTR]: '* AAPL',
        });
    });

    it('isVisibleFor는 토큰 단위로만 일치시킨다(부분 문자열 아님)', () => {
        expect(isVisibleFor('* AAPL', 'AAPL')).toBe(true);
        expect(isVisibleFor('* AAPL', UNFILTERED_TOKEN)).toBe(true);
        expect(isVisibleFor('* AAPL', 'AAP')).toBe(false);
        expect(isVisibleFor('AAPL', UNFILTERED_TOKEN)).toBe(false);
    });
});
