import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
    type MockedFunction,
} from 'vitest';

vi.mock('@/shared/config/cookieNames', () => ({
    AUTH_SESSION_COOKIE_NAME: 'siglens_session',
    GUEST_ID_COOKIE_NAME: 'siglens_guest',
}));
const { mockIntlMiddleware } = vi.hoisted(() => ({
    mockIntlMiddleware: vi.fn(() => ({ type: 'intl' })),
}));
vi.mock('next-intl/middleware', () => ({ default: () => mockIntlMiddleware }));
vi.mock('next/server', () => {
    class FakeResponse {
        headers = new Headers();
        cookies = { set: vi.fn() };
        constructor(
            public body: string,
            init?: { headers?: Record<string, string> }
        ) {
            for (const [k, v] of Object.entries(init?.headers ?? {}))
                this.headers.set(k, v);
        }
    }
    return {
        NextResponse: Object.assign(FakeResponse, {
            redirect: vi.fn((url: URL, status?: number) => ({
                type: 'redirect',
                url,
                status,
                headers: new Headers(),
            })),
            next: vi.fn(() => ({ type: 'next', headers: new Headers() })),
            rewrite: vi.fn((url: URL) => ({
                type: 'rewrite',
                url,
                headers: new Headers(),
                cookies: { set: vi.fn() },
            })),
        }),
    };
});

