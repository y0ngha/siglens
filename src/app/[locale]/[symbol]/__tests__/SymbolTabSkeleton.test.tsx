import { render, screen } from '@testing-library/react';
import { SymbolTabSkeleton } from '../SymbolTabSkeleton';

const pendingTab = vi.fn<() => string | null>();

vi.mock('@/views/symbol/SymbolTabPendingContext', () => ({
    usePendingSymbolTab: () => pendingTab(),
}));
vi.mock('@/views/symbol/skeletons/ChartTabSkeleton', () => ({
    ChartTabSkeleton: () => <div data-testid="chart-loading" />,
}));
vi.mock('@/views/symbol/skeletons/OptionsTabSkeleton', () => ({
    OptionsTabSkeleton: () => <div data-testid="options-loading" />,
}));

const sectionCount = (container: HTMLElement) =>
    container.querySelectorAll('[data-symbol-tab-skeleton] > *').length;

describe('SymbolTabSkeleton', () => {
    it.each([
        ['/AAPL/overall', 'overall', 3],
        ['/AAPL/news', 'news', 5],
        ['/AAPL/fundamental', 'fundamental', 6],
        ['/AAPL/financials', 'financials', 4],
        ['/AAPL/congress', 'congress', 4],
        ['/AAPL/fear-greed', 'fear-greed', 4],
        ['/AAPL/position', 'position', 3],
    ])(
        '%s로 가는 중이면 %s 탭 모양(섹션 %i개)을 그린다',
        (href, tab, count) => {
            pendingTab.mockReturnValue(href);
            const { container } = render(<SymbolTabSkeleton />);

            expect(
                container
                    .querySelector('[data-symbol-tab-skeleton]')
                    ?.getAttribute('data-symbol-tab-skeleton')
            ).toBe(tab);
            expect(sectionCount(container)).toBe(count);
        }
    );

    it('옵션 탭은 옵션 페이지를 본뜬 골격을 쓴다', () => {
        pendingTab.mockReturnValue('/AAPL/options');
        render(<SymbolTabSkeleton />);
        expect(screen.getByTestId('options-loading')).toBeInTheDocument();
    });

    it.each(['/AAPL', '/AAPL/unknown-tab', null])(
        '%s: 차트 탭이거나 모르는 탭이면 차트 로딩 화면을 쓴다',
        href => {
            pendingTab.mockReturnValue(href);
            render(<SymbolTabSkeleton />);
            expect(screen.getByTestId('chart-loading')).toBeInTheDocument();
        }
    );

    it('프로토타입 키를 탭으로 오인하지 않는다', () => {
        pendingTab.mockReturnValue('/AAPL/constructor');
        render(<SymbolTabSkeleton />);
        expect(screen.getByTestId('chart-loading')).toBeInTheDocument();
    });
});
