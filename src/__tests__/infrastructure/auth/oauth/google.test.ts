import { googleOAuthAdapter } from '@/infrastructure/auth/oauth/google';

const ORIGINAL_FETCH = global.fetch;

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}

describe('googleOAuthAdapter', () => {
    const REDIRECT_URI = 'https://app.example.com/api/auth/callback/google';

    beforeEach(() => {
        process.env.GOOGLE_CLIENT_ID = 'gclient';
        process.env.GOOGLE_CLIENT_SECRET = 'gsecret';
    });

    afterEach(() => {
        global.fetch = ORIGINAL_FETCH;
    });

    it('GOOGLE_CLIENT_ID/SECRET 미설정 시 빈 문자열로 빌드된다', async () => {
        delete process.env.GOOGLE_CLIENT_ID;
        delete process.env.GOOGLE_CLIENT_SECRET;
        const url = googleOAuthAdapter.authorizeUrl({
            state: 's',
            redirectUri: REDIRECT_URI,
        });
        expect(new URL(url).searchParams.get('client_id')).toBe('');
        global.fetch = jest.fn(async () => jsonResponse(400, {})) as never;
        await expect(
            googleOAuthAdapter.exchangeCodeForProfile({
                code: 'c',
                redirectUri: REDIRECT_URI,
            })
        ).resolves.toEqual({ ok: false, reason: 'token_exchange_failed' });
    });

    it('authorizeUrl은 client_id/state/redirect_uri/scope를 모두 포함한다', () => {
        const url = googleOAuthAdapter.authorizeUrl({
            state: 'abc',
            redirectUri: REDIRECT_URI,
        });
        const parsed = new URL(url);
        expect(parsed.origin).toBe('https://accounts.google.com');
        expect(parsed.searchParams.get('client_id')).toBe('gclient');
        expect(parsed.searchParams.get('state')).toBe('abc');
        expect(parsed.searchParams.get('redirect_uri')).toBe(REDIRECT_URI);
        expect(parsed.searchParams.get('scope')).toContain('email');
    });

    it('token endpoint 가 비OK면 token_exchange_failed', async () => {
        global.fetch = jest.fn(async () => jsonResponse(400, {})) as never;
        await expect(
            googleOAuthAdapter.exchangeCodeForProfile({
                code: 'c',
                redirectUri: REDIRECT_URI,
            })
        ).resolves.toEqual({ ok: false, reason: 'token_exchange_failed' });
    });

    it('access_token이 누락되면 token_exchange_failed', async () => {
        global.fetch = jest.fn(async () => jsonResponse(200, {})) as never;
        await expect(
            googleOAuthAdapter.exchangeCodeForProfile({
                code: 'c',
                redirectUri: REDIRECT_URI,
            })
        ).resolves.toEqual({ ok: false, reason: 'token_exchange_failed' });
    });

    it('userinfo가 비OK면 profile_fetch_failed', async () => {
        const calls = [
            jsonResponse(200, { access_token: 'tok' }),
            jsonResponse(401, {}),
        ];
        global.fetch = jest.fn(async () => calls.shift()!) as never;
        await expect(
            googleOAuthAdapter.exchangeCodeForProfile({
                code: 'c',
                redirectUri: REDIRECT_URI,
            })
        ).resolves.toEqual({ ok: false, reason: 'profile_fetch_failed' });
    });

    it('email/sub 누락 시 email_missing', async () => {
        const calls = [
            jsonResponse(200, { access_token: 'tok' }),
            jsonResponse(200, { sub: 'gid' }),
        ];
        global.fetch = jest.fn(async () => calls.shift()!) as never;
        await expect(
            googleOAuthAdapter.exchangeCodeForProfile({
                code: 'c',
                redirectUri: REDIRECT_URI,
            })
        ).resolves.toEqual({ ok: false, reason: 'email_missing' });
    });

    it('성공 시 SocialLoginUserInput을 반환한다', async () => {
        const calls = [
            jsonResponse(200, { access_token: 'tok' }),
            jsonResponse(200, {
                sub: 'gid',
                email: 'user@example.com',
                name: 'User',
                picture: 'https://img/u.png',
            }),
        ];
        global.fetch = jest.fn(async () => calls.shift()!) as never;
        await expect(
            googleOAuthAdapter.exchangeCodeForProfile({
                code: 'c',
                redirectUri: REDIRECT_URI,
            })
        ).resolves.toEqual({
            ok: true,
            profile: {
                provider: 'google',
                providerAccountId: 'gid',
                email: 'user@example.com',
                name: 'User',
                avatarUrl: 'https://img/u.png',
            },
        });
    });
});
