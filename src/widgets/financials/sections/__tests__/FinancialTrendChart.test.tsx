import { render, screen } from '@testing-library/react';
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

    it('renders period labels', () => {
        render(
            <FinancialTrendChart series={BASE_SERIES} periods={BASE_PERIODS} />
        );
        // Period labels appear in both SVG text elements and visible spans below
        expect(screen.getAllByText('2022').length).toBeGreaterThan(0);
        expect(screen.getAllByText('2023').length).toBeGreaterThan(0);
        expect(screen.getAllByText('2024').length).toBeGreaterThan(0);
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
});
