import { describe, expect, it } from 'vitest';
import { omitUnfiltered } from '../omitUnfiltered';

describe('omitUnfiltered', () => {
    it('unfilteredResult를 뺀 나머지 필드를 그대로 돌려준다', () => {
        expect(
            omitUnfiltered({
                status: 'done',
                result: { trend: 'bullish' },
                unfilteredResult: { entry: 100 },
            })
        ).toEqual({ status: 'done', result: { trend: 'bullish' } });
    });

    it('unfilteredResult 키 자체가 응답에 남지 않는다', () => {
        const stripped = omitUnfiltered({
            status: 'done',
            unfilteredResult: 1,
        });
        expect(Object.keys(stripped)).toEqual(['status']);
    });

    it('unfilteredResult가 없는 결과는 그대로 통과한다', () => {
        expect(omitUnfiltered({ status: 'cached', result: 1 })).toEqual({
            status: 'cached',
            result: 1,
        });
    });

    it('원본 객체를 변경하지 않는다', () => {
        const original = { status: 'done', unfilteredResult: { entry: 1 } };
        omitUnfiltered(original);
        expect(original.unfilteredResult).toEqual({ entry: 1 });
    });
});
