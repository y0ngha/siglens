import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IndicatorToolbar } from '@/widgets/chart/IndicatorToolbar';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => '/AAPL',
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));

vi.mock('@/shared/lib/chartColors', () => ({
    getPeriodColor: (period: number) => `hsl(${period * 10}, 70%, 50%)`,
}));

function makeToggleGroup(visible = false) {
    return { visible, onToggle: vi.fn() };
}

const DEFAULT_PROPS = {
    maVisiblePeriods: [] as number[],
    maAvailablePeriods: [5, 10, 20, 50, 100, 200] as const,
    onMAToggle: vi.fn(),
    emaVisiblePeriods: [] as number[],
    emaAvailablePeriods: [5, 10, 20, 50, 100, 200] as const,
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

describe('Chart Indicator Flow', () => {
    it('renders expand/collapse button initially', () => {
        render(<IndicatorToolbar {...DEFAULT_PROPS} />);
        expect(screen.getByLabelText('Show indicators')).toBeInTheDocument();
    });

    it('shows indicator buttons after expanding', async () => {
        render(<IndicatorToolbar {...DEFAULT_PROPS} />);
        const user = userEvent.setup();
        await user.click(screen.getByLabelText('Show indicators'));
        expect(screen.getByText('RSI')).toBeInTheDocument();
        expect(screen.getByText('MACD')).toBeInTheDocument();
        expect(screen.getByText('BB')).toBeInTheDocument();
        expect(screen.getByText('MA')).toBeInTheDocument();
        expect(screen.getByText('EMA')).toBeInTheDocument();
    });

    it('calls RSI toggle when RSI button is clicked', async () => {
        const rsiToggle = makeToggleGroup();
        render(<IndicatorToolbar {...DEFAULT_PROPS} rsi={rsiToggle} />);
        const user = userEvent.setup();
        await user.click(screen.getByLabelText('Show indicators'));
        await user.click(screen.getByText('RSI'));
        expect(rsiToggle.onToggle).toHaveBeenCalledTimes(1);
    });

    it('collapses when toggle is clicked again', async () => {
        render(<IndicatorToolbar {...DEFAULT_PROPS} />);
        const user = userEvent.setup();
        await user.click(screen.getByLabelText('Show indicators'));
        expect(screen.getByText('RSI')).toBeInTheDocument();
        await user.click(screen.getByLabelText('Hide indicators'));
        expect(screen.queryByText('RSI')).not.toBeInTheDocument();
    });

    it('shows MA dropdown when MA button is clicked', async () => {
        render(<IndicatorToolbar {...DEFAULT_PROPS} />);
        const user = userEvent.setup();
        await user.click(screen.getByLabelText('Show indicators'));
        await user.click(screen.getByText('MA'));
        expect(screen.getByText('5')).toBeInTheDocument();
        expect(screen.getByText('200')).toBeInTheDocument();
    });
});
