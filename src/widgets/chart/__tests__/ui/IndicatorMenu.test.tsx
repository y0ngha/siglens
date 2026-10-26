import { describe, it, expect, vi } from 'vitest';

vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) =>
        args
            .flat()
            .filter(a => typeof a === 'string' && a.length > 0)
            .join(' '),
}));
vi.mock('@/shared/lib/chartColors', () => ({
    getPeriodColor: () => '#abcdef',
    /* 차트 크롬을 런타임 테마에서 읽는 리졸버. 테스트는 다크 고정이면 충분하다. */
    getChartChrome: () => ({
        background: '#1a1a2e',
        grid: '#2a2a3e',
        text: '#a0a0b0',
    }),
}));

import { render, screen, fireEvent } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { useExclusiveChartMenu } from '../../hooks/useExclusiveChartMenu';
import { IndicatorMenu } from '../../ui/IndicatorMenu';
import { CHART_POPOVER_PANEL } from '../../ui/chartPopoverStyles';
import {
    INDICATOR_META,
    type IndicatorBinding,
} from '../../model/indicatorRegistry';

/** 트리거를 눌러 팝오버를 연다 — 닫힌 동안에는 패널이 DOM에 없다. */
function openPanel(): void {
    fireEvent.click(screen.getByRole('button', { name: /^보조지표/ }));
}

const rsiBinding = (
    over: Partial<IndicatorBinding> = {}
): IndicatorBinding => ({
    meta: INDICATOR_META.rsi!,
    active: false,
    onToggle: vi.fn(),
    ...over,
});

function IndicatorMenuHarness(
    props: Omit<ComponentProps<typeof IndicatorMenu>, 'menu'>
) {
    const { bind } = useExclusiveChartMenu();
    return <IndicatorMenu menu={bind('indicators')} {...props} />;
}

const maBinding = (over: Partial<IndicatorBinding> = {}): IndicatorBinding => ({
    meta: INDICATOR_META.ma!,
    active: false,
    availablePeriods: [20, 60],
    visiblePeriods: [],
    onTogglePeriod: vi.fn(),
    ...over,
});

