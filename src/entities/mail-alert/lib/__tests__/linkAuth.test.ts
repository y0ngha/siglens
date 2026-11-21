import { readLinkAuth } from '@/entities/mail-alert/lib/linkAuth';

describe('readLinkAuth', () => {
    it('문자열 s·sig를 가진 객체만 받고 나머지 필드는 버린다', () => {
        expect(readLinkAuth({ s: 'id', sig: 'x', extra: 1 })).toEqual({
            s: 'id',
            sig: 'x',
        });
    });

    it.each([undefined, null, 'x', 1, {}, { s: 'a' }, { s: 1, sig: 'x' }])(
        '믿을 수 없는 값(%j)은 undefined다',
        value => {
            expect(readLinkAuth(value)).toBeUndefined();
        }
    );
});
