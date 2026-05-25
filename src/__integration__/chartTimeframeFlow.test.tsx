import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimeframeSelector } from '@/widgets/chart/TimeframeSelector';
import type { Timeframe } from '@y0ngha/siglens-core';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => '/AAPL',
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));

vi.mock('@/shared/config/market', () => ({
    TIMEFRAMES: [
        '5Min',
        '15Min',
        '30Min',
        '1Hour',
        '4Hour',
        '1Day',
    ] as Timeframe[],
}));

describe('Chart Timeframe Flow', () => {
    it('renders all timeframe buttons', () => {
        render(
            <TimeframeSelector value={'1Day' as Timeframe} onChange={vi.fn()} />
        );
        expect(screen.getByText('5분')).toBeInTheDocument();
        expect(screen.getByText('15분')).toBeInTheDocument();
        expect(screen.getByText('30분')).toBeInTheDocument();
        expect(screen.getByText('1시간')).toBeInTheDocument();
        expect(screen.getByText('4시간')).toBeInTheDocument();
        expect(screen.getByText('1일')).toBeInTheDocument();
    });

    it('calls onChange when a different timeframe is clicked', async () => {
        const onChange = vi.fn();
        render(
            <TimeframeSelector
                value={'1Day' as Timeframe}
                onChange={onChange}
            />
        );
        const user = userEvent.setup();
        await user.click(screen.getByText('1시간'));
        expect(onChange).toHaveBeenCalledWith('1Hour');
    });

    it('highlights active timeframe', () => {
        render(
            <TimeframeSelector value={'1Day' as Timeframe} onChange={vi.fn()} />
        );
        const activeButton = screen.getByText('1일').closest('button');
        expect(activeButton?.className).toContain('primary');
    });

    it('does not visually highlight inactive timeframes', () => {
        render(
            <TimeframeSelector value={'1Day' as Timeframe} onChange={vi.fn()} />
        );
        const inactiveButton = screen.getByText('5분').closest('button');
        expect(inactiveButton?.className).not.toContain('border-primary');
    });
});
