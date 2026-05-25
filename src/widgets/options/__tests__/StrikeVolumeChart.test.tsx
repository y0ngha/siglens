import { render, screen } from '@testing-library/react';
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

    it('renders sr-only table', () => {
        render(<StrikeVolumeChart underlyingPrice={150} chain={CHAIN} />);
        const table = screen.getByRole('table', { hidden: true });
        expect(table).toBeInTheDocument();
    });
});
