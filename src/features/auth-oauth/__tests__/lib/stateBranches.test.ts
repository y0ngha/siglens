/**
 * Branch coverage for auth-oauth state.ts — targets:
 * - L41: isStatePayload with non-object JSON payload (string/number/array)
 *   — 쿠키가 HMAC 서명을 통과했으나 디코드된 payload가 객체가 아닌 경우.
 * - L129: cookie with separator but empty parts
 */

import { createHmac } from 'crypto';
import { verifyOAuthState } from '@/features/auth-oauth/lib/state';

const VALID_SECRET = 'a'.repeat(64);

describe('verifyOAuthState — branch coverage', () => {
    beforeEach(() => {
        vi.stubEnv('OAUTH_STATE_HMAC_SECRET', VALID_SECRET);
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('returns { ok: false } when cookie has separator but empty payload', () => {
        // Cookie like ".signature" — separator at index 0, empty encodedPayload
        const result = verifyOAuthState(
            'google',
            'any-state',
            '.some-signature'
        );
        expect(result.ok).toBe(false);
    });

    it('returns { ok: false } when cookie has separator but empty signature', () => {
        // Cookie like "payload." — empty providedSignature
        const result = verifyOAuthState('google', 'any-state', 'payload.');
        expect(result.ok).toBe(false);
    });

    it('returns { ok: false } when payload JSON is a string (non-object) with a valid HMAC signature', () => {
        // 유효한 HMAC을 갖지만 페이로드가 JSON string primitive인 경우:
        // 서명 검증은 통과하나 isStatePayload(typeof !== 'object')에서 거부해야 한다.
        // verifyOAuthState 내부와 동일한 서명 경로(sha256 + base64url)를 사용해
        // 길이·값 양쪽이 일치하는 signature를 직접 조립한다.
        const rawJson = JSON.stringify('not-an-object');
        const encodedPayload = Buffer.from(rawJson).toString('base64url');
        const sig = createHmac('sha256', VALID_SECRET)
            .update(encodedPayload)
            .digest('base64url');
        const cookieValue = `${encodedPayload}.${sig}`;

        expect(verifyOAuthState('google', 'irrelevant', cookieValue)).toEqual({
            ok: false,
        });
    });

    it('returns { ok: false } when payload JSON is a number (non-object) with a valid HMAC signature', () => {
        // 숫자 primitive payload — 서명 통과 후 isStatePayload에서 거부.
        const encodedPayload = Buffer.from(JSON.stringify(42)).toString(
            'base64url'
        );
        const sig = createHmac('sha256', VALID_SECRET)
            .update(encodedPayload)
            .digest('base64url');
        const cookieValue = `${encodedPayload}.${sig}`;

        expect(verifyOAuthState('google', 'irrelevant', cookieValue)).toEqual({
            ok: false,
        });
    });

    it('returns { ok: false } when payload JSON is an array (non-object) with a valid HMAC signature', () => {
        // 배열은 typeof === 'object'이지만 StatePayload 필드 검사에서 거부된다.
        const encodedPayload = Buffer.from(JSON.stringify([])).toString(
            'base64url'
        );
        const sig = createHmac('sha256', VALID_SECRET)
            .update(encodedPayload)
            .digest('base64url');
        const cookieValue = `${encodedPayload}.${sig}`;

        expect(verifyOAuthState('google', 'irrelevant', cookieValue)).toEqual({
            ok: false,
        });
    });
});
