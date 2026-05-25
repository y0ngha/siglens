import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IndicatorToolbar } from '@/widgets/chart/IndicatorToolbar';

vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

vi.mock('@/shared/lib/chartColors', () => ({
    getPeriodColor: (period: number) => `#color-${period}`,
}));

const { mockIsExpanded } = vi.hoisted(() => ({
    mockIsExpanded: { value: true },
}));

vi.mock('@/widgets/chart/hooks/useIndicatorDropdown', () => ({
    useIndicatorDropdown: () => ({
        isExpanded: mockIsExpanded.value,
        openDropdown: null,
        dropdownPosition: null,
        toolbarRef: { current: null },
        portalRef: { current: null },
        buttonRefs: {
            ma: { current: null },
            ema: { current: null },
        },
        toggleExpanded: vi.fn(),
        toggleDropdown: vi.fn(),
    }),
}));

function makeToggleGroup(visible = false) {
    return { visible, onToggle: vi.fn() };
}

const defaultProps = {
    maVisiblePeriods: [] as number[],
    maAvailablePeriods: [5, 10, 20] as const,
    onMAToggle: vi.fn(),
    emaVisiblePeriods: [] as number[],
    emaAvailablePeriods: [9, 21] as const,
    onEMAToggle: vi.fn(),
    bollinger: makeToggleGroup(),
    macd: makeToggleGroup(),
    rsi: makeToggleGroup(),
    dmi: makeToggleGroup(),
    stochastic: makeToggleGroup(),
    stochRsi: makeToggleGroup(),
    cci: makeToggleGroup(),
    volumeProfile: makeToggleGroup(),
    ichimoku: makeToggleGroup(),
};

describe('IndicatorToolbar', () => {
    beforeEach(() => {
        mockIsExpanded.value = true;
    });

    it('renders all toggle indicator buttons when expanded', () => {
        render(<IndicatorToolbar {...defaultProps} />);

        expect(screen.getByText('BB')).toBeInTheDocument();
        expect(screen.getByText('RSI')).toBeInTheDocument();
        expect(screen.getByText('MACD')).toBeInTheDocument();
        expect(screen.getByText('DMI')).toBeInTheDocument();
        expect(screen.getByText('Stoch')).toBeInTheDocument();
        expect(screen.getByText('StochRSI')).toBeInTheDocument();
        expect(screen.getByText('CCI')).toBeInTheDocument();
        expect(screen.getByText('VP')).toBeInTheDocument();
        expect(screen.getByText('Ichimoku')).toBeInTheDocument();
    });

    it('renders dropdown indicator buttons (MA, EMA)', () => {
        render(<IndicatorToolbar {...defaultProps} />);

        expect(screen.getByText('MA')).toBeInTheDocument();
        expect(screen.getByText('EMA')).toBeInTheDocument();
    });

    it('calls toggle callback when a toggle indicator button is clicked', async () => {
        const user = userEvent.setup();
        const bollingerToggle = vi.fn();
        render(
            <IndicatorToolbar
                {...defaultProps}
                bollinger={{ visible: false, onToggle: bollingerToggle }}
            />
        );

        await user.click(screen.getByText('BB'));

        expect(bollingerToggle).toHaveBeenCalledTimes(1);
    });

    it('renders the expand/collapse button with correct aria-label when expanded', () => {
        render(<IndicatorToolbar {...defaultProps} />);

        const collapseButton = screen.getByRole('button', {
            name: 'Hide indicators',
        });
        expect(collapseButton).toBeInTheDocument();
        expect(collapseButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('renders period labels when maVisiblePeriods are active', () => {
        render(
            <IndicatorToolbar {...defaultProps} maVisiblePeriods={[5, 20]} />
        );

        expect(screen.getByText('MA(5)')).toBeInTheDocument();
        expect(screen.getByText('MA(20)')).toBeInTheDocument();
    });

    it('renders EMA period labels when emaVisiblePeriods are active', () => {
        render(<IndicatorToolbar {...defaultProps} emaVisiblePeriods={[9]} />);

        expect(screen.getByText('EMA(9)')).toBeInTheDocument();
    });
});

describe('IndicatorToolbar collapsed state', () => {
    beforeEach(() => {
        mockIsExpanded.value = false;
    });

    it('does not render indicator buttons when collapsed', () => {
        render(<IndicatorToolbar {...defaultProps} />);

        expect(screen.queryByText('BB')).not.toBeInTheDocument();
        expect(screen.queryByText('RSI')).not.toBeInTheDocument();
        expect(screen.queryByText('MA')).not.toBeInTheDocument();
    });

    it('shows "Show indicators" aria-label when collapsed', () => {
        render(<IndicatorToolbar {...defaultProps} />);

        const expandButton = screen.getByRole('button', {
            name: 'Show indicators',
        });
        expect(expandButton).toHaveAttribute('aria-expanded', 'false');
    });
});
