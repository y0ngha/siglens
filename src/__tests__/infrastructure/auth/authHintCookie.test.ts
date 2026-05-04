import {
    AUTH_HINT_COOKIE_NAME,
    createAuthHintCookie,
    createExpiredAuthHintCookie,
} from '@/infrastructure/auth/authHintCookie';

describe('createAuthHintCookie', () => {
    it('쿠키 이름, 값, 경로, sameSite가 올바르게 설정된다', () => {
        const cookie = createAuthHintCookie({ maxAgeSeconds: 100 });
        expect(cookie.name).toBe(AUTH_HINT_COOKIE_NAME);
        expect(cookie.value).toBe('1');
        expect(cookie.path).toBe('/');
        expect(cookie.sameSite).toBe('lax');
    });

    it('httpOnly는 항상 false다', () => {
        const cookie = createAuthHintCookie({ maxAgeSeconds: 100 });
        expect(cookie.httpOnly).toBe(false);
    });

    it('secure 기본값은 true다', () => {
        const cookie = createAuthHintCookie({ maxAgeSeconds: 100 });
        expect(cookie.secure).toBe(true);
    });

    it('secure: false를 전달하면 false다', () => {
        const cookie = createAuthHintCookie({ maxAgeSeconds: 100, secure: false });
        expect(cookie.secure).toBe(false);
    });

    it('maxAge가 전달된 초 값으로 설정된다', () => {
        const cookie = createAuthHintCookie({ maxAgeSeconds: 2592000 });
        expect(cookie.maxAge).toBe(2592000);
    });
});

describe('createExpiredAuthHintCookie', () => {
    it('maxAge가 0이고 value가 빈 문자열이다', () => {
        const cookie = createExpiredAuthHintCookie();
        expect(cookie.maxAge).toBe(0);
        expect(cookie.value).toBe('');
    });

    it('쿠키 이름, 경로, sameSite가 올바르게 설정된다', () => {
        const cookie = createExpiredAuthHintCookie();
        expect(cookie.name).toBe(AUTH_HINT_COOKIE_NAME);
        expect(cookie.path).toBe('/');
        expect(cookie.sameSite).toBe('lax');
    });

    it('httpOnly는 항상 false다', () => {
        const cookie = createExpiredAuthHintCookie();
        expect(cookie.httpOnly).toBe(false);
    });

    it('secure 기본값은 true다', () => {
        const cookie = createExpiredAuthHintCookie();
        expect(cookie.secure).toBe(true);
    });

    it('secure: false를 전달하면 false다', () => {
        const cookie = createExpiredAuthHintCookie({ secure: false });
        expect(cookie.secure).toBe(false);
    });
});