describe('IndicatorMenu', () => {
    it('renders a text trigger named "보조지표" (no count) when no indicator is on', () => {
        render(<IndicatorMenuHarness bindings={[rsiBinding()]} />);
        expect(
            screen.getByRole('button', { name: '보조지표' })
        ).toBeInTheDocument();
        // 톱니바퀴가 아니라 "차트 작도"와 같은 글자 트리거(▾는 장식).
        expect(
            screen.getByRole('button', { name: '보조지표' }).textContent
        ).toBe('보조지표▾');
    });

    it('shows the number of enabled indicators in the trigger label', () => {
        render(
            <IndicatorMenuHarness
                bindings={[
                    rsiBinding({ active: true }),
                    maBinding({ active: true, visiblePeriods: [20] }),
                    {
                        meta: INDICATOR_META.bollinger!,
                        active: false,
                        onToggle: vi.fn(),
                    },
                ]}
            />
        );
        expect(
            screen.getByRole('button', { name: '보조지표 (2)' })
        ).toBeInTheDocument();
    });

    it('keeps the panel out of the DOM while closed and marks the trigger collapsed', () => {
        render(<IndicatorMenuHarness bindings={[rsiBinding()]} />);
        const gear = screen.getByRole('button', { name: /^보조지표/ });
        expect(gear).toHaveAttribute('aria-expanded', 'false');
        expect(
            screen.queryByRole('group', { name: '보조지표 설정' })
        ).not.toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('opens an anchored popover (not a modal) under the trigger, with the same panel surface as the drawing menu', () => {
        render(<IndicatorMenuHarness bindings={[rsiBinding()]} />);
        openPanel();
        const gear = screen.getByRole('button', { name: /^보조지표/ });
        expect(gear).toHaveAttribute('aria-expanded', 'true');
        const panel = screen.getByRole('group', { name: '보조지표 설정' });
        expect(gear).toHaveAttribute('aria-controls', panel.id);
        // 차트 열(overflow-hidden) 밖인 body로 포털하고 뷰포트 좌표(fixed)로 놓는다 — 잘리지 않고, 화면 중앙 모달도 아니다.
        expect(panel.parentElement).toBe(document.body);
        expect(panel).toHaveClass('fixed', 'z-60');
        for (const shared of CHART_POPOVER_PANEL.split(' '))
            expect(panel).toHaveClass(shared);
        expect(panel.style.top).not.toBe('');
        expect(panel.style.left).not.toBe('');
        expect(document.querySelector('dialog')).toBeNull();
    });

    it('closes when the gear is clicked again, on Escape and on an outside click', () => {
        render(<IndicatorMenuHarness bindings={[rsiBinding()]} />);
        const panelQuery = () =>
            screen.queryByRole('group', { name: '보조지표 설정' });
        openPanel();
        openPanel();
        expect(panelQuery()).toBeNull();
        openPanel();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(panelQuery()).toBeNull();
        openPanel();
        fireEvent.mouseDown(document.body);
        fireEvent.pointerDown(document.body);
        expect(panelQuery()).toBeNull();
    });

    it('renders category headings only for non-empty categories', () => {
        render(<IndicatorMenuHarness bindings={[rsiBinding(), maBinding()]} />);
        openPanel();
        expect(
            screen.getByRole('group', { name: '보조지표 설정' })
        ).toBeInTheDocument();
        expect(screen.getByText('추세')).toBeInTheDocument();
        expect(screen.getByText('모멘텀')).toBeInTheDocument();
        expect(screen.queryByText('변동성')).not.toBeInTheDocument();
        expect(screen.queryByText('SMC')).not.toBeInTheDocument();
    });

    it('orders category sections by CATEGORY_ORDER regardless of binding input order', () => {
        render(
            <IndicatorMenuHarness
                bindings={[
                    rsiBinding(), // momentum
                    maBinding(), // trend
                    {
                        meta: INDICATOR_META.bollinger!,
                        active: false,
                        onToggle: vi.fn(),
                    }, // volatility
                ]}
            />
        );
        openPanel();
        const headings = screen
            .getAllByRole('heading', { level: 3 })
            .map(h => h.textContent);
        expect(headings).toEqual(['추세', '모멘텀', '변동성']);
    });

    it('renders a checkbox for non-period indicators and calls onToggle', () => {
        const onToggle = vi.fn();
        render(<IndicatorMenuHarness bindings={[rsiBinding({ onToggle })]} />);
        openPanel();
        const checkbox = screen.getByRole('checkbox', { name: /RSI/ });
        expect(checkbox).not.toBeChecked();
        fireEvent.click(checkbox);
        expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('reflects active state on the checkbox', () => {
        render(
            <IndicatorMenuHarness bindings={[rsiBinding({ active: true })]} />
        );
        openPanel();
        expect(screen.getByRole('checkbox', { name: /RSI/ })).toBeChecked();
    });

    it('renders period chips (not a checkbox) for ma/ema and toggles a period', () => {
        const onTogglePeriod = vi.fn();
        render(
            <IndicatorMenuHarness
                bindings={[maBinding({ visiblePeriods: [20], onTogglePeriod })]}
            />
        );
        openPanel();
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
        const chip20 = screen.getByRole('button', { name: /20/ });
        const chip60 = screen.getByRole('button', { name: /60/ });
        expect(chip20).toHaveAttribute('aria-pressed', 'true');
        expect(chip60).toHaveAttribute('aria-pressed', 'false');
        fireEvent.click(chip60);
        expect(onTogglePeriod).toHaveBeenCalledWith(60);
    });

    it('renders an empty panel body without crashing when bindings is empty (worst case)', () => {
        render(<IndicatorMenuHarness bindings={[]} />);
        openPanel();
        expect(
            screen.getByRole('group', { name: '보조지표 설정' })
        ).toBeInTheDocument();
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('handles a period indicator with no available periods (worst case)', () => {
        render(
            <IndicatorMenuHarness
                bindings={[
                    maBinding({ availablePeriods: [], visiblePeriods: [] }),
                ]}
            />
        );
        openPanel();
        expect(screen.getByText('MA')).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: /20/ })
        ).not.toBeInTheDocument();
    });

    it('renders indicator items in a 2-column grid container (layout regression)', () => {
        render(<IndicatorMenuHarness bindings={[rsiBinding(), maBinding()]} />);
        openPanel();
        // 카테고리별 항목 컨테이너가 2열 그리드여야 모달 길이가 짧아져 모바일에서 안 가려진다.
        // rsi(momentum)+ma(trend) = 정확히 2개 카테고리 → 그리드 컨테이너 2개(결정적).
        expect(document.querySelectorAll('.grid.grid-cols-2').length).toBe(2);
    });

    it('wraps period rows with col-span-2 so chips span the full width', () => {
        render(<IndicatorMenuHarness bindings={[maBinding()]} />);
        openPanel();
        // period 행(MA/EMA)은 칩이 넓어 2열 그리드에서 전체폭(col-span-2)을 차지해야 한다.
        // ma 바인딩 1개 → col-span-2 래퍼 정확히 1개(결정적).
        expect(document.querySelectorAll('.col-span-2').length).toBe(1);
    });
});
