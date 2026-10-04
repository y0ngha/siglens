import { fireEvent, render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import {
    NavigationPendingProvider,
    useNavigationPending,
} from '@/shared/model/NavigationPendingContext';
import { RoutePendingSlot } from '../RoutePendingSlot';

vi.mock('next/navigation', () => ({
    usePathname: vi.fn(() => '/market'),
}));
// 종목 골격은 `[symbol]` 레이아웃 조각을 끌어온다. 여기서는 "어느 골격을 고르는가"만 본다.
vi.mock('@/app/[locale]/[symbol]/SymbolEntrySkeleton', () => ({
    SymbolEntrySkeleton: () => <div data-testid="symbol-entry-skeleton" />,
}));

const mockPathname = usePathname as ReturnType<typeof vi.fn>;

function Go({ to }: { to: string }) {
    const { startNavigation } = useNavigationPending();
    return <button onClick={() => startNavigation(to)}>{to}</button>;
}

function Tree({ targets }: { targets: string[] }) {
    return (
        <NavigationPendingProvider>
            {targets.map(to => (
                <Go key={to} to={to} />
            ))}
            <RoutePendingSlot>
                <p>current page</p>
            </RoutePendingSlot>
        </NavigationPendingProvider>
    );
}

const skeletonKind = (container: HTMLElement) =>
    container
        .querySelector<HTMLElement>('[data-route-skeleton]')
        ?.getAttribute('data-route-skeleton') ?? null;

describe('RoutePendingSlot', () => {
    beforeEach(() => {
        mockPathname.mockReturnValue('/market');
        vi.stubGlobal('scrollTo', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('평소에는 페이지를 그대로 보여준다 — 직접 접속·SSR에 관여하지 않는다', () => {
        const { container } = render(<Tree targets={['/news']} />);

        expect(skeletonKind(container)).toBeNull();
        expect(container.querySelector('[data-route-pending]')).toBeNull();
        expect(screen.getByText('current page').parentElement?.className).toBe(
            'contents'
        );
    });

    it.each([
        ['/news', 'news'],
        ['/economy/kr', 'economy'],
        ['/fear-greed', 'fearGreed'],
        ['/about', 'article'],
        ['/privacy', 'legal'],
        ['/', 'home'],
        ['/lp/unknown', 'generic'],
    ])(
        '%s로 가는 순간 %s 골격으로 바꾸고 떠나온 페이지는 숨긴다',
        (to, kind) => {
            const { container } = render(<Tree targets={[to]} />);

            fireEvent.click(screen.getByRole('button', { name: to }));

            expect(skeletonKind(container)).toBe(kind);
            expect(
                screen.getByText('current page').parentElement?.className
            ).toBe('hidden');
        }
    );

    it('종목으로 가는 이동은 종목 골격을 쓴다', () => {
        const { container } = render(<Tree targets={['/AAPL']} />);

        fireEvent.click(screen.getByRole('button', { name: '/AAPL' }));

        expect(screen.getByTestId('symbol-entry-skeleton')).toBeInTheDocument();
        expect(skeletonKind(container)).toBeNull();
    });

    it('게스트가 로그인 필요 페이지를 누르면 도착할 로그인 화면의 골격을 그린다', () => {
        const { container } = render(<Tree targets={['/portfolio']} />);

        fireEvent.click(screen.getByRole('button', { name: '/portfolio' }));

        expect(skeletonKind(container)).toBe('auth');
    });

    it('떠나는 중임을 표식으로 남긴다 — 포털로 뜬 시트를 CSS가 감춘다', () => {
        const { container } = render(<Tree targets={['/news']} />);

        fireEvent.click(screen.getByRole('button', { name: '/news' }));

        expect(container.querySelector('[data-route-pending]')).not.toBeNull();
    });

    it('같은 종목의 탭 이동에는 나서지 않는다', () => {
        mockPathname.mockReturnValue('/AAPL');
        const { container } = render(<Tree targets={['/AAPL/news']} />);

        fireEvent.click(screen.getByRole('button', { name: '/AAPL/news' }));

        expect(container.querySelector('[data-route-pending]')).toBeNull();
        expect(screen.getByText('current page').parentElement?.className).toBe(
            'contents'
        );
    });

    it('도착하면 골격을 걷는다', () => {
        const { container, rerender } = render(<Tree targets={['/news']} />);
        fireEvent.click(screen.getByRole('button', { name: '/news' }));

        mockPathname.mockReturnValue('/news');
        rerender(<Tree targets={['/news']} />);

        expect(skeletonKind(container)).toBeNull();
    });
});
