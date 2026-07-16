import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Timeframe } from '@y0ngha/siglens-core';
import { TimeframeSelector } from '@/widgets/chart/TimeframeSelector';
import { TIMEFRAMES } from '@/shared/config/market';

vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

describe('TimeframeSelector', () => {
    it('renders a button for each timeframe', () => {
        render(<TimeframeSelector value="1Day" onChange={vi.fn()} />);

        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(TIMEFRAMES.length);
    });

    it('renders Korean labels for timeframes', () => {
        render(<TimeframeSelector value="1Day" onChange={vi.fn()} />);

        expect(screen.getByText('5분')).toBeInTheDocument();
        expect(screen.getByText('15분')).toBeInTheDocument();
        expect(screen.getByText('30분')).toBeInTheDocument();
        expect(screen.getByText('1시간')).toBeInTheDocument();
        expect(screen.getByText('4시간')).toBeInTheDocument();
        expect(screen.getByText('1일')).toBeInTheDocument();
    });

    it('calls onChange with the clicked timeframe', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<TimeframeSelector value="1Day" onChange={onChange} />);

        await user.click(screen.getByText('5분'));

        expect(onChange).toHaveBeenCalledWith('5Min' satisfies Timeframe);
    });

    it('calls onChange when a different timeframe is selected', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<TimeframeSelector value="1Day" onChange={onChange} />);

        await user.click(screen.getByText('4시간'));

        expect(onChange).toHaveBeenCalledWith('4Hour' satisfies Timeframe);
    });

    it('disables every non-1Day button for free tier', () => {
        render(
            <TimeframeSelector value="1Day" onChange={vi.fn()} isFreeTier />
        );

        expect(screen.getByRole('button', { name: '5분' })).toBeDisabled();
        expect(screen.getByRole('button', { name: '1일' })).toBeEnabled();
    });
});
