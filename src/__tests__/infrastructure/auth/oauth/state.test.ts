import { createHmac } from 'crypto';
import {
    OAUTH_STATE_COOKIE_NAME,
    OAUTH_STATE_TTL_SECONDS,
    OAuthStateSecretMisconfiguredError,
    expiredOAuthStateCookie,
    issueOAuthState,
    verifyOAuthState,
} from '@/infrastructure/auth/oauth/state';

const FIXED_NOW = new Date('2026-04-28T00:00:00.000Z');
const VALID_SECRET = 'a'.repeat(64); // 64-byte UTF-8 string, well over 32 bytes.

describe('issueOAuthState / verifyOAuthState', () => {
    const ORIGINAL_SECRET = process.env.OAUTH_STATE_HMAC_SECRET;

    beforeEach(() => {
        process.env.OAUTH_STATE_HMAC_SECRET = VALID_SECRET;
    });

    afterEach(() => {
        if (ORIGINAL_SECRET === undefined) {
            delete process.env.OAUTH_STATE_HMAC_SECRET;
        } else {
            process.env.OAUTH_STATE_HMAC_SECRET = ORIGINAL_SECRET;
        }
    });

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

    it('서명 부분이 없으면 (구버전 unsigned 포맷) 거부한다', () => {
        const { state } = issueOAuthState('google', '/', FIXED_NOW);
        const unsignedPayload = Buffer.from(
            JSON.stringify({
                state,
                provider: 'google',
                next: '/',
                exp: FIXED_NOW.getTime() + 60_000,
            })
        ).toString('base64url');
        expect(
            verifyOAuthState('google', state, unsignedPayload, FIXED_NOW)
        ).toEqual({ ok: false });
    });

    it('서명이 잘못되면 거부한다 (signature tampering)', () => {
        const { state, cookie } = issueOAuthState('google', '/', FIXED_NOW);
        const dotIndex = cookie.value.indexOf('.');
        const tampered = `${cookie.value.slice(0, dotIndex + 1)}AAAAAA`;
        expect(verifyOAuthState('google', state, tampered, FIXED_NOW)).toEqual({
            ok: false,
        });
    });

    it('payload가 변경되면 거부한다 (payload tampering)', () => {
        const { state, cookie } = issueOAuthState('google', '/', FIXED_NOW);
        const dotIndex = cookie.value.indexOf('.');
        const originalPayload = cookie.value.slice(0, dotIndex);
        const signature = cookie.value.slice(dotIndex + 1);

        // Replace payload with a forged one (different next path).
        const forged = Buffer.from(
            JSON.stringify({
                state,
                provider: 'google',
                next: '/admin',
                exp: FIXED_NOW.getTime() + 60_000,
            })
        ).toString('base64url');
        expect(forged).not.toBe(originalPayload);
        const tampered = `${forged}.${signature}`;
        expect(verifyOAuthState('google', state, tampered, FIXED_NOW)).toEqual({
            ok: false,
        });
    });

    it('cookie payload가 JSON primitive (null/숫자/문자열)이면 거부한다', () => {
        // We can construct primitives but they won't have the right HMAC.
        // The signature check rejects them before parse — both paths return ok:false.
        const cases = ['null', '123', '"abc"', '[]'];
        for (const raw of cases) {
            const cookieValue = `${Buffer.from(raw).toString('base64url')}.deadbeef`;
            expect(
                verifyOAuthState('google', 'irrelevant', cookieValue, FIXED_NOW)
            ).toEqual({ ok: false });
        }
    });

    it('cookie payload에 필수 필드가 누락되면 거부한다', () => {
        // Sign a payload missing required fields — signature passes but isStatePayload rejects.
        const encoded = Buffer.from(
            JSON.stringify({ provider: 'google' })
        ).toString('base64url');
        const sig = createHmac('sha256', VALID_SECRET)
            .update(encoded)
            .digest('base64url');
        const cookieValue = `${encoded}.${sig}`;
        expect(
            verifyOAuthState('google', 'irrelevant', cookieValue, FIXED_NOW)
        ).toEqual({ ok: false });
    });

    it('provider 가 일치하지 않으면 거부한다 (signed payload with mismatched provider)', () => {
        // SupportedOAuthProvider 는 현재 'google' 만 허용하므로 issueOAuthState 로
        // 'kakao' state 를 발급할 수 없다. 대신 시그니처가 유효한 mismatched payload 를
        // 직접 조립해 provider 검사 경로가 이를 거부하는지 확인한다.
        const { state } = issueOAuthState('google', '/', FIXED_NOW);
        const encoded = Buffer.from(
            JSON.stringify({
                state,
                provider: 'kakao',
                next: '/',
                exp: FIXED_NOW.getTime() + 60_000,
            })
        ).toString('base64url');
        const sig = createHmac('sha256', VALID_SECRET)
            .update(encoded)
            .digest('base64url');
        const cookieValue = `${encoded}.${sig}`;
        expect(
            verifyOAuthState('google', state, cookieValue, FIXED_NOW)
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

    it('TTL 경계 시각과 동일한 state는 아직 유효하다', () => {
        const { state, cookie } = issueOAuthState('google', '/', FIXED_NOW);
        const boundary = new Date(
            FIXED_NOW.getTime() + OAUTH_STATE_TTL_SECONDS * 1000
        );
        expect(
            verifyOAuthState('google', state, cookie.value, boundary)
        ).toEqual({
            ok: true,
            next: '/',
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

    it('OAUTH_STATE_HMAC_SECRET 가 없으면 issueOAuthState 가 throw 한다', () => {
        delete process.env.OAUTH_STATE_HMAC_SECRET;
        expect(() => issueOAuthState('google', '/', FIXED_NOW)).toThrow(
            OAuthStateSecretMisconfiguredError
        );
    });

    it('OAUTH_STATE_HMAC_SECRET 가 없으면 verifyOAuthState 도 throw 한다', () => {
        // Issue with a secret, then strip the secret — verifyOAuthState must
        // refuse to validate (fail closed) by throwing rather than returning ok:false
        // because returning ok:false would let attackers hide misconfiguration.
        const { state, cookie } = issueOAuthState('google', '/', FIXED_NOW);
        delete process.env.OAUTH_STATE_HMAC_SECRET;
        expect(() =>
            verifyOAuthState('google', state, cookie.value, FIXED_NOW)
        ).toThrow(OAuthStateSecretMisconfiguredError);
    });

    it('OAUTH_STATE_HMAC_SECRET 가 32바이트 미만이면 throw 한다', () => {
        process.env.OAUTH_STATE_HMAC_SECRET = 'tooshort';
        expect(() => issueOAuthState('google', '/', FIXED_NOW)).toThrow(
            OAuthStateSecretMisconfiguredError
        );
    });
});
