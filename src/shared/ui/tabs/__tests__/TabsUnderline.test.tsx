import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabsUnderline } from '@/shared/ui/tabs/TabsUnderline';

const tabs = [
    { value: 'overview', label: 'Overview' },
    { value: 'chart', label: 'Chart' },
    { value: 'news', label: 'News' },
] as const;

describe('TabsUnderline', () => {
    it('renders a tablist with all tabs', () => {
        render(
            <TabsUnderline
                tabs={tabs}
                activeTab="overview"
                onChange={vi.fn()}
                ariaLabel="Navigation"
                size="xs"
            />
        );
        expect(screen.getByRole('tablist')).toBeInTheDocument();
        expect(screen.getAllByRole('tab')).toHaveLength(3);
    });

    it('sets aria-label on the tablist', () => {
        render(
            <TabsUnderline
                tabs={tabs}
                activeTab="overview"
                onChange={vi.fn()}
                ariaLabel="Navigation"
                size="xs"
            />
        );
        expect(screen.getByRole('tablist')).toHaveAttribute(
            'aria-label',
            'Navigation'
        );
    });

    it('marks the active tab as selected', () => {
        render(
            <TabsUnderline
                tabs={tabs}
                activeTab="chart"
                onChange={vi.fn()}
                ariaLabel="Navigation"
                size="sm"
            />
        );
        expect(screen.getByText('Chart')).toHaveAttribute(
            'aria-selected',
            'true'
        );
        expect(screen.getByText('Overview')).toHaveAttribute(
            'aria-selected',
            'false'
        );
    });

    it('calls onChange when clicking a tab', async () => {
        const handleChange = vi.fn();
        const user = userEvent.setup();
        render(
            <TabsUnderline
                tabs={tabs}
                activeTab="overview"
                onChange={handleChange}
                ariaLabel="Navigation"
                size="xs"
            />
        );
        await user.click(screen.getByText('News'));
        expect(handleChange).toHaveBeenCalledWith('news');
    });

    it('renders with xs size', () => {
        render(
            <TabsUnderline
                tabs={tabs}
                activeTab="overview"
                onChange={vi.fn()}
                ariaLabel="Navigation"
                size="xs"
            />
        );
        // xs size wraps buttons in an inner div
        const tablist = screen.getByRole('tablist');
        expect(tablist.querySelector('div')).toBeInTheDocument();
    });

    it('renders with sm size (no inner wrapper)', () => {
        render(
            <TabsUnderline
                tabs={tabs}
                activeTab="overview"
                onChange={vi.fn()}
                ariaLabel="Navigation"
                size="sm"
            />
        );
        // sm size renders buttons directly in the tablist
        const tablist = screen.getByRole('tablist');
        const buttons = tablist.querySelectorAll('button');
        expect(buttons).toHaveLength(3);
    });
});

/**
 * 활성 탭을 스크롤 뷰로 끌어오는 effect(`useTabs`)의 회귀 가드.
 *
 * 이 effect는 세 번 다시 쓰였고 두 번 틀렸는데, 그동안 테스트가 한 줄도 없어서
 * 지우거나 되돌려도 전 스위트가 초록이었다. 실제로 났던 두 결함을 각각 고정한다:
 *
 *  1. `scrollIntoView`를 쓰면 `block: 'nearest'`가 "세로로 스크롤하지 말라"가
 *     아니라 "보이게 만드는 최소량만큼 스크롤하라"라서 **페이지가 통째로 튄다**
 *     (실측: 섹터 탭 클릭에 0 → 240px). 뷰포트를 건드리는 API 호출 자체를 막는다.
 *  2. 첫 탭으로 돌아올 때 델타 계산만 하면 좌측 패딩이 스크롤에 먹힌 상태가
 *     "이미 보임"으로 판정돼 탭 줄이 형제 섹션과 어긋난 채 남는다. 첫 탭은
 *     `scrollLeft = 0`으로 되돌려야 한다.
 *
 * jsdom의 `scrollLeft`는 레이아웃이 없어 값이 항상 0이라 **값을 단언하면 무조건
 * 통과한다**. setter를 가로채 "무엇을 쓰려 했는지"를 본다.
 */
describe('TabsUnderline — 활성 탭 스크롤', () => {
    function setup(activeTab: string) {
        const writes: number[] = [];
        const view = render(
            <TabsUnderline
                tabs={tabs}
                activeTab={activeTab}
                onChange={vi.fn()}
                ariaLabel="Navigation"
                size="xs"
            />
        );
        const tablist = screen.getByRole('tablist');
        Object.defineProperty(tablist, 'scrollLeft', {
            configurable: true,
            get: () => 0,
            set: (v: number) => writes.push(v),
        });
        return { view, tablist, writes };
    }

    it('뷰포트를 움직이는 API를 호출하지 않는다', () => {
        /* jsdom에는 `scrollIntoView`가 아예 없어 `vi.spyOn`이 던진다.
           있든 없든 통하도록 직접 심고 끝나면 되돌린다. */
        const proto = Element.prototype as unknown as Record<string, unknown>;
        const original = {
            scrollIntoView: proto.scrollIntoView,
            elementScrollTo: proto.scrollTo,
            windowScrollTo: window.scrollTo,
        };
        const scrollIntoView = vi.fn();
        const elementScrollTo = vi.fn();
        const windowScrollTo = vi.fn();
        proto.scrollIntoView = scrollIntoView;
        proto.scrollTo = elementScrollTo;
        window.scrollTo = windowScrollTo as unknown as typeof window.scrollTo;

        try {
            const { view } = setup('overview');
            view.rerender(
                <TabsUnderline
                    tabs={tabs}
                    activeTab="news"
                    onChange={vi.fn()}
                    ariaLabel="Navigation"
                    size="xs"
                />
            );

            expect(scrollIntoView).not.toHaveBeenCalled();
            expect(elementScrollTo).not.toHaveBeenCalled();
            expect(windowScrollTo).not.toHaveBeenCalled();
        } finally {
            proto.scrollIntoView = original.scrollIntoView;
            proto.scrollTo = original.elementScrollTo;
            window.scrollTo = original.windowScrollTo;
        }
    });

    it('첫 탭으로 돌아오면 스크롤을 0으로 되돌린다(거터 복원)', () => {
        const { view, writes } = setup('news');
        writes.length = 0;

        view.rerender(
            <TabsUnderline
                tabs={tabs}
                activeTab="overview"
                onChange={vi.fn()}
                ariaLabel="Navigation"
                size="xs"
            />
        );

        expect(writes).toContain(0);
    });
});
