import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimeframeSelector } from '@/widgets/dashboard/TimeframeSelector';

vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

vi.mock('@/shared/hooks/useRovingKeyboardNav', () => ({
    useRovingKeyboardNav: () => vi.fn(),
}));

vi.mock('@/shared/config/dashboard-tickers', () => ({
    DASHBOARD_TIMEFRAMES: ['1Day', '1Week'] as const,
    DASHBOARD_TIMEFRAME_LABELS: {
        '1Day': '1일',
        '1Week': '1주',
    },
}));

describe('TimeframeSelector', () => {
    it('renders radio buttons for each timeframe', () => {
        render(<TimeframeSelector timeframe="1Day" onChange={vi.fn()} />);
        const radios = screen.getAllByRole('radio');
        expect(radios).toHaveLength(2);
    });

    it('marks the active timeframe as checked', () => {
        render(<TimeframeSelector timeframe="1Day" onChange={vi.fn()} />);
        const radios = screen.getAllByRole('radio');
        expect(radios[0]).toHaveAttribute('aria-checked', 'true');
        expect(radios[1]).toHaveAttribute('aria-checked', 'false');
    });

    it('calls onChange when a radio is clicked', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<TimeframeSelector timeframe="1Day" onChange={onChange} />);
        await user.click(screen.getAllByRole('radio')[1]!);
        expect(onChange).toHaveBeenCalledWith('1Week');
    });

    it('renders radiogroup with label', () => {
        render(<TimeframeSelector timeframe="1Day" onChange={vi.fn()} />);
        expect(screen.getByRole('radiogroup')).toBeInTheDocument();
        expect(screen.getByText('타임프레임')).toBeInTheDocument();
    });

    it('sets tabIndex 0 for active and -1 for inactive', () => {
        render(<TimeframeSelector timeframe="1Day" onChange={vi.fn()} />);
        const radios = screen.getAllByRole('radio');
        expect(radios[0]).toHaveAttribute('tabindex', '0');
        expect(radios[1]).toHaveAttribute('tabindex', '-1');
    });
});
