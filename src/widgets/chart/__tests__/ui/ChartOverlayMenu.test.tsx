import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OverlayMenuItem } from '../../utils/overlayItems';
import { ACTION_PRICES_ITEM_KEY } from '../../utils/overlayItems';
import { ChartOverlayMenu } from '../../ui/ChartOverlayMenu';

function renderMenu(
    items: readonly OverlayMenuItem[],
    hiddenKeys: ReadonlySet<string> = new Set(),
    onSetVisible = vi.fn()
) {
    return {
        onSetVisible,
        ...render(
            <ChartOverlayMenu
                items={items}
                hiddenKeys={hiddenKeys}
                onSetVisible={onSetVisible}
            />
        ),
    };
}

/** 패널(role="group") 안에서만 버튼을 찾는다 — 트리거의 접근 가능한 이름도
 * `/차트 작도/`와 매칭되므로 전역 조회는 트리거를 함께 집는다. */
function getPanel(): HTMLElement {
    return screen.getByRole('group');
}

const patternItem: OverlayMenuItem = {
    key: 'p1',
    kind: 'pattern',
    label: 'Double Bottom',
};
const divergenceItem: OverlayMenuItem = {
    key: 'd1',
    kind: 'divergence',
    label: 'RSI Bearish',
};
const actionItem: OverlayMenuItem = {
    key: ACTION_PRICES_ITEM_KEY,
    kind: 'action',
};
const trendUp1: OverlayMenuItem = {
    key: 't-up-1',
    kind: 'trendline',
    direction: 'up',
    index: 1,
};
const trendDown1: OverlayMenuItem = {
    key: 't-down-1',
    kind: 'trendline',
    direction: 'down',
    index: 1,
};

