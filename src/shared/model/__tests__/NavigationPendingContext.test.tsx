import { act, fireEvent, render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import {
    NavigationPendingProvider,
    useNavigationPending,
    usePendingRouteEntry,
} from '@/shared/model/NavigationPendingContext';
import { AUTH_HINT_COOKIE_NAME } from '@/shared/config/cookieNames';

vi.mock('next/navigation', () => ({
    usePathname: vi.fn(() => '/market'),
}));

const mockPathname = usePathname as ReturnType<typeof vi.fn>;

const TARGETS = {
    aapl: '/ja/AAPL?tf=1Day',
    'aapl-news': '/ja/AAPL/news',
    msft: '/ja/MSFT',
    news: '/ja/news',
    same: '/ja/market?x=1',
    login: '/ja/login',
    portfolio: '/ja/portfolio',
} as const;

function Probe() {
    const { pendingHref, startNavigation } = useNavigationPending();
    const entry = usePendingRouteEntry();
    return (
        <>
            <span data-testid="pending">{pendingHref ?? 'none'}</span>
            <span data-testid="entry">{entry ?? 'none'}</span>
            {Object.entries(TARGETS).map(([name, href]) => (
                <button key={name} onClick={() => startNavigation(href)}>
                    {name}
                </button>
            ))}
        </>
    );
}

function Tree() {
    return (
        <NavigationPendingProvider>
            <Probe />
        </NavigationPendingProvider>
    );
}

const click = (name: keyof typeof TARGETS) =>
    fireEvent.click(screen.getByRole('button', { name }));
const pending = () => screen.getByTestId('pending').textContent;
const entry = () => screen.getByTestId('entry').textContent;

function setAuthHint(on: boolean) {
    document.cookie = on
        ? `${AUTH_HINT_COOKIE_NAME}=1; path=/`
        : `${AUTH_HINT_COOKIE_NAME}=; path=/; max-age=0`;
}

describe('NavigationPendingContext', () => {
    const scrollTo = vi.fn();

    beforeEach(() => {
        mockPathname.mockReturnValue('/ja/market');
        setAuthHint(false);
        scrollTo.mockClear();
        vi.stubGlobal('scrollTo', scrollTo);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it('starts idle — direct loads and SSR never see a pending state', () => {
        render(<Tree />);
        expect(pending()).toBe('none');
        expect(entry()).toBe('none');
    });

    describe('when a link to another route is clicked', () => {
        it('marks the destination pending before the RSC arrives', () => {
            render(<Tree />);

            click('aapl');

            expect(pending()).toBe('/AAPL');
            expect(entry()).toBe('/AAPL');
        });

        it('covers non-symbol routes too', () => {
            render(<Tree />);

            click('news');

            expect(entry()).toBe('/news');
        });

        it('scrolls to the top so the skeleton is in view', () => {
            render(<Tree />);

            click('news');

            expect(scrollTo).toHaveBeenCalledWith(0, 0);
        });

        it('clears once the route commits', () => {
            const { rerender } = render(<Tree />);
            click('aapl');

            mockPathname.mockReturnValue('/ja/AAPL');
            rerender(<Tree />);

            expect(pending()).toBe('none');
        });

        it('clears on back navigation (popstate)', () => {
            render(<Tree />);
            click('aapl');

            act(() => {
                window.dispatchEvent(new PopStateEvent('popstate'));
            });

            expect(pending()).toBe('none');
        });

        it('ignores a query-only change of the current path (it could never clear)', () => {
            render(<Tree />);

            click('same');

            expect(pending()).toBe('none');
        });

        /**
         * /market에서 /news를 누르고, 도착 전에 /market으로 가는 링크를 누른 경우.
         * 라우터는 앞선 이동을 버리고 제자리에 남으므로 경로가 영영 안 바뀐다 —
         * 여기서 풀지 않으면 /news 골격이 타임아웃(10s)까지 화면을 덮는다.
         */
        it('a click back to the current path drops the earlier pending navigation', () => {
            render(<Tree />);
            click('news');
            expect(pending()).toBe('/news');

            click('same');

            expect(pending()).toBe('none');
        });
    });

    describe('moving between tabs of the same symbol', () => {
        beforeEach(() => {
            mockPathname.mockReturnValue('/ja/AAPL');
        });

        it('is pending but not a root-slot entry — the symbol layout owns it', () => {
            render(<Tree />);

            click('aapl-news');

            expect(pending()).toBe('/AAPL/news');
            expect(entry()).toBe('none');
            expect(scrollTo).not.toHaveBeenCalled();
        });

        it('going to a different symbol is a root-slot entry', () => {
            render(<Tree />);

            click('msft');

            expect(entry()).toBe('/MSFT');
        });
    });

    /**
     * 프록시 인증 가드는 이동을 다른 경로로 돌려보낸다. 클릭한 경로를 그대로 pending으로
     * 세우면 (1) 엉뚱한 골격이 뜨고 (2) 지금 경로로 되돌아오는 이동은 경로가 안 바뀌어
     * 영영 풀리지 않는다.
     */
    describe('auth-guarded destinations', () => {
        it('a guest heading to /portfolio is pending on the login page', () => {
            render(<Tree />);

            click('portfolio');

            expect(pending()).toBe('/login');
        });

        it('a member heading to /portfolio is pending on /portfolio', () => {
            setAuthHint(true);
            render(<Tree />);

            click('portfolio');

            expect(pending()).toBe('/portfolio');
        });

        it('a member on the home page clicking /login stays idle — the guard sends them back here', () => {
            setAuthHint(true);
            mockPathname.mockReturnValue('/ja');
            render(<Tree />);

            click('login');

            expect(pending()).toBe('none');
        });

        it('a guest already on /login clicking /portfolio stays idle', () => {
            mockPathname.mockReturnValue('/ja/login');
            render(<Tree />);

            click('portfolio');

            expect(pending()).toBe('none');
        });
    });

    it('gives up after the timeout when the path never changes', () => {
        vi.useFakeTimers();
        render(<Tree />);
        click('news');
        expect(pending()).toBe('/news');

        act(() => {
            vi.advanceTimersByTime(9_999);
        });
        expect(pending()).toBe('/news');

        act(() => {
            vi.advanceTimersByTime(1);
        });
        expect(pending()).toBe('none');
    });

    it('restores the scroll position it took away when it gives up', () => {
        vi.useFakeTimers();
        vi.stubGlobal('scrollY', 1840);
        render(<Tree />);
        click('news');
        expect(scrollTo).toHaveBeenLastCalledWith(0, 0);

        act(() => {
            vi.advanceTimersByTime(10_000);
        });

        expect(scrollTo).toHaveBeenLastCalledWith(0, 1840);
    });

    it('does not touch scroll on a timed-out tab move — it never scrolled', () => {
        vi.useFakeTimers();
        mockPathname.mockReturnValue('/ja/AAPL');
        render(<Tree />);
        click('aapl-news');

        act(() => {
            vi.advanceTimersByTime(10_000);
        });

        expect(pending()).toBe('none');
        expect(scrollTo).not.toHaveBeenCalled();
    });
});
