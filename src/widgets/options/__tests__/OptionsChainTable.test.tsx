import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OptionsChainTable } from '@/widgets/options/OptionsChainTable';
import type {
    OptionsChain,
    OptionsExpirationMetrics,
} from '@y0ngha/siglens-core';

vi.mock('@/shared/ui/InfoTooltip', () => ({
    InfoTooltip: ({ children }: { children: React.ReactNode }) => (
        <span>{children}</span>
    ),
}));

vi.mock('@/widgets/options/utils/optionsTooltips', () => ({
    OpenInterestTooltip: 'OI',
}));

vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
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
    findNearestStrikeIndex: (strikes: number[], target: number) =>
        strikes.indexOf(
            strikes.reduce((a, b) =>
                Math.abs(b - target) < Math.abs(a - target) ? b : a
            )
        ),
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
            volume: 200,
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
describe('OptionsChainTable', () => {
    it('renders 0 contracts when chain is null', () => {
        render(
            <OptionsChainTable
                symbol="AAPL"
                expirationDate="2025-06-20"
                underlyingPrice={150}
                chain={null}
                metrics={null}
                nearestExpiry="2025-06-20"
            />
        );
        expect(screen.getByText(/0 contracts/)).toBeInTheDocument();
    });

    it('renders the expand button with contract count', () => {
        render(
            <OptionsChainTable
                symbol="AAPL"
                expirationDate="2025-06-20"
                underlyingPrice={150}
                chain={CHAIN}
                metrics={METRICS}
                nearestExpiry="2025-06-20"
            />
        );
        expect(screen.getByText(/2 contracts/)).toBeInTheDocument();
    });

    it('expands the table on button click', async () => {
        const user = userEvent.setup();
        render(
            <OptionsChainTable
                symbol="AAPL"
                expirationDate="2025-06-20"
                underlyingPrice={150}
                chain={CHAIN}
                metrics={METRICS}
                nearestExpiry="2025-06-20"
            />
        );

        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('aria-expanded', 'false');

        await user.click(button);
        expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('does not render aggregate note for specific expiration (collapsed)', () => {
        render(
            <OptionsChainTable
                symbol="AAPL"
                expirationDate="2025-06-20"
                underlyingPrice={150}
                chain={CHAIN}
                metrics={METRICS}
                nearestExpiry="2025-06-20"
            />
        );
        expect(screen.queryByText(/전체 만기 합산/)).not.toBeInTheDocument();
    });
});
