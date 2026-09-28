import { render, screen, fireEvent, within } from '@testing-library/react';
import { StrikeVolumeChart } from '@/widgets/options/StrikeVolumeChart';
import type { OptionsChain } from '@y0ngha/siglens-core';

vi.mock('@/shared/ui/InfoTooltip', () => ({
    InfoTooltip: ({ children }: { children: React.ReactNode }) => (
        <span>{children}</span>
    ),
}));

vi.mock('@/widgets/options/utils/aggregateStrikeVolume', () => ({
    aggregateStrikeVolume: (chain: {
        calls: Array<{ strike: number; volume: number }>;
        puts: Array<{ strike: number; volume: number }>;
    }) =>
        chain.calls.map(c => ({
            strike: c.strike,
            callVolume: c.volume,
            putVolume: chain.puts.find(p => p.strike === c.strike)?.volume ?? 0,
        })),
}));

vi.mock('@/widgets/options/utils/computeTooltipPos', () => ({
    computeTooltipPos: () => ({ x: 100, y: 100 }),
    TOOLTIP_MIN_WIDTH_PX: 160,
}));

vi.mock('@/widgets/options/utils/formatCompactCount', () => ({
    formatCompactCount: (v: number) => `${v}`,
}));

vi.mock('@/widgets/options/utils/pickLabelIndices', () => ({
    pickLabelIndices: (count: number) =>
        new Set(Array.from({ length: count }, (_, i) => i)),
}));

vi.mock('@/widgets/options/utils/optionsTooltips', () => ({
    CallVolumeTooltip: 'Call vol',
    PutVolumeTooltip: 'Put vol',
}));

vi.mock('@/widgets/options/utils/chartLabelOffsets', () => ({
    PEAK_LABEL_TOP_OFFSET_PX: 4,
    CALL_LABEL_MIDLINE_OFFSET_PX: 6,
    PUT_LABEL_MIDLINE_OFFSET_PX: 14,
}));

vi.mock('@/widgets/options/utils/chartStrokeWidths', () => ({
    MIDLINE_STROKE_WIDTH: 1,
    GUIDE_LINE_STROKE_WIDTH: 1.5,
}));

vi.mock('@/entities/options-chain', () => ({
    findNearestStrikeIndex: () => 0,
}));

const CHAIN: OptionsChain = {
    expirationDate: '2025-06-20',
    daysToExpiration: 30,
    calls: [
        {
            strike: 150,
            bid: 5,
            ask: 6,
            openInterest: 1000,
            volume: 500,
            impliedVolatility: 0.35,
            lastPrice: 5.5,
            inTheMoney: true,
            contractSymbol: 'C150',
        },
    ],
    puts: [
        {
            strike: 150,
            bid: 4,
            ask: 5,
            openInterest: 800,
            volume: 300,
            impliedVolatility: 0.32,
            lastPrice: 4.5,
            inTheMoney: false,
            contractSymbol: 'P150',
        },
    ],
};

