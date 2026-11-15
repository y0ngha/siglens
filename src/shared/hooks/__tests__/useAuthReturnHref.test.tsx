// @vitest-environment jsdom
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { renderHook } from '@testing-library/react';
import { useAuthReturnHref } from '@/shared/hooks/useAuthReturnHref';

const pathname = vi.hoisted(() => ({ value: '/AAPL' as string | null }));
vi.mock('next/navigation', () => ({
    usePathname: () => pathname.value,
}));

function Probe() {
    return createElement('a', { href: useAuthReturnHref('/signup') });
}

describe('useAuthReturnHref', () => {
    it('지금 보는 경로를 next로 실어 가입 뒤 그 페이지로 돌아오게 한다', () => {
        pathname.value = '/AAPL';
        const { result } = renderHook(() => useAuthReturnHref('/signup'));

        expect(result.current).toBe('/signup?next=%2FAAPL');
    });

    it('로그인 링크도 같은 방식으로 만든다', () => {
        pathname.value = '/005930.KS/news';
        const { result } = renderHook(() => useAuthReturnHref('/login'));

        expect(result.current).toBe('/login?next=%2F005930.KS%2Fnews');
    });

    it('로케일 접두사가 붙은 경로는 접두사째 싣는다', () => {
        pathname.value = '/en/AAPL';
        const { result } = renderHook(() => useAuthReturnHref('/signup'));

        expect(result.current).toBe('/signup?next=%2Fen%2FAAPL');
    });

    it.each(['/', '/en'])(
        '홈(%s)은 돌아갈 곳으로 치지 않아 next를 붙이지 않는다',
        home => {
            pathname.value = home;
            const { result } = renderHook(() => useAuthReturnHref('/signup'));

            expect(result.current).toBe('/signup');
        }
    );

    it.each([
        '/login',
        '/signup',
        '/signup/oauth/consent',
        '/en/login',
        '/reset-password',
    ])(
        '인증 화면(%s)은 돌아갈 곳으로 치지 않는다 — 가입 뒤 인증 화면으로 되돌아가지 않게',
        authPath => {
            pathname.value = authPath;
            const { result } = renderHook(() => useAuthReturnHref('/signup'));

            expect(result.current).toBe('/signup');
        }
    );

    describe('쿼리스트링', () => {
        afterEach(() => window.history.replaceState(null, '', '/'));

        it('URL 상태(쿼리·해시)도 next에 싣는다', () => {
            pathname.value = '/backtesting';
            window.history.replaceState(null, '', '/backtesting?tf=1Hour#top');
            const { result } = renderHook(() => useAuthReturnHref('/signup'));

            expect(result.current).toBe(
                `/signup?next=${encodeURIComponent('/backtesting?tf=1Hour#top')}`
            );
        });

        it('쿼리가 붙은 홈도 홈으로 판정한다', () => {
            pathname.value = '/en';
            window.history.replaceState(null, '', '/en?utm_source=x');
            const { result } = renderHook(() => useAuthReturnHref('/signup'));

            expect(result.current).toBe('/signup');
        });
    });

    it('경로를 알 수 없으면 next 없는 링크다', () => {
        pathname.value = null;
        const { result } = renderHook(() => useAuthReturnHref('/signup'));

        expect(result.current).toBe('/signup');
    });

    it('서버 렌더 HTML에는 next를 박지 않는다 — 종목마다 다른 가입 URL이 크롤러에 노출되지 않게', () => {
        pathname.value = '/AAPL';

        expect(renderToString(createElement(Probe))).toBe(
            '<a href="/signup"></a>'
        );
    });
});
