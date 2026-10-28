import { render, screen, fireEvent } from '@testing-library/react';
import { FinancialTrendChart } from '@/widgets/financials/sections/FinancialTrendChart';

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
        expect(tip).toHaveTextContent('US$30억');
        expect(tip).toHaveTextContent('US$8억');

        fireEvent.pointerLeave(hits[hits.length - 1]!);
        expect(screen.queryByTestId('chart-tooltip')).toBeNull();
    });
});

/**
 * 범례가 거짓말하지 않아야 한다. 현금흐름표의 범례는 영업CF 초록 / FCF 파랑 / CapEx 빨강이므로
 * FCF가 음수인 기간에도 FCF 막대는 파랑이어야 CapEx와 구분된다. 부호는 색이 아니라 baseline
 * 아래로 그려지는 방향이 나른다.
 */
describe('음수 값의 막대 색', () => {
    const PERIODS = ['2023', '2024'];
    const CASH_FLOW_SERIES = [
        {
            labelKo: '영업CF',
            values: [300, 400],
            color: 'bullish' as const,
        },
        {
            labelKo: 'FCF',
            values: [-100, 200],
            color: 'neutral' as const,
        },
        {
            labelKo: 'CapEx',
            values: [-200, -250],
            color: 'bearish' as const,
        },
    ];

    it('선언된 색을 가진 시리즈는 음수라도 그 색을 지킨다', () => {
        const { container } = render(
            <FinancialTrendChart
                periods={PERIODS}
                series={[
                    {
                        labelKo: 'FCF',
                        values: [-100, 200],
                        color: 'bullish' as const,
                    },
                ]}
            />
        );
        const bars = [...container.querySelectorAll('rect[rx="1"]')];
        expect(bars.length).toBe(2);
        // 음수 기간(첫 막대)도 bullish 채움이어야 한다.
        expect(bars[0].getAttribute('class')).toContain('fill-chart-bullish');
        expect(bars[0].getAttribute('class')).not.toContain(
            'fill-chart-bearish'
        );
    });

    it('중립 시리즈(FCF)의 음수 막대도 선언한 색을 지키고 baseline 아래로 그려진다', () => {
        const { container } = render(
            <FinancialTrendChart periods={PERIODS} series={CASH_FLOW_SERIES} />
        );
        const bars = [...container.querySelectorAll('rect[rx="1"]')];
        // 영업CF 2 + FCF 2 + CapEx 2
        expect(bars.length).toBe(6);
        const negativeFcf = bars[2];
        expect(negativeFcf.getAttribute('class')).toContain('fill-primary-500');
        expect(negativeFcf.getAttribute('class')).not.toContain(
            'fill-chart-bearish'
        );
        const baselineY = Number(
            container.querySelector('line')?.getAttribute('y1')
        );
        expect(Number(negativeFcf.getAttribute('y'))).toBe(baselineY);
        // CapEx는 선언한 대로 빨강이다.
        expect(bars[4].getAttribute('class')).toContain('fill-chart-bearish');
    });

    it('툴팁 점도 음수 FCF의 선언한 색을 지킨다', () => {
        const { container } = render(
            <FinancialTrendChart periods={PERIODS} series={CASH_FLOW_SERIES} />
        );
        const hits = container.querySelectorAll('rect.cursor-crosshair');
        fireEvent.pointerEnter(hits[0]!, { clientX: 10, clientY: 10 });

        const dots = screen
            .getByTestId('chart-tooltip')
            .querySelectorAll('li span span.rounded-full');
        expect(dots).toHaveLength(3);
        expect(dots[1].className).toContain('bg-primary-500');
        expect(dots[1].className).not.toContain('bg-chart-bearish');
    });
});