describe('StrikeVolumeChart', () => {
    it('renders empty state when chain is null', () => {
        render(<StrikeVolumeChart underlyingPrice={150} chain={null} />);
        expect(screen.getByText(/거래량 데이터가 없어요/)).toBeInTheDocument();
    });

    it('renders empty state when the chain has no strikes at all', () => {
        const noStrikesChain: OptionsChain = {
            expirationDate: '2025-06-20',
            daysToExpiration: 30,
            calls: [],
            puts: [],
        };
        render(
            <StrikeVolumeChart underlyingPrice={150} chain={noStrikesChain} />
        );
        expect(screen.getByText(/거래량 데이터가 없어요/)).toBeInTheDocument();
    });

    it('renders empty state when every strike has zero volume on both sides', () => {
        const zeroVolumeChain: OptionsChain = {
            expirationDate: '2025-06-20',
            daysToExpiration: 30,
            calls: [
                {
                    strike: 150,
                    bid: 5,
                    ask: 6,
                    openInterest: 1000,
                    volume: 0,
                    impliedVolatility: 0.35,
                    lastPrice: 5.5,
                    inTheMoney: true,
                    contractSymbol: 'C150',
                },
            ],
            puts: [
                {
                    strike: 150,
                    bid: 4,
                    ask: 5,
                    openInterest: 800,
                    volume: 0,
                    impliedVolatility: 0.32,
                    lastPrice: 4.5,
                    inTheMoney: false,
                    contractSymbol: 'P150',
                },
            ],
        };
        render(
            <StrikeVolumeChart underlyingPrice={150} chain={zeroVolumeChain} />
        );
        expect(screen.getByText(/거래량 데이터가 없어요/)).toBeInTheDocument();
    });

    it('renders SVG chart with data', () => {
        const { container } = render(
            <StrikeVolumeChart underlyingPrice={150} chain={CHAIN} />
        );
        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders chart title', () => {
        render(<StrikeVolumeChart underlyingPrice={150} chain={CHAIN} />);
        expect(screen.getByText('Volume 분포 (Strike별)')).toBeInTheDocument();
    });

    it('renders legend items', () => {
        render(<StrikeVolumeChart underlyingPrice={150} chain={CHAIN} />);
        expect(screen.getByText('Call Vol')).toBeInTheDocument();
        expect(screen.getByText('Put Vol')).toBeInTheDocument();
        expect(screen.getByText('현재가')).toBeInTheDocument();
    });

    it('차트 SVG는 <title> 없이 aria-label로 이름을 준다(크롤러 중복 제목 방지)', () => {
        const { container } = render(
            <StrikeVolumeChart underlyingPrice={150} chain={CHAIN} />
        );
        const svg = container.querySelector('svg')!;
        expect(svg.querySelector('title')).toBeNull();
        expect(svg).toHaveAttribute('aria-label', 'Strike별 거래량 분포');
        expect(svg).toHaveAttribute('aria-describedby', 'volume-chart-desc');
    });

    it('renders sr-only table', () => {
        render(<StrikeVolumeChart underlyingPrice={150} chain={CHAIN} />);
        const table = screen.getByRole('table', { hidden: true });
        expect(table).toBeInTheDocument();
    });

    it('hovering (pointerEnter + pointerMove) a strike bar shows its Call/Put volume in the floating tooltip', () => {
        const { container } = render(
            <StrikeVolumeChart underlyingPrice={150} chain={CHAIN} />
        );
        const tooltip = screen.getByRole('tooltip', { hidden: true });
        expect(tooltip).toHaveAttribute('hidden');

        const hitRect = container.querySelector(
            'rect[aria-describedby="volume-chart-tooltip"]'
        )!;
        fireEvent.pointerEnter(hitRect, { clientX: 5, clientY: 5 });
        fireEvent.pointerMove(hitRect, { clientX: 7, clientY: 7 });

        expect(tooltip).not.toHaveAttribute('hidden');
        expect(within(tooltip).getByText('Strike $150')).toBeInTheDocument();
        expect(within(tooltip).getByText('Call Vol')).toBeInTheDocument();
        expect(within(tooltip).getByText('Put Vol')).toBeInTheDocument();
    });

    it('pointerLeave hides the tooltip again', () => {
        const { container } = render(
            <StrikeVolumeChart underlyingPrice={150} chain={CHAIN} />
        );
        const tooltip = screen.getByRole('tooltip', { hidden: true });
        const hitRect = container.querySelector(
            'rect[aria-describedby="volume-chart-tooltip"]'
        )!;
        fireEvent.pointerEnter(hitRect, { clientX: 5, clientY: 5 });
        expect(tooltip).not.toHaveAttribute('hidden');

        fireEvent.pointerLeave(hitRect);
        expect(tooltip).toHaveAttribute('hidden');
    });

    it('rotates x-axis strike labels (-45deg) once more than 7 labels are shown', () => {
        const manyStrikesChain: OptionsChain = {
            expirationDate: '2025-06-20',
            daysToExpiration: 30,
            calls: Array.from({ length: 9 }, (_, i) => ({
                strike: 100 + i * 10,
                bid: 1,
                ask: 1.1,
                openInterest: 10,
                volume: 100 + i,
                impliedVolatility: 0.3,
                lastPrice: 1.05,
                inTheMoney: false,
                contractSymbol: `C${100 + i * 10}`,
            })),
            puts: Array.from({ length: 9 }, (_, i) => ({
                strike: 100 + i * 10,
                bid: 1,
                ask: 1.1,
                openInterest: 10,
                volume: 50 + i,
                impliedVolatility: 0.3,
                lastPrice: 1.05,
                inTheMoney: false,
                contractSymbol: `P${100 + i * 10}`,
            })),
        };
        const { container } = render(
            <StrikeVolumeChart underlyingPrice={150} chain={manyStrikesChain} />
        );
        const rotated = container.querySelectorAll('text[transform]');
        expect(rotated.length).toBeGreaterThan(0);
        expect(rotated[0]).toHaveAttribute('text-anchor', 'end');
    });
});
