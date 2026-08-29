import koMessages from '@/../messages/ko.json';
vi.mock('next/navigation', () => ({
    usePathname: vi.fn(() => '/AAPL'),
}));

vi.mock('next/link', () => ({
    default: ({
        href,
        children,
        ...rest
    }: {
        href: string;
        children: React.ReactNode;
        [key: string]: unknown;
    }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));

vi.mock('@/views/symbol/utils/symbolTabsConfig', () => ({
    TABS: [
        {
            key: 'chart',
            labelKey: 'chart',
            hrefBuilder: (s: string) => `/${s}`,
        },
        {
            key: 'news',
            labelKey: 'news',
            hrefBuilder: (s: string) => `/${s}/news`,
        },
        {
            key: 'fundamental',
            labelKey: 'fundamental',
            hrefBuilder: (s: string) => `/${s}/fundamental`,
        },
    ],
    tabsFor: (profile: string) => {
        const all = [
            {
                key: 'chart',
                labelKey: 'chart',
                hrefBuilder: (s: string) => `/${s}`,
            },
            {
                key: 'news',
                labelKey: 'news',
                hrefBuilder: (s: string) => `/${s}/news`,
            },
            {
                key: 'fundamental',
                labelKey: 'fundamental',
                hrefBuilder: (s: string) => `/${s}/fundamental`,
            },
        ];
        return profile === 'crypto'
            ? all.filter(t => ['chart', 'news'].includes(t.key))
            : all;
    },
}));

vi.mock('@/entities/ticker/hooks/useAssetInfo', () => ({
    useAssetInfo: vi.fn(),
}));

import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import { useAssetInfo } from '@/entities/ticker/hooks/useAssetInfo';
import { SymbolTabs } from '@/views/symbol/SymbolTabs';
import type { AssetInfo } from '@/shared/lib/types';

const EQUITY_ASSET: AssetInfo = { symbol: 'AAPL', name: 'Apple Inc.' };

describe('SymbolTabs', () => {
    beforeEach(() => {
        (usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/AAPL');
        // Default: resolved equity asset so most tests see the full tab bar.
        (useAssetInfo as ReturnType<typeof vi.fn>).mockReturnValue(
            EQUITY_ASSET
        );
    });

    it('renders a nav with accessible label', () => {
        render(<SymbolTabs symbol="aapl" />);
        const nav = screen.getByRole('navigation', { name: '분석 종류' });
        expect(nav).toBeDefined();
    });

    it('renders all tab links', () => {
        render(<SymbolTabs symbol="aapl" />);
        expect(
            screen.getByText(koMessages.shared.symbolTab.chart)
        ).toBeDefined();
        expect(
            screen.getByText(koMessages.shared.symbolTab.news)
        ).toBeDefined();
        expect(
            screen.getByText(koMessages.shared.symbolTab.fundamental)
        ).toBeDefined();
    });

    it('marks the active tab with aria-current="page"', () => {
        render(<SymbolTabs symbol="aapl" />);
        const chartLink = screen
            .getByText(koMessages.shared.symbolTab.chart)
            .closest('a')!;
        expect(chartLink.getAttribute('aria-current')).toBe('page');
    });

    it('does not mark inactive tabs with aria-current', () => {
        render(<SymbolTabs symbol="aapl" />);
        const newsLink = screen
            .getByText(koMessages.shared.symbolTab.news)
            .closest('a')!;
        expect(newsLink.getAttribute('aria-current')).toBeNull();
    });

    it('uppercases the symbol for href building', () => {
        render(<SymbolTabs symbol="aapl" />);
        const newsLink = screen
            .getByText(koMessages.shared.symbolTab.news)
            .closest('a')!;
        expect(newsLink.getAttribute('href')).toBe('/AAPL/news');
    });

    it('marks different tab as active based on pathname', () => {
        (usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/AAPL/news');

        render(<SymbolTabs symbol="aapl" />);
        const newsLink = screen
            .getByText(koMessages.shared.symbolTab.news)
            .closest('a')!;
        expect(newsLink.getAttribute('aria-current')).toBe('page');

        const chartLink = screen
            .getByText(koMessages.shared.symbolTab.chart)
            .closest('a')!;
        expect(chartLink.getAttribute('aria-current')).toBeNull();
    });

    it('renders a loading placeholder div when assetInfo is undefined (loading)', () => {
        (useAssetInfo as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
        const { container } = render(<SymbolTabs symbol="aapl" />);
        // No nav rendered while loading — placeholder div is shown instead.
        expect(screen.queryByRole('navigation')).toBeNull();
        const placeholder = container.querySelector(
            '.border-secondary-700.h-11.border-b'
        );
        expect(placeholder).not.toBeNull();
    });

    it('assetInfo가 null(미지 심볼)이면 us-equity 전체 탭 세트를 렌더한다 (로딩 placeholder 아님, 크립토 필터링 없음)', () => {
        // null = the query resolved but no matching asset found (unknown symbol).
        // SymbolTabs should fall back to DEFAULT_MARKET_PROFILE (us-equity)
        // and render the full tab set — not the loading placeholder, not a
        // crypto-filtered subset.
        (useAssetInfo as ReturnType<typeof vi.fn>).mockReturnValue(null);
        render(<SymbolTabs symbol="UNKNOWN" />);
        // The nav must be present (not the loading placeholder).
        expect(
            screen.getByRole('navigation', { name: '분석 종류' })
        ).toBeDefined();
        // Equity-only tabs must be present (they would be absent for crypto).
        expect(
            screen.getByText(koMessages.shared.symbolTab.fundamental)
        ).toBeDefined();
        // Crypto-shared tabs are also present.
        expect(
            screen.getByText(koMessages.shared.symbolTab.chart)
        ).toBeDefined();
        expect(
            screen.getByText(koMessages.shared.symbolTab.news)
        ).toBeDefined();
    });
});

describe('SymbolTabs — 로케일 접두사', () => {
    /**
     * 탭 href는 접두사가 없는 `/AAPL/news` 형태다. 접두사가 붙은 경로로 비교하면
     * en/ja/zh 사용자에게 활성 탭 표시와 `aria-current`가 통째로 꺼진다
     * (시각·a11y 회귀라 에러 없이 조용히 지나간다).
     */
    it.each([
        ['/en/AAPL', '차트'],
        ['/ja/AAPL/news', '뉴스'],
    ])('%s에서도 활성 탭을 표시한다', (pathname, label) => {
        (usePathname as ReturnType<typeof vi.fn>).mockReturnValue(pathname);
        render(<SymbolTabs symbol="AAPL" />);
        expect(
            screen.getByRole('link', { name: label, current: 'page' })
        ).toBeInTheDocument();
    });
});

/**
 * 활성 탭이 레일 밖에 있으면 안으로 끌어온다.
 *
 * 탭이 9개라 모바일 폭에서 레일이 넘친다 — 실측(500px 뷰포트): `scrollWidth`
 * 653, 활성 `position` 탭 x=581, `scrollLeft` 0으로 화면 밖이었다. 그 라우트로
 * 직접 진입하면 자기가 어느 탭에 있는지 눈으로 알 수 없다.
 *
 * jsdom에는 레이아웃이 없어 `offsetLeft`/`offsetWidth`/`clientWidth`가 전부 0이다.
 * 그대로 두면 "이미 보인다"로 판정돼 **어떤 구현이든 통과**하므로, 실측 좌표를
 * 스텁해 조건을 만든다.
 */
describe('활성 탭 스크롤', () => {
    /**
     * jsdom에는 레이아웃이 없다. `clientWidth`/`offsetLeft`가 0인 것은 물론이고,
     * **`scrollLeft` 세터가 아무 일도 하지 않고 항상 0을 반환한다** — 그대로
     * 두면 구현이 무엇을 하든 단언이 0으로 통과하거나 실패한다. 값을 실제로
     * 보관하는 접근자로 갈아끼워야 이 테스트가 동작을 본다.
     */
    function stubRail(rail: HTMLElement, railWidth: number) {
        let scrollLeft = 0;
        Object.defineProperty(rail, 'scrollLeft', {
            configurable: true,
            get: () => scrollLeft,
            set: (v: number) => {
                scrollLeft = v;
            },
        });
        Object.defineProperty(rail, 'clientWidth', {
            configurable: true,
            value: railWidth,
        });
    }

    function stubTab(el: HTMLElement, left: number, width: number) {
        Object.defineProperty(el, 'offsetLeft', {
            configurable: true,
            value: left,
        });
        Object.defineProperty(el, 'offsetWidth', {
            configurable: true,
            value: width,
        });
    }

    it('오른쪽으로 벗어난 활성 탭을 레일 안으로 끌어온다', () => {
        (usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/AAPL');
        const { container, rerender } = render(<SymbolTabs symbol="AAPL" />);

        const rail = container.querySelector('nav') as HTMLElement;
        const target = container.querySelector(
            'a[href="/AAPL/news"]'
        ) as HTMLElement;
        expect(rail).not.toBeNull();
        expect(target).not.toBeNull();

        stubRail(rail, 500);
        // 실측 좌표(500px 뷰포트에서 마지막 탭): x=581, 폭 72.
        stubTab(target, 581, 72);

        (usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/AAPL/news');
        rerender(<SymbolTabs symbol="AAPL" />);

        // 581 + 72 - 500 = 153
        expect(rail.scrollLeft).toBe(153);
    });

    it('이미 보이는 활성 탭은 건드리지 않는다 — 사용자가 맞춘 위치를 빼앗지 않는다', () => {
        (usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/AAPL');
        const { container, rerender } = render(<SymbolTabs symbol="AAPL" />);

        const rail = container.querySelector('nav') as HTMLElement;
        const target = container.querySelector(
            'a[href="/AAPL/news"]'
        ) as HTMLElement;

        stubRail(rail, 500);
        stubTab(target, 10, 60);
        rail.scrollLeft = 0;

        (usePathname as ReturnType<typeof vi.fn>).mockReturnValue('/AAPL/news');
        rerender(<SymbolTabs symbol="AAPL" />);

        expect(rail.scrollLeft).toBe(0);
    });
});
