import { render, screen, fireEvent } from '@testing-library/react';
import { FinancialTrendChart } from '../FinancialTrendChart';

const BASE_SERIES = [
    {
        labelKo: '매출',
        values: [1_000_000_000, 2_000_000_000, 3_000_000_000],
        color: 'bullish' as const,
    },
    {
        labelKo: '순이익',
        values: [-500_000_000, 200_000_000, 800_000_000],
        color: 'bearish' as const,
    },
];
const BASE_PERIODS = ['2022', '2023', '2024'];

describe('FinancialTrendChart', () => {
    it('renders an SVG element', () => {
        const { container } = render(
            <FinancialTrendChart series={BASE_SERIES} periods={BASE_PERIODS} />
        );
        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders period labels exactly once in the external div (not in SVG)', () => {
        const { container } = render(
            <FinancialTrendChart series={BASE_SERIES} periods={BASE_PERIODS} />
        );
        // Each period label appears exactly once — in the external <div>, not in the aria-hidden SVG
        expect(screen.getAllByText('2022')).toHaveLength(1);
        expect(screen.getAllByText('2023')).toHaveLength(1);
        expect(screen.getAllByText('2024')).toHaveLength(1);
        // SVG must not contain any <text> period labels
        expect(container.querySelector('svg text')).toBeNull();
    });

    it('renders series legend labels', () => {
        render(
            <FinancialTrendChart series={BASE_SERIES} periods={BASE_PERIODS} />
        );
        expect(screen.getByText('매출')).toBeInTheDocument();
        expect(screen.getByText('순이익')).toBeInTheDocument();
    });

    it('SVG has width="100%" for responsiveness', () => {
        const { container } = render(
            <FinancialTrendChart series={BASE_SERIES} periods={BASE_PERIODS} />
        );
        const svg = container.querySelector('svg');
        expect(svg?.getAttribute('width')).toBe('100%');
    });

    it('marks SVG as decorative with aria-hidden', () => {
        const { container } = render(
            <FinancialTrendChart series={BASE_SERIES} periods={BASE_PERIODS} />
        );
        const svg = container.querySelector('svg');
        expect(svg?.getAttribute('aria-hidden')).toBe('true');
    });

    it('handles single-series data', () => {
        const singleSeries = [
            { labelKo: '매출', values: [100, 200], color: 'neutral' as const },
        ];
        const { container } = render(
            <FinancialTrendChart
                series={singleSeries}
                periods={['2023', '2024']}
            />
        );
        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('handles null values without crashing', () => {
        const seriesWithNull = [
            {
                labelKo: '매출',
                values: [null, 1_000_000_000, null],
                color: 'neutral' as const,
            },
        ];
        expect(() =>
            render(
                <FinancialTrendChart
                    series={seriesWithNull}
                    periods={BASE_PERIODS}
                />
            )
        ).not.toThrow();
    });

    it('renders rect elements for bar chart', () => {
        const { container } = render(
            <FinancialTrendChart series={BASE_SERIES} periods={BASE_PERIODS} />
        );
        const rects = container.querySelectorAll('rect');
        expect(rects.length).toBeGreaterThan(0);
    });

    it('applies per-color legend dot classes from COLOR_CLASSES', () => {
        const { container } = render(
            <FinancialTrendChart series={BASE_SERIES} periods={BASE_PERIODS} />
        );
        const dots = container.querySelectorAll('span.rounded-full');
        // bullish + bearish series → two legend dots with the mapped bg classes.
        expect(dots.length).toBe(2);
        expect(dots[0].className).toContain('bg-chart-bullish');
        expect(dots[1].className).toContain('bg-chart-bearish');
    });

    it('falls back to the neutral legend dot when a series omits color', () => {
        const series = [
            { labelKo: '매출', values: [100, 200] }, // no color → neutral
            { labelKo: '순이익', values: [50, 80], color: 'bullish' as const },
        ];
        const { container } = render(
            <FinancialTrendChart series={series} periods={['2023', '2024']} />
        );
        const dots = container.querySelectorAll('span.rounded-full');
        expect(dots[0].className).toContain('bg-primary-500');
    });

    it('renders no bars when every value is zero (maxAbs === 0 → height 0)', () => {
        const series = [
            { labelKo: '매출', values: [0, 0], color: 'neutral' as const },
        ];
        const { container } = render(
            <FinancialTrendChart series={series} periods={['2023', '2024']} />
        );
        // bar rects carry a fill-* class; transparent per-period hover targets
        // (one per period) do not, so count only the bars.
        expect(container.querySelectorAll('rect[class*="fill-"]').length).toBe(
            0
        );
    });

    it('renders no bars when every value is null (empty value set → maxAbs fallback)', () => {
        const series = [
            {
                labelKo: '매출',
                values: [null, null],
                color: 'neutral' as const,
            },
        ];
        const { container } = render(
            <FinancialTrendChart series={series} periods={['2023', '2024']} />
        );
        expect(container.querySelectorAll('rect[class*="fill-"]').length).toBe(
            0
        );
    });

    it('shows a hover tooltip with the period label and each series value', () => {
        const { container } = render(
            <FinancialTrendChart series={BASE_SERIES} periods={BASE_PERIODS} />
        );
        // 툴팁은 마우스 전용이라 aria-hidden(role 없음) — data-testid로 조회한다.
        // no tooltip until hover
        expect(screen.queryByTestId('chart-tooltip')).toBeNull();

        // hover the last period's transparent hit target (last rect in the SVG)
        const hits = container.querySelectorAll('rect.cursor-crosshair');
        expect(hits.length).toBe(BASE_PERIODS.length);
        fireEvent.pointerEnter(hits[hits.length - 1]!, {
            clientX: 100,
            clientY: 100,
        });

        const tip = screen.getByTestId('chart-tooltip');
        expect(tip).toHaveTextContent('2024');
        expect(tip).toHaveTextContent('매출');
        expect(tip).toHaveTextContent('순이익');
        // 2024 values: 매출 3B, 순이익 800M → compact USD
        expect(tip).toHaveTextContent('$3B');
        expect(tip).toHaveTextContent('$800M');

        fireEvent.pointerLeave(hits[hits.length - 1]!);
        expect(screen.queryByTestId('chart-tooltip')).toBeNull();
    });
});
