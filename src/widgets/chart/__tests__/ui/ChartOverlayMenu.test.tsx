import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OverlayKind } from '@y0ngha/siglens-core';
import { ChartOverlayMenu } from '../../ui/ChartOverlayMenu';

const ZERO_COUNTS: Record<OverlayKind, number> = {
    pattern: 0,
    trendline: 0,
    divergence: 0,
    fibonacci: 0,
    elliott: 0,
};

const DEFAULT_VISIBLE: Record<OverlayKind, boolean> = {
    pattern: true,
    trendline: true,
    divergence: false,
    fibonacci: false,
    elliott: false,
};

function renderMenu(
    counts: Record<OverlayKind, number>,
    visible: Record<OverlayKind, boolean> = DEFAULT_VISIBLE,
    onToggle = vi.fn()
) {
    return {
        onToggle,
        ...render(
            <ChartOverlayMenu
                counts={counts}
                visible={visible}
                onToggle={onToggle}
            />
        ),
    };
}

/** 패널(role="group") 안에서만 버튼을 찾는다 — 트리거의 접근 가능한 이름도
 * `/차트 작도/`와 매칭되므로 전역 조회는 트리거를 함께 집는다. */
function getPanel(): HTMLElement {
    return screen.getByRole('group');
}

describe('ChartOverlayMenu', () => {
    it('renders nothing when every count is 0', () => {
        const { container } = renderMenu(ZERO_COUNTS);
        expect(container).toBeEmptyDOMElement();
    });

    it('shows the number of active categories on the trigger — only listed (count>0) kinds count, not merely visible ones', () => {
        // divergence는 count>0이지만 visible=false다. trendline은 count=0이라
        // 목록에서 아예 빠진다. 활성 개수(active)는 "목록에 있고 visible=true"인
        // kind만 세야 하므로 기대값 2(pattern, fibonacci)는 목록에 오른 kind
        // 수(3: pattern/divergence/fibonacci)와 달라야 한다.
        renderMenu(
            { ...ZERO_COUNTS, pattern: 2, divergence: 1, fibonacci: 1 },
            {
                ...DEFAULT_VISIBLE,
                pattern: true,
                trendline: true,
                divergence: false,
                fibonacci: true,
            }
        );
        expect(
            screen.getByRole('button', { name: /차트 작도 · 2/ })
        ).toBeInTheDocument();
    });

    it('opens the panel on trigger click and lists only kinds with a positive count', async () => {
        const user = userEvent.setup();
        renderMenu({ ...ZERO_COUNTS, pattern: 1 });

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

    it('reflects visibility via aria-pressed and calls onToggle with the clicked kind', async () => {
        const user = userEvent.setup();
        const { onToggle } = renderMenu({
            ...ZERO_COUNTS,
            pattern: 1,
            divergence: 3,
        });

        await user.click(screen.getByRole('button', { name: /차트 작도/ }));
        const panel = getPanel();

        const patternItem = within(panel).getByRole('button', {
            name: /차트 패턴/,
        });
        const divergenceItem = within(panel).getByRole('button', {
            name: /다이버전스/,
        });
        expect(patternItem).toHaveAttribute('aria-pressed', 'true');
        expect(divergenceItem).toHaveAttribute('aria-pressed', 'false');

        await user.click(divergenceItem);
        expect(onToggle).toHaveBeenCalledWith('divergence');
    });

    it('closes on Escape and returns focus to the trigger', async () => {
        const user = userEvent.setup();
        renderMenu({ ...ZERO_COUNTS, pattern: 1 });

        const trigger = screen.getByRole('button', { name: /차트 작도/ });
        await user.click(trigger);
        expect(screen.getByRole('group')).toBeInTheDocument();

        await user.keyboard('{Escape}');

        expect(screen.queryByRole('group')).not.toBeInTheDocument();
        expect(document.activeElement).toBe(trigger);
    });

    it('trigger exposes aria-expanded and aria-controls pointing at the panel id', async () => {
        const user = userEvent.setup();
        renderMenu({ ...ZERO_COUNTS, pattern: 1 });

        const trigger = screen.getByRole('button', { name: /차트 작도/ });
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(trigger).not.toHaveAttribute('aria-haspopup');

        await user.click(trigger);
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        const controlsId = trigger.getAttribute('aria-controls');
        expect(controlsId).toBeTruthy();
        expect(getPanel()).toHaveAttribute('id', controlsId);
    });

    it('tab order through the panel is natural (no roving tabindex overrides)', async () => {
        const user = userEvent.setup();
        renderMenu({ ...ZERO_COUNTS, pattern: 1, divergence: 1 });

        await user.click(screen.getByRole('button', { name: /차트 작도/ }));
        const panel = getPanel();
        const items = within(panel).getAllByRole('button');
        for (const item of items) {
            expect(item).not.toHaveAttribute('tabindex');
        }
    });
});
