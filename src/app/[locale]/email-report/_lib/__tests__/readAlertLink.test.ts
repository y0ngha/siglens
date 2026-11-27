import { readAlertLink } from '@/app/[locale]/email-report/_lib/readAlertLink';

describe('readAlertLink', () => {
    it('s와 sig가 모두 있으면 값으로 돌려준다', () => {
        expect(readAlertLink({ s: 'id-1', sig: 'abc' })).toEqual({
            s: 'id-1',
            sig: 'abc',
        });
    });

    it('배열로 오면 첫 값을 쓴다', () => {
        expect(readAlertLink({ s: ['a', 'b'], sig: ['x'] })).toEqual({
            s: 'a',
            sig: 'x',
        });
    });

    it.each([
        {},
        { s: 'id-1' },
        { sig: 'abc' },
        { s: '', sig: 'abc' },
        { s: ['id'], sig: [] },
    ])('둘 중 하나라도 없거나 비면 undefined다 (%j)', params => {
        expect(readAlertLink(params)).toBeUndefined();
    });
});
