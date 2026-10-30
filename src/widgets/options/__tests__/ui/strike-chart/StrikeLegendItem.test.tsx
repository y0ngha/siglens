import { render, screen } from '@testing-library/react';
import { StrikeLegendItem } from '@/widgets/options/ui/strike-chart/StrikeLegendItem';
import { StrikeChartLegend } from '@/widgets/options/ui/strike-chart/StrikeChartLegend';

describe('StrikeLegendItem', () => {
    it.each([
        ['call', 'bg-chart-bullish'],
        ['put', 'bg-chart-bearish'],
        ['dashedLine', 'border-dashed'],
        ['solidLine', 'border-solid'],
    ] as const)('draws a %s swatch', (swatch, className) => {
        const { container } = render(
            <StrikeLegendItem swatch={swatch}>label</StrikeLegendItem>
        );
        const chip = container.querySelector('[aria-hidden="true"]')!;
        expect(chip.className).toContain(className);
    });

    it('renders its label', () => {
        render(<StrikeLegendItem swatch="call">Call OI</StrikeLegendItem>);
        expect(screen.getByText('Call OI')).toBeInTheDocument();
    });
});

describe('StrikeChartLegend', () => {
    it('wraps its entries', () => {
        render(
            <StrikeChartLegend>
                <span>entry</span>
            </StrikeChartLegend>
        );
        expect(screen.getByText('entry').parentElement?.className).toContain(
            'flex-wrap'
        );
    });
});