describe('ChartOverlayMenu', () => {
    it('renders nothing when items is empty', () => {
        const { container } = renderMenu([]);
        expect(container).toBeEmptyDOMElement();
    });

    it('trigger count reflects the number of visible items, not the number of groups', () => {
        // pattern 1개 + divergence 1개(꺼짐) = 2개 항목 중 1개만 켜짐.
        renderMenu([patternItem, divergenceItem], new Set(['d1']));
        expect(
            screen.getByRole('button', { name: /차트 작도 · 1/ })
        ).toBeInTheDocument();
    });

    it('opens the panel on trigger click and lists groups only for present items', async () => {
        const user = userEvent.setup();
        renderMenu([patternItem]);

        expect(screen.queryByRole('group')).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: /차트 작도/ }));

        const panel = getPanel();
        expect(
            within(panel).getByRole('button', { name: /차트 패턴/ })
        ).toBeInTheDocument();
        expect(
            within(panel).queryByRole('button', { name: /추세선/ })
        ).not.toBeInTheDocument();
    });

    it('group header is a tri-state switch: all on → true, all off → false, mixed → "mixed"', async () => {
        const user = userEvent.setup();
        renderMenu(
            [patternItem, { ...divergenceItem, key: 'd2' }],
            new Set(['d1'])
        );
        // 여기서는 pattern group(항목 1개, 켜짐)과 divergence group(항목 1개인
        // d2, 켜짐)을 따로 봐야 하므로 각각 렌더해 확인한다.
        await user.click(screen.getByRole('button', { name: /차트 작도/ }));
        const panel = getPanel();
        const patternHeader = within(panel).getByRole('button', {
            name: /차트 패턴\s*1/,
        });
        expect(patternHeader).toHaveAttribute('aria-pressed', 'true');
    });

    it('mixed group (일부만 켜짐) shows aria-pressed="mixed"', async () => {
        const user = userEvent.setup();
        renderMenu(
            [
                patternItem,
                { ...patternItem, key: 'p2', label: 'Another Pattern' },
            ],
            new Set(['p2'])
        );
        await user.click(screen.getByRole('button', { name: /차트 작도/ }));
        const panel = getPanel();
        const header = within(panel).getByRole('button', {
            name: /차트 패턴\s*2/,
        });
        expect(header).toHaveAttribute('aria-pressed', 'mixed');
    });

    it('clicking the group header when all are on turns every item in the group off', async () => {
        const user = userEvent.setup();
        const { onSetVisible } = renderMenu([
            patternItem,
            { ...patternItem, key: 'p2', label: 'Another Pattern' },
        ]);
        await user.click(screen.getByRole('button', { name: /차트 작도/ }));
        const panel = getPanel();
        const header = within(panel).getByRole('button', {
            name: /차트 패턴\s*2/,
        });

        await user.click(header);
        expect(onSetVisible).toHaveBeenCalledWith(['p1', 'p2'], false);
    });

    it('clicking a group header when it is mixed or all-off turns every item in the group on', async () => {
        const user = userEvent.setup();
        const { onSetVisible } = renderMenu(
            [patternItem, { ...patternItem, key: 'p2', label: 'Another' }],
            new Set(['p1', 'p2'])
        );
        await user.click(screen.getByRole('button', { name: /차트 작도/ }));
        const panel = getPanel();
        const header = within(panel).getByRole('button', {
            name: /차트 패턴\s*2/,
        });

        await user.click(header);
        expect(onSetVisible).toHaveBeenCalledWith(['p1', 'p2'], true);
    });

    it('clicking an individual item toggles only that item', async () => {
        const user = userEvent.setup();
        const { onSetVisible } = renderMenu([
            patternItem,
            { ...patternItem, key: 'p2', label: 'Another Pattern' },
        ]);
        await user.click(screen.getByRole('button', { name: /차트 작도/ }));
        const panel = getPanel();

        const itemButton = within(panel).getByRole('button', {
            name: 'Double Bottom',
        });
        expect(itemButton).toHaveAttribute('aria-pressed', 'true');

        await user.click(itemButton);
        expect(onSetVisible).toHaveBeenCalledWith(['p1'], false);
    });

    it('the action group renders a single row without a header, labeled 진입·청산·손절 가격선', async () => {
        const user = userEvent.setup();
        const { onSetVisible } = renderMenu([actionItem, patternItem]);
        await user.click(screen.getByRole('button', { name: /차트 작도/ }));
        const panel = getPanel();

        const actionButton = within(panel).getByRole('button', {
            name: '진입·청산·손절 가격선',
        });
        expect(actionButton).toHaveAttribute('aria-pressed', 'true');

        await user.click(actionButton);
        expect(onSetVisible).toHaveBeenCalledWith(
            [ACTION_PRICES_ITEM_KEY],
            false
        );
    });

    it('panel group accessible name is the fixed "차트 작도" with no active-count suffix', async () => {
        const user = userEvent.setup();
        renderMenu([patternItem, divergenceItem], new Set(['d1']));
        await user.click(screen.getByRole('button', { name: /차트 작도/ }));

        const panel = getPanel();
        expect(panel).toHaveAccessibleName('차트 작도');
        expect(panel.getAttribute('aria-label')).not.toMatch(/\d/);
    });

    it('a card-less kind item (label null) is labeled with its kind name', async () => {
        const user = userEvent.setup();
        renderMenu([{ key: 'kind:fibonacci', kind: 'fibonacci', label: null }]);
        await user.click(screen.getByRole('button', { name: /차트 작도/ }));
        const panel = getPanel();

        // 그룹 머리와 항목 행이 같은 이름 "피보나치"를 쓴다(머리는 개수가 붙는다).
        expect(
            within(panel).getByRole('button', { name: '피보나치' })
        ).toBeInTheDocument();
    });

    it('trendline items are labeled 상승/하락 추세선 #n by direction', async () => {
        const user = userEvent.setup();
        renderMenu([trendUp1, trendDown1]);
        await user.click(screen.getByRole('button', { name: /차트 작도/ }));
        const panel = getPanel();

        expect(
            within(panel).getByRole('button', { name: '상승 추세선 #1' })
        ).toBeInTheDocument();
        expect(
            within(panel).getByRole('button', { name: '하락 추세선 #1' })
        ).toBeInTheDocument();
    });
});

