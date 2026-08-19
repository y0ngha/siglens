import type { MockedFunction } from 'vitest';
// proxy.ts는 @/shared/config/cookieNames에서 AUTH_SESSION_COOKIE_NAME을 import한다.
// edge runtime 안전성을 위해 entities barrel 대신 shared 순수 상수 파일 사용.
vi.mock('@/shared/config/cookieNames', () => ({
    AUTH_SESSION_COOKIE_NAME: 'siglens_session',
}));
// 가드를 통과한 요청은 `NextResponse.next()`가 아니라 next-intl 미들웨어로 넘어간다.
// 통과 여부를 관측하려면 그 미들웨어를 mock해야 한다.
const { mockIntlMiddleware } = vi.hoisted(() => ({
    mockIntlMiddleware: vi.fn(() => ({ type: 'intl' })),
}));
vi.mock('next-intl/middleware', () => ({
    default: () => mockIntlMiddleware,
}));
vi.mock('next/server', () => ({
    NextResponse: {
        redirect: vi.fn((url: URL, status?: number) => ({
            type: 'redirect',
            url,
            status,
        })),
        next: vi.fn(() => ({ type: 'next' })),
    },
}));

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { NextResponse, type NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { LOCALES } from '@/shared/i18n/locales';

const mockRedirect = NextResponse.redirect as MockedFunction<
    typeof NextResponse.redirect
>;
/** 가드를 통과해 next-intl로 위임됐는지를 보는 관측점. */
const mockPass = mockIntlMiddleware;

function makeRequest(
    sessionValue: string | undefined,
    path = '/login'
): NextRequest {
    return {
        url: `https://example.com${path}`,
        cookies: {
            get: vi.fn((name: string) =>
                name === 'siglens_session' && sessionValue !== undefined
                    ? { value: sessionValue }
                    : undefined
            ),
        },
    } as unknown as NextRequest;
}

describe('proxy', () => {
    beforeEach(() => {
        mockRedirect.mockClear();
        mockPass.mockClear();
    });

    describe('역방향 가드 — guest-only 경로', () => {
        const guestOnlyPaths = [
            '/login',
            '/signup',
            '/forgot-password',
            '/reset-password',
        ];

        it.each(guestOnlyPaths)(
            '%s — 세션이 있으면 / 로 redirect한다',
            path => {
                proxy(makeRequest('valid-token', path));
                expect(mockRedirect).toHaveBeenCalledTimes(1);
                const calledUrl = mockRedirect.mock.calls[0]![0] as URL;
                expect(calledUrl.pathname).toBe('/');
                expect(mockPass).not.toHaveBeenCalled();
            }
        );

        it.each(guestOnlyPaths)(
            '%s — 세션이 없으면 next()로 통과시킨다',
            path => {
                proxy(makeRequest(undefined, path));
                expect(mockPass).toHaveBeenCalledTimes(1);
                expect(mockRedirect).not.toHaveBeenCalled();
            }
        );

        it('세션 값이 빈 문자열이면 next()로 통과시킨다', () => {
            proxy(makeRequest(''));
            expect(mockPass).toHaveBeenCalledTimes(1);
            expect(mockRedirect).not.toHaveBeenCalled();
        });
    });

    describe('전방 가드 — auth-required 경로', () => {
        const authRequiredPaths = ['/account', '/account/delete', '/portfolio'];

        it.each(authRequiredPaths)(
            '%s — 세션이 없으면 /login?next=%s 으로 redirect한다(복귀 경로 보존)',
            path => {
                proxy(makeRequest(undefined, path));
                expect(mockRedirect).toHaveBeenCalledTimes(1);
                const calledUrl = mockRedirect.mock.calls[0]![0] as URL;
                expect(calledUrl.pathname).toBe('/login');
                expect(calledUrl.searchParams.get('next')).toBe(path);
                expect(mockPass).not.toHaveBeenCalled();
            }
        );

        it.each(authRequiredPaths)(
            '%s — 세션이 있으면 next()로 통과시킨다',
            path => {
                proxy(makeRequest('valid-token', path));
                expect(mockPass).toHaveBeenCalledTimes(1);
                expect(mockRedirect).not.toHaveBeenCalled();
            }
        );
    });
});

describe('Ticker 케이스 정규화 — 소문자/혼합 케이스 → 대문자 301', () => {
    beforeEach(() => {
        mockRedirect.mockClear();
        mockPass.mockClear();
    });

    it.each([
        ['/aapl', '/AAPL'],
        ['/aapl/fundamental', '/AAPL/fundamental'],
        ['/Aapl/news', '/AAPL/news'],
        ['/tsla/overall', '/TSLA/overall'],
        ['/brk.b/fundamental', '/BRK.B/fundamental'],
        // SYMBOL_EDGE_RE 호환 — 하이픈 ticker(PBR-A)와 6+ 글자 ticker도 정규화
        ['/pbr-a', '/PBR-A'],
        ['/abcdef/news', '/ABCDEF/news'],
        // 구 TICKER_RE 경계(8자) 초과해도 크립토 지원으로 이제 정규화
        ['/abcdefgh', '/ABCDEFGH'],
        ['/abcdefgh/options', '/ABCDEFGH/options'],
        ['/abcdefghi', '/ABCDEFGHI'], // 9자 — SYMBOL_EDGE_RE 허용(크립토 지원)
        // 숫자 포함 크립토 심볼 정규화
        ['/btcusd', '/BTCUSD'],
        ['/1btcusd', '/1BTCUSD'],
    ])('%s → 301 → %s', (input, expectedPath) => {
        proxy(makeRequest(undefined, input));
        expect(mockRedirect).toHaveBeenCalledTimes(1);
        const [calledUrl, status] = mockRedirect.mock.calls[0]!;
        expect((calledUrl as URL).pathname).toBe(expectedPath);
        expect(status).toBe(301);
        expect(mockPass).not.toHaveBeenCalled();
    });

    it.each([
        '/AAPL',
        '/AAPL/fundamental',
        '/TSLA/overall',
        '/BRK.B/fundamental',
        '/ABCDEFGH', // 8자 boundary, 이미 대문자
    ])('이미 대문자인 %s 는 redirect하지 않는다', path => {
        proxy(makeRequest(undefined, path));
        expect(mockRedirect).not.toHaveBeenCalled();
        expect(mockPass).toHaveBeenCalledTimes(1);
    });

    // SYMBOL_EDGE_RE 형상을 벗어나는 입력은 ticker로 인정되지 않아 정규화 redirect가 발생하지 않는다.
    // 언더스코어, 특수문자, 17자 초과는 여전히 거부된다. 숫자 포함·9자 ticker는 크립토 지원으로
    // 이제 허용 (1000SATSUSD, 1-UPUSD 등)되므로 더 이상 거부 케이스가 아님.
    it.each([
        '/abc_de', // 언더스코어 — SYMBOL_EDGE_RE는 점/하이픈만 허용
        '/abcdefghijklmnopq', // 17자 초과
    ])('SYMBOL_EDGE_RE 형상 위반 %s 는 정규화 redirect하지 않는다', path => {
        proxy(makeRequest(undefined, path));
        expect(mockRedirect).not.toHaveBeenCalled();
        expect(mockPass).toHaveBeenCalledTimes(1);
    });

    it('/economy는 대문자화 redirect 대상에서 제외된다', () => {
        proxy(makeRequest(undefined, '/economy'));
        expect(mockRedirect).not.toHaveBeenCalled();
        expect(mockPass).toHaveBeenCalledTimes(1);
    });

    it.each([
        '/login',
        '/signup',
        '/economy',
        '/market',
        '/backtesting',
        '/terms',
        '/privacy',
        '/account',
        '/news',
        '/onboarding',
        '/portfolio',
        '/share',
    ])(
        'reserved 경로 %s 는 ticker로 오인하지 않는다 (no case redirect)',
        path => {
            proxy(makeRequest(undefined, path));
            if (path === '/account' || path === '/portfolio') {
                // auth-required guard: 비로그인 사용자는 /login?next=<path> 으로 redirect
                expect(mockRedirect).toHaveBeenCalledTimes(1);
                const [calledUrl] = mockRedirect.mock.calls[0]!;
                expect((calledUrl as URL).pathname).toBe('/login');
                expect((calledUrl as URL).searchParams.get('next')).toBe(path);
            } else {
                // guest-only 및 public 경로는 세션 없으면 next()로 통과
                expect(mockRedirect).not.toHaveBeenCalled();
            }
        }
    );
});

describe('/share 라우트 — base64url id 대문자화 방지 회귀 테스트', () => {
    beforeEach(() => {
        mockRedirect.mockClear();
        mockPass.mockClear();
    });

    it.each([
        '/share/SomeMixedCaseId123',
        '/share/abc123XYZ',
        '/share/ALLUPPERCASE',
        '/share/alllowercase',
        '/share/aB3dEf',
    ])('%s 는 대문자 redirect 없이 next()로 통과한다', path => {
        proxy(makeRequest(undefined, path));
        expect(mockRedirect).not.toHaveBeenCalled();
        expect(mockPass).toHaveBeenCalledTimes(1);
    });
});

describe('/news 라우트 — ticker 오인 방지 회귀 테스트', () => {
    beforeEach(() => {
        mockRedirect.mockClear();
        mockPass.mockClear();
    });

    it.each([
        '/news',
        '/news/crypto',
        '/news/general',
        '/news/stock',
        '/news/forex',
        '/news/articles',
    ])('%s 는 대문자 redirect 없이 next()로 통과한다', path => {
        proxy(makeRequest(undefined, path));
        expect(mockRedirect).not.toHaveBeenCalled();
        expect(mockPass).toHaveBeenCalledTimes(1);
    });
});

describe('/onboarding 라우트 — ticker 오인으로 인한 /ONBOARDING 404 방지 회귀 테스트', () => {
    beforeEach(() => {
        mockRedirect.mockClear();
        mockPass.mockClear();
    });

    // 회귀: onboarding이 RESERVED_FIRST_SEGMENTS에서 누락되면 SYMBOL_EDGE_RE(전체
    // 알파벳, 16자 이하)에 매칭돼 /ONBOARDING으로 301 정규화되고, 이는 존재하지 않는
    // 라우트라 [symbol] fallback → 404로 이어진다 (실제 페이지의 auth guard는 우회당함).
    it('세션이 없어도 /ONBOARDING으로 대문자 redirect하지 않는다', () => {
        proxy(makeRequest(undefined, '/onboarding'));
        expect(mockRedirect).not.toHaveBeenCalled();
        expect(mockPass).toHaveBeenCalledTimes(1);
    });

    it('세션이 있어도 /ONBOARDING으로 대문자 redirect하지 않는다', () => {
        proxy(makeRequest('valid-token', '/onboarding'));
        expect(mockRedirect).not.toHaveBeenCalled();
        expect(mockPass).toHaveBeenCalledTimes(1);
    });
});

describe('/portfolio 라우트 — ticker 오인으로 인한 /PORTFOLIO 404 방지 회귀 테스트', () => {
    beforeEach(() => {
        mockRedirect.mockClear();
        mockPass.mockClear();
    });

    // 회귀: portfolio가 RESERVED_FIRST_SEGMENTS에서 누락되면 SYMBOL_EDGE_RE(전체
    // 알파벳, 16자 이하)에 매칭돼 /PORTFOLIO으로 301 정규화되고, 이는 존재하지 않는
    // 라우트라 [symbol] fallback → 404로 이어진다 (실제 페이지의 auth guard는 우회당함,
    // /onboarding 사고와 동일 패턴).
    it('세션이 없으면 대문자 redirect 없이 /login?next=/portfolio 으로 auth-required redirect한다', () => {
        proxy(makeRequest(undefined, '/portfolio'));
        expect(mockRedirect).toHaveBeenCalledTimes(1);
        const [calledUrl] = mockRedirect.mock.calls[0]!;
        expect((calledUrl as URL).pathname).toBe('/login');
        expect((calledUrl as URL).searchParams.get('next')).toBe('/portfolio');
        expect(mockPass).not.toHaveBeenCalled();
    });

    it('세션이 있으면 /PORTFOLIO으로 대문자 redirect하지 않고 next()로 통과한다', () => {
        proxy(makeRequest('valid-token', '/portfolio'));
        expect(mockRedirect).not.toHaveBeenCalled();
        expect(mockPass).toHaveBeenCalledTimes(1);
    });
});

describe('랜딩 ?q= redirect — proxy가 page.tsx 대신 처리 (ISR 보존)', () => {
    beforeEach(() => {
        mockRedirect.mockClear();
        mockPass.mockClear();
    });

    it.each([
        ['/?q=AAPL', '/AAPL'],
        ['/?q=aapl', '/AAPL'],
        ['/?q=tsla', '/TSLA'],
        ['/?q=BRK.B', '/BRK.B'],
        ['/?q=%20AAPL%20', '/AAPL'], // trim 검증
    ])('%s → %s 로 redirect', (input, expectedPath) => {
        proxy(makeRequest(undefined, input));
        expect(mockRedirect).toHaveBeenCalledTimes(1);
        const [calledUrl] = mockRedirect.mock.calls[0]!;
        expect((calledUrl as URL).pathname).toBe(expectedPath);
        expect(mockPass).not.toHaveBeenCalled();
    });

    it('동일 키 중복 ?q=AAPL&q=TSLA — 첫 번째 값 AAPL로 redirect', () => {
        proxy(makeRequest(undefined, '/?q=AAPL&q=TSLA'));
        expect(mockRedirect).toHaveBeenCalledTimes(1);
        const [calledUrl] = mockRedirect.mock.calls[0]!;
        expect((calledUrl as URL).pathname).toBe('/AAPL');
    });

    it.each([
        '/?q=', // 빈 쿼리
        '/?q=ABC_DEF', // 언더스코어 포함 — SYMBOL_EDGE_RE 거부
        '/?q=TOOLONGTICKERSYMBOLX', // 17자 초과 — SYMBOL_EDGE_RE 거부
    ])('유효하지 않은 ticker %s 는 fall through (next())', input => {
        proxy(makeRequest(undefined, input));
        expect(mockRedirect).not.toHaveBeenCalled();
        expect(mockPass).toHaveBeenCalledTimes(1);
    });

    it('?q=가 없는 / 는 fall through (next())', () => {
        proxy(makeRequest(undefined, '/'));
        expect(mockRedirect).not.toHaveBeenCalled();
        expect(mockPass).toHaveBeenCalledTimes(1);
    });

    it('루트가 아닌 /market?q=AAPL 는 redirect하지 않는다', () => {
        proxy(makeRequest(undefined, '/market?q=AAPL'));
        expect(mockRedirect).not.toHaveBeenCalled();
        expect(mockPass).toHaveBeenCalledTimes(1);
    });
});

/**
 * `/fear-greed` 회귀 가드.
 *
 * `isAdmissibleSymbolShape`은 하이픈 ticker(`PBR-A`)를 허용하므로, 하이픈이 든
 * 최상위 라우트명은 `RESERVED_FIRST_SEGMENTS`에 없으면 심볼로 오인되어 대문자
 * 경로로 301된다. App Router는 정적 세그먼트를 우선하므로 빌드 산출물만 봐서는
 * 정상으로 보이고, 프록시가 라우팅보다 먼저 도는 런타임에서만 깨진다 — 실제로
 * `/fear-greed`가 `/FEAR-GREED`로 301되는 것을 로컬 프로덕션 서버에서 잡았다.
 *
 * auth 가드가 걸린 라우트(`/account`, `/portfolio`)는 정상적으로 `/login`으로
 * redirect되므로 "redirect 없음"이 아니라 "대문자 정규화 redirect 없음"을 단언한다.
 */
describe('정적 최상위 라우트는 ticker로 오인되지 않는다', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // page/route 파일이 있는 디렉터리만 라우트다 — `src/app/fonts`처럼 asset만
    // 담은 디렉터리는 진입점이 없어 예약할 필요가 없다.
    // 라우트는 전부 `[locale]` 아래로 이동했다. 여기가 아니라 `src/app`을 보면
    // 목록이 비어 가드가 조용히 무력화된다.
    const APP_DIR = join(process.cwd(), 'src/app/[locale]');
    const ROUTE_ENTRY_FILES = ['page.tsx', 'page.ts', 'route.ts', 'route.tsx'];

    const staticTopLevelRoutes = readdirSync(APP_DIR, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .filter(name => !name.startsWith('[') && !name.startsWith('_'))
        .filter(name =>
            ROUTE_ENTRY_FILES.some(file =>
                existsSync(join(APP_DIR, name, file))
            )
        );

    it('src/app/[locale] 하위 라우트 디렉터리를 실제로 찾아낸다', () => {
        // 목록이 비면 아래 it.each가 통째로 사라져 가드가 조용히 무력화된다.
        expect(staticTopLevelRoutes).toContain('fear-greed');
        expect(staticTopLevelRoutes.length).toBeGreaterThan(5);
    });

    it.each(staticTopLevelRoutes)(
        '/%s 는 대문자 경로로 301되지 않는다',
        route => {
            proxy(makeRequest(undefined, `/${route}`));

            const uppercased = mockRedirect.mock.calls.filter(
                ([url]) => (url as URL).pathname === `/${route.toUpperCase()}`
            );
            expect(uppercased).toEqual([]);
        }
    );

    /**
     * 로케일 접두사 회귀 가드.
     *
     * `isAdmissibleSymbolShape('en')`은 참이다. 예약 목록에 없으면 `/en`이
     * `/EN`으로 301된다. `ko`는 더 나쁘다 — `/KO`(코카콜라)는 실존 티커라
     * 404조차 나지 않고 조용히 엉뚱한 페이지가 뜬다.
     */
    it.each(LOCALES)('/%s 는 티커로 오인되지 않는다', locale => {
        proxy(makeRequest(undefined, `/${locale}`));

        const uppercased = mockRedirect.mock.calls.filter(
            ([url]) => (url as URL).pathname === `/${locale.toUpperCase()}`
        );
        expect(uppercased).toEqual([]);
    });
});

/**
 * 로케일 접두사가 붙은 경로도 로케일 없는 경로와 **같은 가드**를 받아야 한다.
 * 판정을 접두사 포함 경로로 하면 `/en/login`이 게스트 전용 규칙을 통째로 비껴간다.
 */
describe('로케일 접두사 경로', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('/en/login — 세션이 있으면 /en 으로 redirect한다', () => {
        proxy(makeRequest('valid-token', '/en/login'));
        expect(mockRedirect).toHaveBeenCalledTimes(1);
        expect((mockRedirect.mock.calls[0]![0] as URL).pathname).toBe('/en');
    });

    it('/ja/portfolio — 비로그인이면 /ja/login 으로 보내고 next를 보존한다', () => {
        proxy(makeRequest(undefined, '/ja/portfolio'));
        const url = mockRedirect.mock.calls[0]![0] as URL;
        expect(url.pathname).toBe('/ja/login');
        expect(url.searchParams.get('next')).toBe('/ja/portfolio');
    });

    it('/en/aapl — 로케일을 유지한 채 대문자로 301한다', () => {
        proxy(makeRequest(undefined, '/en/aapl'));
        expect(mockRedirect).toHaveBeenCalledWith(
            expect.objectContaining({ pathname: '/en/AAPL' }),
            301
        );
    });

    it('/en?q=AAPL — 로케일을 유지한 채 종목으로 보낸다', () => {
        proxy(makeRequest(undefined, '/en?q=AAPL'));
        expect((mockRedirect.mock.calls[0]![0] as URL).pathname).toBe(
            '/en/AAPL'
        );
    });

    it('/ko/AAPL — 기본 로케일 접두사는 티커 판정에서 제외된다', () => {
        proxy(makeRequest(undefined, '/ko/AAPL'));
        // `/KO`로의 오인 301이 없어야 한다. 접두사 제거는 next-intl이 맡는다.
        expect(mockRedirect).not.toHaveBeenCalled();
        expect(mockPass).toHaveBeenCalledTimes(1);
    });
});
