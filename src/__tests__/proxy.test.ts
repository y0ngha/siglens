jest.mock('@y0ngha/siglens-core', () => ({
    AUTH_SESSION_COOKIE_NAME: 'siglens_session',
}));
jest.mock('next/server', () => ({
    NextResponse: {
        redirect: jest.fn((url: URL, status?: number) => ({
            type: 'redirect',
            url,
            status,
        })),
        next: jest.fn(() => ({ type: 'next' })),
    },
}));

import { NextResponse, type NextRequest } from 'next/server';
import { proxy } from '../proxy';

const mockRedirect = NextResponse.redirect as jest.MockedFunction<
    typeof NextResponse.redirect
>;
const mockNext = NextResponse.next as jest.MockedFunction<
    typeof NextResponse.next
>;

function makeRequest(
    sessionValue: string | undefined,
    path = '/login'
): NextRequest {
    return {
        url: `https://example.com${path}`,
        cookies: {
            get: jest.fn((name: string) =>
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
        mockNext.mockClear();
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
                expect(mockNext).not.toHaveBeenCalled();
            }
        );

        it.each(guestOnlyPaths)(
            '%s — 세션이 없으면 next()로 통과시킨다',
            path => {
                proxy(makeRequest(undefined, path));
                expect(mockNext).toHaveBeenCalledTimes(1);
                expect(mockRedirect).not.toHaveBeenCalled();
            }
        );

        it('세션 값이 빈 문자열이면 next()로 통과시킨다', () => {
            proxy(makeRequest(''));
            expect(mockNext).toHaveBeenCalledTimes(1);
            expect(mockRedirect).not.toHaveBeenCalled();
        });
    });

    describe('전방 가드 — auth-required 경로', () => {
        const authRequiredPaths = ['/account', '/account/delete'];

        it.each(authRequiredPaths)(
            '%s — 세션이 없으면 /login 으로 redirect한다',
            path => {
                proxy(makeRequest(undefined, path));
                expect(mockRedirect).toHaveBeenCalledTimes(1);
                const calledUrl = mockRedirect.mock.calls[0]![0] as URL;
                expect(calledUrl.pathname).toBe('/login');
                expect(mockNext).not.toHaveBeenCalled();
            }
        );

        it.each(authRequiredPaths)(
            '%s — 세션이 있으면 next()로 통과시킨다',
            path => {
                proxy(makeRequest('valid-token', path));
                expect(mockNext).toHaveBeenCalledTimes(1);
                expect(mockRedirect).not.toHaveBeenCalled();
            }
        );
    });
});

describe('Ticker 케이스 정규화 — 소문자/혼합 케이스 → 대문자 301', () => {
    beforeEach(() => {
        mockRedirect.mockClear();
        mockNext.mockClear();
    });

    it.each([
        ['/aapl', '/AAPL'],
        ['/aapl/fundamental', '/AAPL/fundamental'],
        ['/Aapl/news', '/AAPL/news'],
        ['/tsla/overall', '/TSLA/overall'],
        ['/brk.b/fundamental', '/BRK.B/fundamental'],
    ])('%s → 301 → %s', (input, expectedPath) => {
        proxy(makeRequest(undefined, input));
        expect(mockRedirect).toHaveBeenCalledTimes(1);
        const [calledUrl, status] = mockRedirect.mock.calls[0]!;
        expect((calledUrl as URL).pathname).toBe(expectedPath);
        expect(status).toBe(301);
        expect(mockNext).not.toHaveBeenCalled();
    });

    it.each([
        '/AAPL',
        '/AAPL/fundamental',
        '/TSLA/overall',
        '/BRK.B/fundamental',
    ])('이미 대문자인 %s 는 redirect하지 않는다', path => {
        proxy(makeRequest(undefined, path));
        expect(mockRedirect).not.toHaveBeenCalled();
        expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it.each([
        '/login',
        '/signup',
        '/market',
        '/backtesting',
        '/terms',
        '/privacy',
        '/account',
    ])(
        'reserved 경로 %s 는 ticker로 오인하지 않는다 (no case redirect)',
        path => {
            proxy(makeRequest(undefined, path));
            if (path === '/account') {
                // auth-required guard: 비로그인 사용자는 /login 으로 redirect
                expect(mockRedirect).toHaveBeenCalledTimes(1);
                const [calledUrl] = mockRedirect.mock.calls[0]!;
                expect((calledUrl as URL).pathname).toBe('/login');
            } else {
                // guest-only 및 public 경로는 세션 없으면 next()로 통과
                expect(mockRedirect).not.toHaveBeenCalled();
            }
        }
    );
});