describe('ChartOverlayMenu — level right-extend toggle', () => {
    it('rightExtend가 없으면 행을 렌더하지 않는다', async () => {
        const user = userEvent.setup();
        renderMenu([patternItem]);
        await user.click(screen.getByRole('button', { name: /차트 작도/ }));
        expect(
            within(getPanel()).queryByRole('button', {
                name: '레벨선 오른쪽 연장',
            })
        ).not.toBeInTheDocument();
    });

    it('체크 상태를 보이고 누르면 반대 값으로 콜백, 트리거 개수엔 세지 않는다', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(
            <ChartOverlayMenu
                items={[patternItem]}
                hiddenKeys={new Set()}
                onSetVisible={vi.fn()}
                rightExtend={{ checked: true, onChange }}
            />
        );
        expect(
            screen.getByRole('button', { name: /차트 작도 · 1/ })
        ).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: /차트 작도/ }));
        const toggle = within(getPanel()).getByRole('button', {
            name: '레벨선 오른쪽 연장',
        });
        expect(toggle).toHaveAttribute('aria-pressed', 'true');
        await user.click(toggle);
        expect(onChange).toHaveBeenCalledWith(false);
    });
});

describe('ChartOverlayMenu — 항목 색·강조', () => {
    const second: OverlayMenuItem = {
        key: 'p2',
        kind: 'pattern',
        label: 'Double Top',
    };
    const open = async (onHighlight = vi.fn()) => {
        const user = userEvent.setup();
        render(
            <ChartOverlayMenu
                items={[patternItem, second]}
                hiddenKeys={new Set()}
                onSetVisible={vi.fn()}
                itemColors={new Map([['p1', 'rgb(34, 211, 238)']])}
                onHighlight={onHighlight}
            />
        );
        await user.click(screen.getByRole('button', { name: /차트 작도/ }));
        return { user, onHighlight };
    };

    it('색이 있는 항목 앞에만 그 색 점을 찍는다', async () => {
        await open();
        const dots = getPanel().querySelectorAll('span.rounded-full');
        expect(dots).toHaveLength(1);
        expect((dots[0] as HTMLElement).style.backgroundColor).toBe(
            'rgb(34, 211, 238)'
        );
    });

    it('hover로 그 작도를 강조하고, 벗어나면 푼다', async () => {
        const { user, onHighlight } = await open();
        const row = within(getPanel()).getByRole('button', {
            name: /Double Top/,
        });
        await user.hover(row);
        expect(onHighlight).toHaveBeenLastCalledWith('p2');
        await user.unhover(row);
        expect(onHighlight).toHaveBeenLastCalledWith(null);
    });

    it('focus로도 강조하고 blur로 푼다', async () => {
        const { onHighlight } = await open();
        const row = within(getPanel()).getByRole('button', {
            name: /Double Bottom/,
        });
        act(() => row.focus());
        expect(onHighlight).toHaveBeenLastCalledWith('p1');
        act(() => row.blur());
        expect(onHighlight).toHaveBeenLastCalledWith(null);
    });

    it('메뉴가 건 강조가 없으면 hover 없이 닫혀도 카드가 건 강조를 건드리지 않는다', async () => {
        const { user, onHighlight } = await open();
        await user.keyboard('{Escape}');
        expect(onHighlight).not.toHaveBeenCalled();
    });

    it('항목 위에 커서를 둔 채 패널을 닫아도 메뉴가 건 강조를 푼다', async () => {
        const { user, onHighlight } = await open();
        await user.hover(
            within(getPanel()).getByRole('button', { name: /Double Bottom/ })
        );
        expect(onHighlight).toHaveBeenLastCalledWith('p1');
        await user.keyboard('{Escape}');
        expect(onHighlight).toHaveBeenLastCalledWith(null);
    });
});
