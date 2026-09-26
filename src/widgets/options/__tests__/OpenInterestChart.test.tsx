import { render, screen, fireEvent, within } from '@testing-library/react';
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
    daysToExpiration: 30,
    maxPain: 150,
    maxPainDistancePct: null,
    putCallRatio: 0.8,
    atmImpliedVolatility: 0.35,
    impliedMovePercent: 4.2,
    impliedMoveRange: null,
    topOpenInterestStrikes: [],
    topVolumeStrikes: [],
    topOiBidAskSummary: [],
};

function makeContract(
    strike: number,
    openInterest: number,
    isCall: boolean
): OptionsChain['calls'][number] {
    return {
        strike,
        bid: 1,
        ask: 1.1,
        openInterest,
        volume: 10,
        impliedVolatility: 0.3,
        lastPrice: 1.05,
        inTheMoney: false,
        contractSymbol: `${isCall ? 'C' : 'P'}${strike}`,
    };
}

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

    it('renders empty state when the chain has no strikes at all', () => {
        const noStrikesChain: OptionsChain = {
            expirationDate: '2025-06-20',
            daysToExpiration: 30,
            calls: [],
            puts: [],
        };
        render(
            <OpenInterestChart
                underlyingPrice={150}
                chain={noStrikesChain}
                metrics={null}
            />
        );
        expect(screen.getByText(/OI 데이터가 없어요/)).toBeInTheDocument();
    });

    it('renders empty state when every strike has zero OI on both sides', () => {
        const zeroOiChain: OptionsChain = {
            expirationDate: '2025-06-20',
            daysToExpiration: 30,
            calls: [makeContract(140, 0, true), makeContract(150, 0, true)],
            puts: [makeContract(140, 0, false), makeContract(150, 0, false)],
        };
        render(
            <OpenInterestChart
                underlyingPrice={150}
                chain={zeroOiChain}
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

    it('차트 SVG는 <title> 없이 aria-label로 이름을 준다(크롤러 중복 제목 방지)', () => {
        const { container } = render(
            <OpenInterestChart
                underlyingPrice={150}
                chain={CHAIN}
                metrics={METRICS}
            />
        );
        const svg = container.querySelector('svg')!;
        expect(svg.querySelector('title')).toBeNull();
        expect(svg).toHaveAttribute(
            'aria-label',
            'Strike별 Open Interest 분포'
        );
        expect(svg).toHaveAttribute('aria-describedby', 'oi-chart-desc');
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

    it('hovering (pointerEnter + pointerMove) a strike bar shows its Call/Put OI in the floating tooltip', () => {
        const { container } = render(
            <OpenInterestChart
                underlyingPrice={150}
                chain={CHAIN}
                metrics={METRICS}
            />
        );
        // Tooltip is hidden before any hover.
        const tooltip = screen.getByRole('tooltip', { hidden: true });
        expect(tooltip).toHaveAttribute('hidden');

        // The invisible hit-target `<rect>` per strike carries the shared
        // `aria-describedby` id — the last matching rect corresponds to the
        // strike=150 row (openInterest 1000 call / 800 put).
        const hitRects = container.querySelectorAll(
            'rect[aria-describedby="oi-chart-tooltip"]'
        );
        const strike150Rect = hitRects[1]!;
        fireEvent.pointerEnter(strike150Rect, { clientX: 10, clientY: 10 });
        fireEvent.pointerMove(strike150Rect, { clientX: 12, clientY: 12 });

        expect(tooltip).not.toHaveAttribute('hidden');
        expect(within(tooltip).getByText('Strike $150')).toBeInTheDocument();
        expect(within(tooltip).getByText('Call OI')).toBeInTheDocument();
        expect(within(tooltip).getByText('Put OI')).toBeInTheDocument();
    });

    it('pointerLeave hides the tooltip again', () => {
        const { container } = render(
            <OpenInterestChart
                underlyingPrice={150}
                chain={CHAIN}
                metrics={METRICS}
            />
        );
        const tooltip = screen.getByRole('tooltip', { hidden: true });
        const hitRects = container.querySelectorAll(
            'rect[aria-describedby="oi-chart-tooltip"]'
        );
        const strike150Rect = hitRects[1]!;
        fireEvent.pointerEnter(strike150Rect, { clientX: 10, clientY: 10 });
        expect(tooltip).not.toHaveAttribute('hidden');

        fireEvent.pointerLeave(strike150Rect);
        expect(tooltip).toHaveAttribute('hidden');
    });

    it('rotates x-axis strike labels (-45deg) once more than 7 labels are shown', () => {
        const manyStrikesChain: OptionsChain = {
            expirationDate: '2025-06-20',
            daysToExpiration: 30,
            calls: Array.from({ length: 9 }, (_, i) =>
                makeContract(100 + i * 10, 100 + i, true)
            ),
            puts: Array.from({ length: 9 }, (_, i) =>
                makeContract(100 + i * 10, 50 + i, false)
            ),
        };
        const { container } = render(
            <OpenInterestChart
                underlyingPrice={150}
                chain={manyStrikesChain}
                metrics={null}
            />
        );
        const rotated = container.querySelectorAll('text[transform]');
        expect(rotated.length).toBeGreaterThan(0);
        expect(rotated[0]).toHaveAttribute('text-anchor', 'end');
    });
});
