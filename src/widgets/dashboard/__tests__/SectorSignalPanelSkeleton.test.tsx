import { render, screen } from '@testing-library/react';
import { SectorSignalPanelSkeleton } from '@/widgets/dashboard/SectorSignalPanelSkeleton';

vi.mock('@/shared/config/dashboard-tickers', () => ({
    SIGNAL_SECTORS: [{ symbol: 'XLK' }, { symbol: 'XLF' }, { symbol: 'XLV' }],
}));

describe('SectorSignalPanelSkeleton', () => {
    it('renders aria-busy section', () => {
        render(<SectorSignalPanelSkeleton />);
        const section = screen.getByLabelText('섹터 신호 로딩 중');
        expect(section).toHaveAttribute('aria-busy', 'true');
    });

    it('renders skeleton tabs for each sector', () => {
        const { container } = render(<SectorSignalPanelSkeleton />);
        const tabSkeletons = container.querySelectorAll('.border-b > div');
        expect(tabSkeletons).toHaveLength(3);
    });

    it('hides decorative content from assistive technology', () => {
        const { container } = render(<SectorSignalPanelSkeleton />);
        const ariaHiddenElements = container.querySelectorAll(
            '[aria-hidden="true"]'
        );
        expect(ariaHiddenElements.length).toBeGreaterThan(0);
    });
});
