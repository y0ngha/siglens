import {
    GOOGLE_REQUEST_TIMEOUT_MS,
    googleOAuthAdapter,
} from '@/features/auth-oauth/lib/google';
import { jsonResponse } from '@/shared/test-utils/jsonResponse';

/** 전역 fetch를 대체하고 호출 검사용 mock을 돌려준다. 복원은 `vi.unstubAllGlobals()`가 맡는다. */
function stubFetch(
    impl: (url: string, init: RequestInit) => Promise<Response> = async () =>
        jsonResponse(500, {})
) {
    const fetchMock = vi.fn(impl);
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

describe('googleOAuthAdapter', () => {
    const REDIRECT_URI = 'https://app.example.com/api/auth/callback/google';

    beforeEach(() => {
        process.env.GOOGLE_CLIENT_ID = 'gclient';
        process.env.GOOGLE_CLIENT_SECRET = 'gsecret';
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('GOOGLE_CLIENT_ID/SECRET 미설정 시 빈 문자열로 빌드된다', async () => {
        delete process.env.GOOGLE_CLIENT_ID;
        delete process.env.GOOGLE_CLIENT_SECRET;
        const url = googleOAuthAdapter.authorizeUrl({
            state: 's',
            redirectUri: REDIRECT_URI,
        });
        expect(new URL(url).searchParams.get('client_id')).toBe('');
        stubFetch(async () => jsonResponse(400, {}));
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
        stubFetch(async () => jsonResponse(400, {}));
        await expect(
            googleOAuthAdapter.exchangeCodeForProfile({
                code: 'c',
                redirectUri: REDIRECT_URI,
            })
        ).resolves.toEqual({ ok: false, reason: 'token_exchange_failed' });
    });

    it('access_token이 누락되면 token_exchange_failed', async () => {
        stubFetch(async () => jsonResponse(200, {}));
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
        stubFetch(async () => calls.shift()!);
        await expect(
            googleOAuthAdapter.exchangeCodeForProfile({
                code: 'c',
                redirectUri: REDIRECT_URI,
            })
        ).resolves.toEqual({ ok: false, reason: 'profile_fetch_failed' });
    });

    it('access_token이 문자열이 아니면 token_exchange_failed', async () => {
        stubFetch(async () => jsonResponse(200, { access_token: 123 }));
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
        stubFetch(async () => calls.shift()!);
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
        stubFetch(async () => calls.shift()!);
        await expect(
            googleOAuthAdapter.exchangeCodeForProfile({
                code: 'c',
                redirectUri: REDIRECT_URI,
            })
        ).resolves.toEqual({ ok: false, reason: 'email_missing' });
    });

    it('token JSON 파싱 실패 시 token_exchange_failed', async () => {
        stubFetch(async () => new Response('not-json', { status: 200 }));
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
        stubFetch(async () => calls.shift()!);
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
        stubFetch(async () => calls.shift()!);
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

        // 콜백 라우트는 어댑터에서 throw된 오류를 받지 않는다. reject는 결과 값으로 바뀐다.
        it('token 요청이 reject되면 token_exchange_failed를 반환한다', async () => {
            stubFetch(async () => {
                throw networkError;
            });
            await expect(
                googleOAuthAdapter.exchangeCodeForProfile({
                    code: 'c',
                    redirectUri: REDIRECT_URI,
                })
            ).resolves.toEqual({ ok: false, reason: 'token_exchange_failed' });
        });

        it('userinfo 요청이 reject되면 profile_fetch_failed를 반환한다', async () => {
            stubFetch()
                .mockResolvedValueOnce(
                    jsonResponse(200, { access_token: 'tok' })
                )
                .mockRejectedValueOnce(networkError);
            await expect(
                googleOAuthAdapter.exchangeCodeForProfile({
                    code: 'c',
                    redirectUri: REDIRECT_URI,
                })
            ).resolves.toEqual({ ok: false, reason: 'profile_fetch_failed' });
            expect(console.error).toHaveBeenCalledWith(
                '[googleOAuthAdapter] userinfo request failed:',
                networkError
            );
        });

        it('실패 원인을 단계와 함께 로그로 남긴다', async () => {
            stubFetch(async () => {
                throw networkError;
            });
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
            stubFetch(async () => calls.shift()!);
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
            stubFetch(async () =>
                jsonResponse(400, { error: 'invalid_grant' })
            );
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

        // 모든 Google 요청은 제한 시간 signal을 실어 멈춘 연결이 콜백을 붙잡지 못한다.
        it('token·userinfo 요청 모두 GOOGLE_REQUEST_TIMEOUT_MS signal을 싣는다', async () => {
            const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
            const calls = [
                jsonResponse(200, { access_token: 'tok' }),
                jsonResponse(200, { sub: 'gid', email: 'user@example.com' }),
            ];
            const fetchMock = stubFetch(async () => calls.shift()!);
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
