import {
    GOOGLE_REQUEST_TIMEOUT_MS,
    googleOAuthAdapter,
} from '@/features/auth-oauth/lib/google';
import { jsonResponse } from '@/shared/test-utils/jsonResponse';

const ORIGINAL_FETCH = global.fetch;

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
        global.fetch = vi.fn(async () => jsonResponse(400, {})) as never;
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
        global.fetch = vi.fn(async () => jsonResponse(400, {})) as never;
        await expect(
            googleOAuthAdapter.exchangeCodeForProfile({
                code: 'c',
                redirectUri: REDIRECT_URI,
            })
        ).resolves.toEqual({ ok: false, reason: 'token_exchange_failed' });
    });

    it('access_token이 누락되면 token_exchange_failed', async () => {
        global.fetch = vi.fn(async () => jsonResponse(200, {})) as never;
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
        global.fetch = vi.fn(async () => calls.shift()!) as never;
        await expect(
            googleOAuthAdapter.exchangeCodeForProfile({
                code: 'c',
                redirectUri: REDIRECT_URI,
            })
        ).resolves.toEqual({ ok: false, reason: 'profile_fetch_failed' });
    });

    it('access_token이 문자열이 아니면 token_exchange_failed', async () => {
        global.fetch = vi.fn(async () =>
            jsonResponse(200, { access_token: 123 })
        ) as never;
        await expect(
            googleOAuthAdapter.exchangeCodeForProfile({
                code: 'c',
                redirectUri: REDIRECT_URI,
            })
        ).resolves.toEqual({ ok: false, reason: 'token_exchange_failed' });
    });

    it.each([
        ['sub', { sub: 123, email: 'user@example.com' }],
        ['email', { sub: 'gid', email: { value: 'user@example.com' } }],
    ])('%s가 문자열이 아니면 email_missing', async (_field, userinfo) => {
        const calls = [
            jsonResponse(200, { access_token: 'tok' }),
            jsonResponse(200, userinfo),
        ];
        global.fetch = vi.fn(async () => calls.shift()!) as never;
        await expect(
            googleOAuthAdapter.exchangeCodeForProfile({
                code: 'c',
                redirectUri: REDIRECT_URI,
            })
        ).resolves.toEqual({ ok: false, reason: 'email_missing' });
    });

    it('email/sub 누락 시 email_missing', async () => {
        const calls = [
            jsonResponse(200, { access_token: 'tok' }),
            jsonResponse(200, { sub: 'gid' }),
        ];
        global.fetch = vi.fn(async () => calls.shift()!) as never;
        await expect(
            googleOAuthAdapter.exchangeCodeForProfile({
                code: 'c',
                redirectUri: REDIRECT_URI,
            })
        ).resolves.toEqual({ ok: false, reason: 'email_missing' });
    });

    it('token JSON 파싱 실패 시 token_exchange_failed', async () => {
        global.fetch = vi.fn(
            async () => new Response('not-json', { status: 200 })
        ) as never;
        await expect(
            googleOAuthAdapter.exchangeCodeForProfile({
                code: 'c',
                redirectUri: REDIRECT_URI,
            })
        ).resolves.toEqual({ ok: false, reason: 'token_exchange_failed' });
    });

    it('userinfo JSON 파싱 실패 시 profile_fetch_failed', async () => {
        const calls = [
            jsonResponse(200, { access_token: 'tok' }),
            new Response('not-json', { status: 200 }),
        ];
        global.fetch = vi.fn(async () => calls.shift()!) as never;
        await expect(
            googleOAuthAdapter.exchangeCodeForProfile({
                code: 'c',
                redirectUri: REDIRECT_URI,
            })
        ).resolves.toEqual({ ok: false, reason: 'profile_fetch_failed' });
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
        global.fetch = vi.fn(async () => calls.shift()!) as never;
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

    describe('Google 요청 자체가 실패할 때', () => {
        const networkError = new TypeError('fetch failed');

        beforeEach(() => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        /** 회귀: token 요청의 reject가 콜백 라우트까지 throw돼 500이 났다. */
        it('token 요청이 reject되면 token_exchange_failed를 반환한다', async () => {
            global.fetch = vi.fn(async () => {
                throw networkError;
            }) as never;
            await expect(
                googleOAuthAdapter.exchangeCodeForProfile({
                    code: 'c',
                    redirectUri: REDIRECT_URI,
                })
            ).resolves.toEqual({ ok: false, reason: 'token_exchange_failed' });
        });

        /** 회귀: userinfo 요청의 reject가 콜백 라우트까지 throw돼 500이 났다. */
        it('userinfo 요청이 reject되면 profile_fetch_failed를 반환한다', async () => {
            const fetchMock = vi
                .fn()
                .mockResolvedValueOnce(
                    jsonResponse(200, { access_token: 'tok' })
                )
                .mockRejectedValueOnce(networkError);
            global.fetch = fetchMock as never;
            await expect(
                googleOAuthAdapter.exchangeCodeForProfile({
                    code: 'c',
                    redirectUri: REDIRECT_URI,
                })
            ).resolves.toEqual({ ok: false, reason: 'profile_fetch_failed' });
        });

        it('실패 원인을 단계와 함께 로그로 남긴다', async () => {
            global.fetch = vi.fn(async () => {
                throw networkError;
            }) as never;
            await googleOAuthAdapter.exchangeCodeForProfile({
                code: 'c',
                redirectUri: REDIRECT_URI,
            });
            expect(console.error).toHaveBeenCalledWith(
                '[googleOAuthAdapter] token request failed:',
                networkError
            );
        });

        it('userinfo 비OK 응답은 상태 코드를 로그로 남기고 profile_fetch_failed를 반환한다', async () => {
            const calls = [
                jsonResponse(200, { access_token: 'tok' }),
                jsonResponse(401, { error: 'invalid_token' }),
            ];
            global.fetch = vi.fn(async () => calls.shift()!) as never;
            await expect(
                googleOAuthAdapter.exchangeCodeForProfile({
                    code: 'c',
                    redirectUri: REDIRECT_URI,
                })
            ).resolves.toEqual({ ok: false, reason: 'profile_fetch_failed' });
            expect(console.error).toHaveBeenCalledWith(
                '[googleOAuthAdapter] userinfo request failed with status 401'
            );
        });

        it('비OK 응답은 본문 없이 상태 코드만 로그로 남긴다', async () => {
            global.fetch = vi.fn(async () =>
                jsonResponse(400, { error: 'invalid_grant' })
            ) as never;
            await googleOAuthAdapter.exchangeCodeForProfile({
                code: 'c',
                redirectUri: REDIRECT_URI,
            });
            expect(console.error).toHaveBeenCalledWith(
                '[googleOAuthAdapter] token request failed with status 400'
            );
        });
    });

    describe('요청 타임아웃', () => {
        afterEach(() => {
            vi.restoreAllMocks();
        });

        /** 회귀: 응답이 멈춘 Google 요청이 undici 기본값(300초)까지 콜백을 붙잡았다. */
        it('token·userinfo 요청 모두 GOOGLE_REQUEST_TIMEOUT_MS signal을 싣는다', async () => {
            const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
            const calls = [
                jsonResponse(200, { access_token: 'tok' }),
                jsonResponse(200, { sub: 'gid', email: 'user@example.com' }),
            ];
            const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
                calls.shift()!
            );
            global.fetch = fetchMock as never;
            await googleOAuthAdapter.exchangeCodeForProfile({
                code: 'c',
                redirectUri: REDIRECT_URI,
            });
            expect(timeoutSpy.mock.calls).toEqual([
                [GOOGLE_REQUEST_TIMEOUT_MS],
                [GOOGLE_REQUEST_TIMEOUT_MS],
            ]);
            expect(fetchMock.mock.calls.map(([, init]) => init.signal)).toEqual(
                timeoutSpy.mock.results.map(r => r.value)
            );
        });
    });
});
