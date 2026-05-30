import { describe, it, expect } from 'vitest';
import { e2eFakeOAuthAdapter } from '@/features/auth-oauth/lib/E2eFakeOAuthAdapter';

describe('e2eFakeOAuthAdapter', () => {
    const REDIRECT_URI = 'http://localhost:3000/api/auth/callback/google';

    it('id는 google이다', () => {
        expect(e2eFakeOAuthAdapter.id).toBe('google');
    });

    it('authorizeUrl은 secret 없이 localhost URL을 만들고 state/redirect_uri를 포함한다', () => {
        // No GOOGLE_CLIENT_ID required — proves the fake needs no real secret.
        delete process.env.GOOGLE_CLIENT_ID;
        const url = e2eFakeOAuthAdapter.authorizeUrl({
            state: 'st-123',
            redirectUri: REDIRECT_URI,
        });
        const parsed = new URL(url);
        expect(parsed.protocol).toBe('http:');
        expect(parsed.hostname).toBe('localhost');
        expect(parsed.searchParams.get('state')).toBe('st-123');
        expect(parsed.searchParams.get('redirect_uri')).toBe(REDIRECT_URI);
    });

    it('exchangeCodeForProfile은 임의 code에 대해 결정적 fixture 프로필을 반환한다', async () => {
        await expect(
            e2eFakeOAuthAdapter.exchangeCodeForProfile({
                code: 'anything',
                redirectUri: REDIRECT_URI,
            })
        ).resolves.toEqual({
            ok: true,
            profile: {
                provider: 'google',
                providerAccountId: 'e2e-google-user',
                email: 'e2e.oauth@test.com',
                name: 'E2E OAuth User',
                avatarUrl: 'http://localhost/e2e-oauth-avatar.png',
                accessToken: 'e2e-access-token',
                refreshToken: 'e2e-refresh-token',
                tokenExpiresAt: new Date('2099-01-01T00:00:00.000Z'),
            },
        });
    });

    it('다른 code 값으로도 동일한 프로필을 반환한다 (결정적)', async () => {
        const a = await e2eFakeOAuthAdapter.exchangeCodeForProfile({
            code: 'e2e_code_A',
            redirectUri: REDIRECT_URI,
        });
        const b = await e2eFakeOAuthAdapter.exchangeCodeForProfile({
            code: 'e2e_code_B',
            redirectUri: REDIRECT_URI,
        });
        expect(a).toEqual(b);
    });
});
