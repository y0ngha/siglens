import { render, screen } from '@testing-library/react';
import { OverlayLegend } from '@/widgets/chart/OverlayLegend';
import type { OverlayLegendItem } from '@/widgets/chart/types';
import type { OverlayGroup } from '@/widgets/chart/utils/overlayLegendFormat';

vi.mock('@/widgets/chart/hooks/useOverlayGroups', () => ({
    useOverlayGroups: (items: OverlayLegendItem[]): OverlayGroup[] => {
        if (items.length === 0) return [];
        return [{ key: 'TestGroup', items }];
    },
}));

vi.mock('@/widgets/chart/utils/overlayLegendFormat', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@/widgets/chart/utils/overlayLegendFormat')
        >();
    return { ...original };
});

describe('OverlayLegend', () => {
    it('returns null when items is empty', () => {
        const { container } = render(<OverlayLegend items={[]} />);

        expect(container.firstChild).toBeNull();
    });

    it('renders item names and formatted values', () => {
        const items: OverlayLegendItem[] = [
            { name: 'MA(5)', color: '#ff0000', value: 100.5 },
            { name: 'MA(20)', color: '#00ff00', value: null },
        ];

        render(<OverlayLegend items={items} />);

        expect(screen.getByText(/MA\(5\)/)).toBeInTheDocument();
        expect(screen.getByText(/100\.50/)).toBeInTheDocument();
        expect(screen.getByText(/MA\(20\)/)).toBeInTheDocument();
        expect(screen.getByText(/-/)).toBeInTheDocument();
    });

    it('renders the bullet character for each item', () => {
        const items: OverlayLegendItem[] = [
            { name: 'RSI', color: '#ff0000', value: 70 },
        ];

        render(<OverlayLegend items={items} />);

        expect(screen.getByText(/●/)).toBeInTheDocument();
    });
});
