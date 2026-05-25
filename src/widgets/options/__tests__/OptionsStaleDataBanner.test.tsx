import { render, screen } from '@testing-library/react';
import { OptionsStaleDataBanner } from '@/widgets/options/OptionsStaleDataBanner';

vi.mock('@/shared/lib/options/marketHoursDisplay', () => ({
    ET_MARKET_HOURS_DISPLAY: '9:30~16:00 ET',
    KST_EDT_HOURS_DISPLAY: '22:30~05:00',
    KST_EST_HOURS_DISPLAY: '23:30~06:00',
}));

vi.mock('@/shared/lib/eastern', () => ({
    EDT_OFFSET_HOURS: -4,
    getEasternOffsetHours: () => -4,
}));

describe('OptionsStaleDataBanner', () => {
    it('renders the stale data heading', () => {
        render(<OptionsStaleDataBanner />);
        expect(
            screen.getByText('옵션 OI 데이터가 비어 있어요')
        ).toBeInTheDocument();
    });

    it('renders status role', () => {
        render(<OptionsStaleDataBanner />);
        expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('renders ET market hours', () => {
        render(<OptionsStaleDataBanner />);
        expect(screen.getByText(/9:30~16:00 ET/)).toBeInTheDocument();
    });

    it('renders both KST windows', () => {
        render(<OptionsStaleDataBanner />);
        const text = screen.getByRole('status').textContent ?? '';
        expect(text).toContain('22:30~05:00');
        expect(text).toContain('23:30~06:00');
    });

    it('renders current DST label', () => {
        render(<OptionsStaleDataBanner />);
        const text = screen.getByRole('status').textContent ?? '';
        expect(text).toContain('서머타임(EDT)');
    });
});
