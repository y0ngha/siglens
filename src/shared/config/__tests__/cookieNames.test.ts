import {
    AUTH_HINT_COOKIE_NAME,
    AUTH_SESSION_COOKIE_NAME,
} from '@/shared/config/cookieNames';

describe('AUTH_SESSION_COOKIE_NAME', () => {
    it('비어있지 않은 문자열이다', () => {
        expect(typeof AUTH_SESSION_COOKIE_NAME).toBe('string');
        expect(AUTH_SESSION_COOKIE_NAME.length).toBeGreaterThan(0);
    });

    it("'siglens_session'으로 설정되어 있다", () => {
        expect(AUTH_SESSION_COOKIE_NAME).toBe('siglens_session');
    });
});

describe('AUTH_HINT_COOKIE_NAME', () => {
    it('비어있지 않은 문자열이다', () => {
        expect(typeof AUTH_HINT_COOKIE_NAME).toBe('string');
        expect(AUTH_HINT_COOKIE_NAME.length).toBeGreaterThan(0);
    });

    it("'siglens_auth'로 설정되어 있다", () => {
        expect(AUTH_HINT_COOKIE_NAME).toBe('siglens_auth');
    });
});

describe('쿠키 이름 고유성', () => {
    it('세션 쿠키와 힌트 쿠키 이름이 서로 다르다', () => {
        expect(AUTH_SESSION_COOKIE_NAME).not.toBe(AUTH_HINT_COOKIE_NAME);
    });
});