import { NextResponse, type NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { signGuestId } from '@/shared/config/guestCookie';

const mockRedirect = NextResponse.redirect as MockedFunction<
    typeof NextResponse.redirect
>;
const mockRewrite = NextResponse.rewrite as MockedFunction<
    typeof NextResponse.rewrite
>;
const mockNext = NextResponse.next as MockedFunction<typeof NextResponse.next>;

const VALID_UUID = '11111111-1111-1111-1111-111111111111';
const OTHER_UUID = '22222222-2222-2222-2222-222222222222';

function makeRequest(
    host: string,
    path: string,
    cookieValues: Record<string, string> = {}
): NextRequest {
    return {
        url: `https://${host}${path}`,
        headers: new Headers({ host }),
        cookies: {
            get: (name: string) =>
                name in cookieValues
                    ? { name, value: cookieValues[name] }
                    : undefined,
        },
    } as unknown as NextRequest;
}

describe('proxy — ai host', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('OAUTH_STATE_HMAC_SECRET', 'a'.repeat(32));
    });

    it('루트를 /ai/{locale}로 rewrite하고 CSP를 붙인다 — 랜딩은 색인 대상이라 noindex 헤더 없음', async () => {
        const res = (await proxy(
            makeRequest('ai.siglens.io', '/')
        )) as unknown as {
            headers: Headers;
        };
        expect(mockRewrite).toHaveBeenCalledTimes(1);
        expect((mockRewrite.mock.calls[0]![0] as URL).pathname).toBe('/ai/ko');
        // 미들웨어 CSP가 next.config의 `frame-ancestors 'none'`을 완전히 대체하므로
        // 두 지시문을 여기서 함께 실어야 한다.
        expect(res.headers.get('content-security-policy')).toBe(
            "frame-ancestors 'none'; img-src 'self' data: https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://pagead2.googlesyndication.com https://www.google.com https://www.google.co.kr"
        );
        expect(res.headers.get('x-robots-tag')).toBeNull();
    });
    type CookieSetter = MockedFunction<
        (name: string, value: string, options: Record<string, unknown>) => void
    >;

    it('첫 페이지 뷰 — 게스트·세션 쿠키가 모두 없으면 서명된 게스트 쿠키를 심는다', async () => {
        const res = (await proxy(
            makeRequest('ai.siglens.io', '/')
        )) as unknown as {
            cookies: { set: CookieSetter };
        };
        expect(res.cookies.set).toHaveBeenCalledTimes(1);
        const [name, value, options] = res.cookies.set.mock.calls[0]!;
        expect(name).toBe('siglens_guest');
        expect(value).toMatch(/^[0-9a-f-]{36}\.[\w-]+$/);
        expect(options).toMatchObject({ httpOnly: true, sameSite: 'lax' });
    });
    it('유효하게 서명된 게스트 쿠키가 이미 있으면 새로 심지 않는다', async () => {
        const signed = await signGuestId(VALID_UUID);
        const res = (await proxy(
            makeRequest('ai.siglens.io', '/', { siglens_guest: signed })
        )) as unknown as { cookies: { set: CookieSetter } };
        expect(res.cookies.set).not.toHaveBeenCalled();
    });
    it('변조된(형식이 아닌) 게스트 쿠키는 새로 발급해 대체한다', async () => {
        const res = (await proxy(
            makeRequest('ai.siglens.io', '/', { siglens_guest: 'not-a-uuid' })
        )) as unknown as { cookies: { set: CookieSetter } };
        expect(res.cookies.set).toHaveBeenCalledTimes(1);
    });
    it('서명 없는(레거시) 게스트 쿠키는 새로 발급해 대체한다', async () => {
        const res = (await proxy(
            makeRequest('ai.siglens.io', '/', { siglens_guest: VALID_UUID })
        )) as unknown as { cookies: { set: CookieSetter } };
        expect(res.cookies.set).toHaveBeenCalledTimes(1);
    });
    it('다른 uuid의 서명을 붙인 위조 쿠키는 새로 발급해 대체한다', async () => {
        const forged = `${OTHER_UUID}.${(await signGuestId(VALID_UUID)).split('.')[1]}`;
        const res = (await proxy(
            makeRequest('ai.siglens.io', '/', { siglens_guest: forged })
        )) as unknown as { cookies: { set: CookieSetter } };
        expect(res.cookies.set).toHaveBeenCalledTimes(1);
    });
    /**
     * 회귀 가드: `siglens_session` 쿠키는 존재만 확인 가능할 뿐 여기서 DB로
     * 유효성을 검증하지 않는데, 스트림 라우트는 `getCurrentUser()`로 세션을 DB째
     * 검증한다. 죽은 세션 쿠키를 가진 방문자를 "회원이니 게스트 쿠키 불필요"로
     * 건너뛰면 그 방문자는 회원도 게스트도 아닌 신원 미확정 상태로 스트림 라우트에서
     * 영구 401을 받는다 — 세션 쿠키 존재 여부와 무관하게 유효한 게스트 쿠키가
     * 없으면 항상 심어야 한다.
     */
    it('세션 쿠키가 있어도 유효한 게스트 쿠키가 없으면 게스트 쿠키를 심는다', async () => {
        const res = (await proxy(
            makeRequest('ai.siglens.io', '/', { siglens_session: 's' })
        )) as unknown as { cookies: { set: CookieSetter } };
        expect(res.cookies.set).toHaveBeenCalledTimes(1);
        const [name] = res.cookies.set.mock.calls[0]!;
        expect(name).toBe('siglens_guest');
    });
    it('세션 쿠키와 유효한 게스트 쿠키가 모두 있으면 새로 심지 않는다', async () => {
        const signed = await signGuestId(VALID_UUID);
        const res = (await proxy(
            makeRequest('ai.siglens.io', '/', {
                siglens_session: 's',
                siglens_guest: signed,
            })
        )) as unknown as { cookies: { set: CookieSetter } };
        expect(res.cookies.set).not.toHaveBeenCalled();
    });
    it('robots.txt 응답에는 게스트 쿠키를 심지 않는다', async () => {
        const res = (await proxy(
            makeRequest('ai.siglens.io', '/robots.txt')
        )) as unknown as { cookies: { set: CookieSetter } };
        expect(res.cookies.set).not.toHaveBeenCalled();
    });

    it.each(['/c/abc', '/en/c/abc'])(
        '%s — 대화는 사적 기록이라 X-Robots-Tag noindex',
        async path => {
            const res = (await proxy(
                makeRequest('ai.siglens.io', path)
            )) as unknown as {
                headers: Headers;
            };
            expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
        }
    );
    it('로케일 접두 경로 유지', async () => {
        await proxy(makeRequest('ai.siglens.io', '/en/c/abc'));
        expect(mockRewrite).toHaveBeenCalledTimes(1);
        expect((mockRewrite.mock.calls[0]![0] as URL).pathname).toBe(
            '/ai/en/c/abc'
        );
    });
    it('dev 호스트 ai.localhost:3000', async () => {
        await proxy(makeRequest('ai.localhost:3000', '/'));
        expect(mockRewrite).toHaveBeenCalledTimes(1);
        expect((mockRewrite.mock.calls[0]![0] as URL).pathname).toBe('/ai/ko');
    });
    it('robots.txt — 랜딩은 열고 대화(/c/)는 막고, sitemap을 가리킨다', async () => {
        const res = (await proxy(
            makeRequest('ai.siglens.io', '/robots.txt')
        )) as unknown as { body: string };
        expect(res.body).toBe(
            'User-agent: *\nAllow: /\nDisallow: /c/\nDisallow: /*/c/\nDisallow: /api/\n\nSitemap: https://ai.siglens.io/sitemap.xml\n'
        );
        expect(mockRewrite).not.toHaveBeenCalled();
    });
    it('sitemap.xml — 색인 가능한 로케일의 홈과 /about만, 대화 URL 없음', async () => {
        const res = (await proxy(
            makeRequest('ai.siglens.io', '/sitemap.xml')
        )) as unknown as { body: string; headers: Headers };
        expect(res.headers.get('content-type')).toMatch(/application\/xml/);
        expect(res.body).toContain('<loc>https://ai.siglens.io/</loc>');
        expect(res.body).toContain('<loc>https://ai.siglens.io/about</loc>');
        expect(res.body).not.toContain('/c/');
        expect(mockRewrite).not.toHaveBeenCalled();
    });
    it('메인 호스트 sitemap.xml은 next() — ai 전용 응답이 새지 않는다', async () => {
        await proxy(makeRequest('siglens.io', '/sitemap.xml'));
        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(mockIntlMiddleware).not.toHaveBeenCalled();
    });
    it('메인 호스트 robots.txt는 next()', async () => {
        await proxy(makeRequest('siglens.io', '/robots.txt'));
        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(mockIntlMiddleware).not.toHaveBeenCalled();
    });
    it('메인 호스트 /ai/* → ai 호스트 301', async () => {
        await proxy(makeRequest('siglens.io', '/ai/ko/c/abc'));
        expect(mockRedirect).toHaveBeenCalledTimes(1);
        const [url, status] = mockRedirect.mock.calls[0]!;
        expect((url as URL).toString()).toBe('https://ai.siglens.io/ko/c/abc');
        expect(status).toBe(301);
    });

    /**
     * `AI`는 실존 티커(C3.ai, popular-tickers·sitemap 등재)다. `/ai` 판정은
     * 정확한 소문자 전체 세그먼트일 때만 걸려야 하고, 대소문자 무시로 판정하면
     * `/AI`·`/AI/news`·`/en/AI`가 전부 SiglensAI 호스트로 오탐 리다이렉트된다
     * (로케일과 철자가 같은 티커를 구제하는 `KO` 판정과 동일한 원칙).
     */
    it.each(['/AI', '/AI/news', '/en/AI'])(
        '%s — 실존 티커라 ai 호스트로 redirect하지 않는다',
        async path => {
            await proxy(makeRequest('siglens.io', path));
            expect(mockRedirect).not.toHaveBeenCalled();
        }
    );

    it('/Ai — 혼합 케이스 티커는 여전히 /AI로 대문자 정규화된다', async () => {
        await proxy(makeRequest('siglens.io', '/Ai'));
        expect(mockRedirect).toHaveBeenCalledTimes(1);
        const [url, status] = mockRedirect.mock.calls[0]!;
        expect((url as URL).pathname).toBe('/AI');
        expect(status).toBe(301);
    });

    /** `rest='//evil.com'` → 기본 로케일은 접두사가 없어 외부 호스트가 되던 경로. */
    it('/ai//evil.com — 외부 호스트가 아니라 ai 호스트로 redirect한다', async () => {
        await proxy(makeRequest('siglens.io', '/ai//evil.com'));
        expect(mockRedirect).toHaveBeenCalledTimes(1);
        const [url] = mockRedirect.mock.calls[0]!;
        expect((url as URL).host).toBe('ai.siglens.io');
        expect((url as URL).toString()).toBe('https://ai.siglens.io/evil.com');
    });

    it('/ai?x=1 — 쿼리스트링을 보존한 채 ai 호스트로 redirect한다', async () => {
        await proxy(makeRequest('siglens.io', '/ai?x=1'));
        expect(mockRedirect).toHaveBeenCalledTimes(1);
        const [url] = mockRedirect.mock.calls[0]!;
        expect((url as URL).toString()).toBe('https://ai.siglens.io/?x=1');
    });

    it('/en/ai/x — 로케일 접두사를 유지한 채 ai 호스트로 redirect한다', async () => {
        await proxy(makeRequest('siglens.io', '/en/ai/x'));
        expect(mockRedirect).toHaveBeenCalledTimes(1);
        const [url] = mockRedirect.mock.calls[0]!;
        expect((url as URL).toString()).toBe('https://ai.siglens.io/en/x');
    });

    it('/ko/ai/c/x — 기본 로케일 접두사 제거와 한 홉에 끝난다 (2홉 아님)', async () => {
        await proxy(makeRequest('siglens.io', '/ko/ai/c/x'));
        expect(mockRedirect).toHaveBeenCalledTimes(1);
        const [url, status] = mockRedirect.mock.calls[0]!;
        expect((url as URL).toString()).toBe('https://ai.siglens.io/c/x');
        expect(status).toBe(301);
    });

    it('서명 시크릿이 없으면 게스트 쿠키를 심지 않고도 페이지는 정상 렌더한다', async () => {
        vi.stubEnv('OAUTH_STATE_HMAC_SECRET', '');
        const consoleErrorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        try {
            const res = (await proxy(
                makeRequest('ai.siglens.io', '/')
            )) as unknown as {
                headers: Headers;
                cookies: { set: CookieSetter };
            };
            expect(res.cookies.set).not.toHaveBeenCalled();
            expect(mockRewrite).toHaveBeenCalledTimes(1);
            expect(consoleErrorSpy).toHaveBeenCalled();
        } finally {
            consoleErrorSpy.mockRestore();
        }
    });
});
