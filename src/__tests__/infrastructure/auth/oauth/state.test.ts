import {
    OAUTH_STATE_COOKIE_NAME,
    OAUTH_STATE_TTL_SECONDS,
    expiredOAuthStateCookie,
    issueOAuthState,
    verifyOAuthState,
} from '@/infrastructure/auth/oauth/state';

const FIXED_NOW = new Date('2026-04-28T00:00:00.000Z');

describe('issueOAuthState / verifyOAuthState', () => {
    it('정상 발급된 state는 동일 쿠키와 함께 검증을 통과한다', () => {
        const { state, cookie } = issueOAuthState(
            'google',
            '/market',
            FIXED_NOW
        );
        const result = verifyOAuthState(
            'google',
            state,
            cookie.value,
            FIXED_NOW
        );
        expect(result).toEqual({ ok: true, next: '/market' });
        expect(cookie.name).toBe(OAUTH_STATE_COOKIE_NAME);
        expect(cookie.maxAge).toBe(OAUTH_STATE_TTL_SECONDS);
    });

    it('cookie 값이 없으면 거부한다', () => {
        const { state } = issueOAuthState('google', '/', FIXED_NOW);
        expect(verifyOAuthState('google', state, undefined, FIXED_NOW)).toEqual(
            {
                ok: false,
            }
        );
    });

    it('cookie payload가 손상되면 거부한다', () => {
        const { state } = issueOAuthState('google', '/', FIXED_NOW);
        expect(
            verifyOAuthState('google', state, 'not-base64', FIXED_NOW)
        ).toEqual({ ok: false });
    });

    it('cookie payload가 JSON primitive (null/숫자/문자열)이면 거부한다', () => {
        const cases = ['null', '123', '"abc"', '[]'];
        for (const raw of cases) {
            const cookieValue = Buffer.from(raw).toString('base64url');
            expect(
                verifyOAuthState('google', 'irrelevant', cookieValue, FIXED_NOW)
            ).toEqual({ ok: false });
        }
    });

    it('cookie payload에 필수 필드가 누락되면 거부한다', () => {
        const cookieValue = Buffer.from(
            JSON.stringify({ provider: 'google' })
        ).toString('base64url');
        expect(
            verifyOAuthState('google', 'irrelevant', cookieValue, FIXED_NOW)
        ).toEqual({ ok: false });
    });

    it('provider 가 일치하지 않으면 거부한다', () => {
        const { state, cookie } = issueOAuthState('google', '/', FIXED_NOW);
        expect(
            verifyOAuthState('kakao', state, cookie.value, FIXED_NOW)
        ).toEqual({ ok: false });
    });

    it('만료 시각을 지난 state는 거부한다', () => {
        const { state, cookie } = issueOAuthState('google', '/', FIXED_NOW);
        const later = new Date(
            FIXED_NOW.getTime() + (OAUTH_STATE_TTL_SECONDS + 1) * 1000
        );
        expect(verifyOAuthState('google', state, cookie.value, later)).toEqual({
            ok: false,
        });
    });

    it('쿼리 state가 cookie 길이와 다르면 거부한다', () => {
        const { cookie } = issueOAuthState('google', '/', FIXED_NOW);
        expect(
            verifyOAuthState('google', 'short', cookie.value, FIXED_NOW)
        ).toEqual({
            ok: false,
        });
    });

    it('쿼리 state가 같은 길이지만 다른 값이면 거부한다', () => {
        const { state, cookie } = issueOAuthState('google', '/', FIXED_NOW);
        const tampered = state.slice(0, -1) + (state.endsWith('A') ? 'B' : 'A');
        expect(
            verifyOAuthState('google', tampered, cookie.value, FIXED_NOW)
        ).toEqual({ ok: false });
    });

    it('now 인자를 생략하면 현재 시각 기본값을 사용한다', () => {
        const { state, cookie } = issueOAuthState('google', '/');
        expect(state).toHaveLength(43);
        const result = verifyOAuthState('google', state, cookie.value);
        expect(result).toEqual({ ok: true, next: '/' });
    });

    it('expiredOAuthStateCookie는 epoch 만료 / maxAge 0 으로 설정된다', () => {
        const cookie = expiredOAuthStateCookie();
        expect(cookie.name).toBe(OAUTH_STATE_COOKIE_NAME);
        expect(cookie.maxAge).toBe(0);
        expect(cookie.expires.getTime()).toBe(0);
    });
});
