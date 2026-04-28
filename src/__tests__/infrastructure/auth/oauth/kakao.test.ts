import { kakaoOAuthAdapter } from '@/infrastructure/auth/oauth/kakao';
import { jsonResponse } from '@/__tests__/fixtures/jsonResponse';

const ORIGINAL_FETCH = global.fetch;

describe('kakaoOAuthAdapter', () => {
    const REDIRECT_URI = 'https://app.example.com/api/auth/callback/kakao';

    beforeEach(() => {
        process.env.KAKAO_REST_API_KEY = 'kkey';
        delete process.env.KAKAO_CLIENT_SECRET;
    });

    afterEach(() => {
        global.fetch = ORIGINAL_FETCH;
    });

    it('KAKAO_REST_API_KEY 미설정 시 빈 문자열로 빌드되고 token 단계도 통과한다', async () => {
        delete process.env.KAKAO_REST_API_KEY;
        const url = kakaoOAuthAdapter.authorizeUrl({
            state: 's',
            redirectUri: REDIRECT_URI,
        });
        expect(new URL(url).searchParams.get('client_id')).toBe('');
        global.fetch = jest.fn(async () => jsonResponse(400, {})) as never;
        await expect(
            kakaoOAuthAdapter.exchangeCodeForProfile({
                code: 'c',
                redirectUri: REDIRECT_URI,
            })
        ).resolves.toEqual({ ok: false, reason: 'token_exchange_failed' });
    });

    it('kakao_account에 profile이 없으면 name/avatarUrl이 undefined로 반환된다', async () => {
        const calls = [
            jsonResponse(200, { access_token: 'tok' }),
            jsonResponse(200, {
                id: 7,
                kakao_account: { email: 'u@e.com' },
            }),
        ];
        global.fetch = jest.fn(async () => calls.shift()!) as never;
        await expect(
            kakaoOAuthAdapter.exchangeCodeForProfile({
                code: 'c',
                redirectUri: REDIRECT_URI,
            })
        ).resolves.toEqual({
            ok: true,
            profile: {
                provider: 'kakao',
                providerAccountId: '7',
                email: 'u@e.com',
                name: undefined,
                avatarUrl: undefined,
            },
        });
    });

    it('authorizeUrl은 client_id/state/redirect_uri/scope 포함', () => {
        const url = kakaoOAuthAdapter.authorizeUrl({
            state: 'abc',
            redirectUri: REDIRECT_URI,
        });
        const parsed = new URL(url);
        expect(parsed.origin).toBe('https://kauth.kakao.com');
        expect(parsed.searchParams.get('client_id')).toBe('kkey');
        expect(parsed.searchParams.get('state')).toBe('abc');
    });

    it('client_secret이 설정되면 token 요청 본문에 포함된다', async () => {
        process.env.KAKAO_CLIENT_SECRET = 'ksecret';
        const calls = [
            jsonResponse(200, { access_token: 'tok' }),
            jsonResponse(200, {
                id: 1,
                kakao_account: { email: 'u@e.com' },
            }),
        ];
        const fetchMock = jest.fn(async () => calls.shift()!) as jest.Mock;
        global.fetch = fetchMock as never;
        await kakaoOAuthAdapter.exchangeCodeForProfile({
            code: 'c',
            redirectUri: REDIRECT_URI,
        });
        const tokenBody = fetchMock.mock.calls[0]![1]?.body as URLSearchParams;
        expect(tokenBody.get('client_secret')).toBe('ksecret');
    });

    it('token endpoint가 비OK면 token_exchange_failed', async () => {
        global.fetch = jest.fn(async () => jsonResponse(400, {})) as never;
        await expect(
            kakaoOAuthAdapter.exchangeCodeForProfile({
                code: 'c',
                redirectUri: REDIRECT_URI,
            })
        ).resolves.toEqual({ ok: false, reason: 'token_exchange_failed' });
    });

    it('access_token이 누락되면 token_exchange_failed', async () => {
        global.fetch = jest.fn(async () => jsonResponse(200, {})) as never;
        await expect(
            kakaoOAuthAdapter.exchangeCodeForProfile({
                code: 'c',
                redirectUri: REDIRECT_URI,
            })
        ).resolves.toEqual({ ok: false, reason: 'token_exchange_failed' });
    });

    it('user 응답이 비OK면 profile_fetch_failed', async () => {
        const calls = [
            jsonResponse(200, { access_token: 'tok' }),
            jsonResponse(500, {}),
        ];
        global.fetch = jest.fn(async () => calls.shift()!) as never;
        await expect(
            kakaoOAuthAdapter.exchangeCodeForProfile({
                code: 'c',
                redirectUri: REDIRECT_URI,
            })
        ).resolves.toEqual({ ok: false, reason: 'profile_fetch_failed' });
    });

    it('email 또는 id 누락 시 email_missing', async () => {
        const calls = [
            jsonResponse(200, { access_token: 'tok' }),
            jsonResponse(200, { id: 1 }),
        ];
        global.fetch = jest.fn(async () => calls.shift()!) as never;
        await expect(
            kakaoOAuthAdapter.exchangeCodeForProfile({
                code: 'c',
                redirectUri: REDIRECT_URI,
            })
        ).resolves.toEqual({ ok: false, reason: 'email_missing' });
    });

    it('token JSON 파싱 실패 시 token_exchange_failed', async () => {
        global.fetch = jest.fn(
            async () => new Response('not-json', { status: 200 })
        ) as never;
        await expect(
            kakaoOAuthAdapter.exchangeCodeForProfile({
                code: 'c',
                redirectUri: REDIRECT_URI,
            })
        ).resolves.toEqual({ ok: false, reason: 'token_exchange_failed' });
    });

    it('user JSON 파싱 실패 시 profile_fetch_failed', async () => {
        const calls = [
            jsonResponse(200, { access_token: 'tok' }),
            new Response('not-json', { status: 200 }),
        ];
        global.fetch = jest.fn(async () => calls.shift()!) as never;
        await expect(
            kakaoOAuthAdapter.exchangeCodeForProfile({
                code: 'c',
                redirectUri: REDIRECT_URI,
            })
        ).resolves.toEqual({ ok: false, reason: 'profile_fetch_failed' });
    });

    it('성공 시 SocialLoginUserInput을 반환한다', async () => {
        const calls = [
            jsonResponse(200, { access_token: 'tok' }),
            jsonResponse(200, {
                id: 42,
                kakao_account: {
                    email: 'u@e.com',
                    profile: {
                        nickname: '닉네임',
                        profile_image_url: 'https://img',
                    },
                },
            }),
        ];
        global.fetch = jest.fn(async () => calls.shift()!) as never;
        await expect(
            kakaoOAuthAdapter.exchangeCodeForProfile({
                code: 'c',
                redirectUri: REDIRECT_URI,
            })
        ).resolves.toEqual({
            ok: true,
            profile: {
                provider: 'kakao',
                providerAccountId: '42',
                email: 'u@e.com',
                name: '닉네임',
                avatarUrl: 'https://img',
            },
        });
    });
});
