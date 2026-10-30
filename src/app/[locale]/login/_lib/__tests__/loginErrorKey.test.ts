import { loginErrorKey } from '../loginErrorKey';

describe('loginErrorKey', () => {
    it('알려진 코드를 메시지 키로 바꾼다', () => {
        expect(loginErrorKey('oauth_email_conflict')).toBe(
            'error.oauthEmailConflict'
        );
    });

    it('쿼리가 없으면 undefined', () => {
        expect(loginErrorKey(null)).toBeUndefined();
    });

    it('빈 코드는 undefined', () => {
        expect(loginErrorKey('')).toBeUndefined();
    });

    it('표에 없는 코드는 undefined', () => {
        expect(loginErrorKey('some_unknown_code')).toBeUndefined();
    });

    it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
        '프로토타입 이름 %s는 키로 풀지 않는다',
        code => {
            expect(loginErrorKey(code)).toBeUndefined();
        }
    );
});
