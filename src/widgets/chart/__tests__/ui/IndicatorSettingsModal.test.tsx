import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/hooks/useDialog', () => ({
    useDialog: vi.fn(() => ({
        isOpen: false,
        open: vi.fn(),
        close: vi.fn(),
        dialogRef: { current: null },
        triggerRef: { current: null },
    })),
}));
vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) =>
        args
            .flat()
            .filter(a => typeof a === 'string' && a.length > 0)
            .join(' '),
}));
vi.mock('@/shared/lib/chartColors', () => ({
    getPeriodColor: () => '#abcdef',
}));

import { render, screen, fireEvent } from '@testing-library/react';
import { useDialog } from '@/shared/hooks/useDialog';
import { IndicatorSettingsModal } from '../../ui/IndicatorSettingsModal';
import {
    INDICATOR_META,
    type IndicatorBinding,
} from '../../model/indicatorRegistry';

function openDialog(): void {
    vi.mocked(useDialog).mockReturnValue({
        isOpen: true,
        open: vi.fn(),
        close: vi.fn(),
        dialogRef: { current: null },
        triggerRef: { current: null },
    });
}

const rsiBinding = (
    over: Partial<IndicatorBinding> = {}
): IndicatorBinding => ({
    meta: INDICATOR_META.rsi!,
    active: false,
    onToggle: vi.fn(),
    ...over,
});

const maBinding = (over: Partial<IndicatorBinding> = {}): IndicatorBinding => ({
    meta: INDICATOR_META.ma!,
    active: false,
    availablePeriods: [20, 60],
    visiblePeriods: [],
    onTogglePeriod: vi.fn(),
    ...over,
});

describe('IndicatorSettingsModal', () => {
    beforeEach(() => {
        vi.mocked(useDialog).mockReturnValue({
            isOpen: false,
            open: vi.fn(),
            close: vi.fn(),
            dialogRef: { current: null },
            triggerRef: { current: null },
        });
    });

    it('renders the gear trigger button', () => {
        render(<IndicatorSettingsModal bindings={[rsiBinding()]} />);
        expect(
            screen.getByRole('button', { name: '보조지표 설정' })
        ).toBeInTheDocument();
    });

    it('does not render the dialog when closed', () => {
        render(<IndicatorSettingsModal bindings={[rsiBinding()]} />);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('calls open when the gear trigger is clicked', () => {
        const open = vi.fn();
        vi.mocked(useDialog).mockReturnValue({
            isOpen: false,
            open,
            close: vi.fn(),
            dialogRef: { current: null },
            triggerRef: { current: null },
        });
        render(<IndicatorSettingsModal bindings={[rsiBinding()]} />);
        fireEvent.click(screen.getByRole('button', { name: '보조지표 설정' }));
        expect(open).toHaveBeenCalledTimes(1);
    });

    it('renders category headings only for non-empty categories', () => {
        openDialog();
        render(
            <IndicatorSettingsModal bindings={[rsiBinding(), maBinding()]} />
        );
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('추세')).toBeInTheDocument();
        expect(screen.getByText('모멘텀')).toBeInTheDocument();
        expect(screen.queryByText('변동성')).not.toBeInTheDocument();
        expect(screen.queryByText('SMC')).not.toBeInTheDocument();
    });

    it('orders category sections by CATEGORY_ORDER regardless of binding input order', () => {
        openDialog();
        render(
            <IndicatorSettingsModal
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
        const headings = screen
            .getAllByRole('heading', { level: 3 })
            .map(h => h.textContent);
        expect(headings).toEqual(['추세', '모멘텀', '변동성']);
    });

    it('renders a checkbox for non-period indicators and calls onToggle', () => {
        openDialog();
        const onToggle = vi.fn();
        render(
            <IndicatorSettingsModal bindings={[rsiBinding({ onToggle })]} />
        );
        const checkbox = screen.getByRole('checkbox', { name: /RSI/ });
        expect(checkbox).not.toBeChecked();
        fireEvent.click(checkbox);
        expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('reflects active state on the checkbox', () => {
        openDialog();
        render(
            <IndicatorSettingsModal bindings={[rsiBinding({ active: true })]} />
        );
        expect(screen.getByRole('checkbox', { name: /RSI/ })).toBeChecked();
    });

    it('renders period chips (not a checkbox) for ma/ema and toggles a period', () => {
        openDialog();
        const onTogglePeriod = vi.fn();
        render(
            <IndicatorSettingsModal
                bindings={[maBinding({ visiblePeriods: [20], onTogglePeriod })]}
            />
        );
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
        const chip20 = screen.getByRole('button', { name: /20/ });
        const chip60 = screen.getByRole('button', { name: /60/ });
        expect(chip20).toHaveAttribute('aria-pressed', 'true');
        expect(chip60).toHaveAttribute('aria-pressed', 'false');
        fireEvent.click(chip60);
        expect(onTogglePeriod).toHaveBeenCalledWith(60);
    });

    it('calls close when the close button is clicked', () => {
        const close = vi.fn();
        vi.mocked(useDialog).mockReturnValue({
            isOpen: true,
            open: vi.fn(),
            close,
            dialogRef: { current: null },
            triggerRef: { current: null },
        });
        render(<IndicatorSettingsModal bindings={[rsiBinding()]} />);
        fireEvent.click(screen.getByRole('button', { name: '닫기' }));
        expect(close).toHaveBeenCalledTimes(1);
    });

    it('renders an empty dialog body without crashing when bindings is empty (worst case)', () => {
        openDialog();
        render(<IndicatorSettingsModal bindings={[]} />);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('handles a period indicator with no available periods (worst case)', () => {
        openDialog();
        render(
            <IndicatorSettingsModal
                bindings={[
                    maBinding({ availablePeriods: [], visiblePeriods: [] }),
                ]}
            />
        );
        expect(screen.getByText('MA')).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: /20/ })
        ).not.toBeInTheDocument();
    });

    it('renders indicator items in a 2-column grid container (layout regression)', () => {
        openDialog();
        render(
            <IndicatorSettingsModal bindings={[rsiBinding(), maBinding()]} />
        );
        // 카테고리별 항목 컨테이너가 2열 그리드여야 모달 길이가 짧아져 모바일에서 안 가려진다.
        // rsi(momentum)+ma(trend) = 정확히 2개 카테고리 → 그리드 컨테이너 2개(결정적).
        expect(document.querySelectorAll('.grid.grid-cols-2').length).toBe(2);
    });

    it('wraps period rows with col-span-2 so chips span the full width', () => {
        openDialog();
        render(<IndicatorSettingsModal bindings={[maBinding()]} />);
        // period 행(MA/EMA)은 칩이 넓어 2열 그리드에서 전체폭(col-span-2)을 차지해야 한다.
        // ma 바인딩 1개 → col-span-2 래퍼 정확히 1개(결정적).
        expect(document.querySelectorAll('.col-span-2').length).toBe(1);
    });
});
