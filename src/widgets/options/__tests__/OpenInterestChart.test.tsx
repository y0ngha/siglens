import { render, screen } from '@testing-library/react';
import { OpenInterestChart } from '@/widgets/options/OpenInterestChart';
import type {
    OptionsChain,
    OptionsExpirationMetrics,
} from '@y0ngha/siglens-core';

vi.mock('@/shared/ui/InfoTooltip', () => ({
    InfoTooltip: ({ children }: { children: React.ReactNode }) => (
        <span>{children}</span>
    ),
}));

vi.mock('@y0ngha/siglens-core', async importOriginal => {
    const mod = (await importOriginal()) as Record<string, unknown>;
    return {
        ...mod,
        aggregateOpenInterest: (chain: {
            calls: Array<{ strike: number; openInterest: number }>;
            puts: Array<{ strike: number; openInterest: number }>;
        }) =>
            chain.calls.map(c => ({
                strike: c.strike,
                callOpenInterest: c.openInterest,
                putOpenInterest:
                    chain.puts.find(p => p.strike === c.strike)?.openInterest ??
                    0,
            })),
    };
});

vi.mock('@/entities/options-chain', () => ({
    findNearestStrikeIndex: (strikes: number[], target: number) => {
        let idx = 0;
        let minDiff = Infinity;
        for (let i = 0; i < strikes.length; i++) {
            const diff = Math.abs(strikes[i]! - target);
            if (diff < minDiff) {
                minDiff = diff;
                idx = i;
            }
        }
        return idx;
    },
}));

vi.mock('@/widgets/options/utils/computeTooltipPos', () => ({
    computeTooltipPos: () => ({ x: 100, y: 100 }),
    TOOLTIP_ELEMENT_ID: 'oi-chart-tooltip',
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
    OpenInterestTooltip: 'OI tooltip',
    CallOpenInterestTooltip: 'Call OI tooltip',
    PutOpenInterestTooltip: 'Put OI tooltip',
}));

vi.mock('@/widgets/options/utils/chartLabelOffsets', () => ({
    PEAK_LABEL_TOP_OFFSET_PX: 4,
    CALL_LABEL_MIDLINE_OFFSET_PX: 6,
    PUT_LABEL_MIDLINE_OFFSET_PX: 14,
}));

vi.mock('@/widgets/options/utils/chartStrokeWidths', () => ({
    GUIDE_LINE_STROKE_WIDTH: 1.5,
    MIDLINE_STROKE_WIDTH: 1,
}));

const CHAIN: OptionsChain = {
    expirationDate: '2025-06-20',
    daysToExpiration: 30,
    calls: [
        {
            strike: 140,
            bid: 10,
            ask: 11,
            openInterest: 500,
            volume: 100,
            impliedVolatility: 0.3,
            lastPrice: 10.5,
            inTheMoney: true,
            contractSymbol: 'C140',
        },
        {
            strike: 150,
            bid: 5,
            ask: 6,
            openInterest: 1000,
            volume: 200,
            impliedVolatility: 0.35,
            lastPrice: 5.5,
            inTheMoney: true,
            contractSymbol: 'C150',
        },
    ],
    puts: [
        {
            strike: 140,
            bid: 3,
            ask: 4,
            openInterest: 300,
            volume: 50,
            impliedVolatility: 0.28,
            lastPrice: 3.5,
            inTheMoney: false,
            contractSymbol: 'P140',
        },
        {
            strike: 150,
            bid: 4,
            ask: 5,
            openInterest: 800,
            volume: 150,
            impliedVolatility: 0.32,
            lastPrice: 4.5,
            inTheMoney: false,
            contractSymbol: 'P150',
        },
    ],
};

const METRICS: OptionsExpirationMetrics = {
    expirationDate: '2025-06-20',
    maxPain: 150,
    putCallRatio: 0.8,
    atmImpliedVolatility: 0.35,
    impliedMovePercent: 4.2,
    topOpenInterestStrikes: [],
    topVolumeStrikes: [],
    topOiBidAskSummary: [],
};
describe('OpenInterestChart', () => {
    it('renders empty state when chain is null', () => {
        render(
            <OpenInterestChart
                underlyingPrice={150}
                chain={null}
                metrics={null}
            />
        );
        expect(screen.getByText(/OI 데이터가 없어요/)).toBeInTheDocument();
    });

    it('renders the chart with SVG when chain has data', () => {
        const { container } = render(
            <OpenInterestChart
                underlyingPrice={150}
                chain={CHAIN}
                metrics={METRICS}
            />
        );
        const svg = container.querySelector('svg');
        expect(svg).toBeInTheDocument();
    });

    it('renders chart title', () => {
        render(
            <OpenInterestChart
                underlyingPrice={150}
                chain={CHAIN}
                metrics={METRICS}
            />
        );
        expect(
            screen.getByText('Open Interest 분포 (Strike별)')
        ).toBeInTheDocument();
    });

    it('renders accessible sr-only table with strike data', () => {
        render(
            <OpenInterestChart
                underlyingPrice={150}
                chain={CHAIN}
                metrics={METRICS}
            />
        );
        const table = screen.getByRole('table', { hidden: true });
        expect(table).toBeInTheDocument();
    });

    it('renders legend items', () => {
        render(
            <OpenInterestChart
                underlyingPrice={150}
                chain={CHAIN}
                metrics={METRICS}
            />
        );
        expect(screen.getByText('Max Pain')).toBeInTheDocument();
        expect(screen.getByText('현재가')).toBeInTheDocument();
    });
});
