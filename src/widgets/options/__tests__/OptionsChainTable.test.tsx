import { render, screen, within } from '@testing-library/react';
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
        // Union of call+put strikes, matching the real aggregateOpenInterest
        // contract — a strike that only has a put quote (or vice versa) must
        // still surface as a row so OptionsChainTable's null-fallback cells
        // ('—') are exercised on both sides.
        aggregateOpenInterest: (chain: {
            calls: Array<{ strike: number; openInterest: number }>;
            puts: Array<{ strike: number; openInterest: number }>;
        }) => {
            const strikes = [
                ...new Set([
                    ...chain.calls.map(c => c.strike),
                    ...chain.puts.map(p => p.strike),
                ]),
            ].toSorted((a, b) => a - b);
            return strikes.map(strike => ({
                strike,
                callOpenInterest:
                    chain.calls.find(c => c.strike === strike)?.openInterest ??
                    0,
                putOpenInterest:
                    chain.puts.find(p => p.strike === strike)?.openInterest ??
                    0,
            }));
        },
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

    it('shows the chain expiration date in the header once expanded', async () => {
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
        await user.click(button);
        expect(button).toHaveTextContent('선택된 만기: 2025-06-20');
    });

    it('renders the aggregate-expiry note when expirationDate is "all" and expanded', async () => {
        const user = userEvent.setup();
        render(
            <OptionsChainTable
                symbol="AAPL"
                expirationDate="all"
                underlyingPrice={150}
                chain={CHAIN}
                metrics={METRICS}
                nearestExpiry="2025-06-20"
            />
        );
        await user.click(screen.getByRole('button'));
        expect(screen.getByText(/전체 만기 합산/)).toBeInTheDocument();
    });

    it('shows "—" placeholders for a strike missing a call or put side', async () => {
        const user = userEvent.setup();
        const chainWithMismatchedStrikes: OptionsChain = {
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
                {
                    strike: 160,
                    bid: 1,
                    ask: 1.5,
                    openInterest: 200,
                    volume: 50,
                    impliedVolatility: 0.4,
                    lastPrice: 1.2,
                    inTheMoney: false,
                    contractSymbol: 'C160',
                },
                {
                    // Non-integer strike + no bid/ask quote posted at all —
                    // exercises formatStrike's decimal branch and
                    // formatBidAsk's both-null branch.
                    strike: 152.5,
                    bid: null,
                    ask: null,
                    openInterest: 10,
                    volume: 1,
                    impliedVolatility: null,
                    lastPrice: 1.0,
                    inTheMoney: false,
                    contractSymbol: 'C152.5',
                },
                {
                    // Only a bid is posted (no ask) — exercises
                    // formatBidAsk's per-side null fallback (as opposed to
                    // the both-null early return above).
                    strike: 155,
                    bid: 0.5,
                    ask: null,
                    openInterest: 5,
                    volume: 1,
                    impliedVolatility: 0.33,
                    lastPrice: 0.5,
                    inTheMoney: false,
                    contractSymbol: 'C155',
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
                {
                    // Strike 140 only has a put side — exercises the "call
                    // undefined" fallback cells.
                    strike: 140,
                    bid: 2,
                    ask: 2.5,
                    openInterest: 300,
                    volume: 20,
                    impliedVolatility: 0.29,
                    lastPrice: 2.2,
                    inTheMoney: true,
                    contractSymbol: 'P140',
                },
            ],
        };
        render(
            <OptionsChainTable
                symbol="AAPL"
                expirationDate="2025-06-20"
                underlyingPrice={150}
                chain={chainWithMismatchedStrikes}
                metrics={METRICS}
                nearestExpiry="2025-06-20"
            />
        );
        await user.click(screen.getByRole('button'));

        // Strike 160 only has a call side — the put cells for that row must
        // fall back to the em-dash placeholder instead of throwing or
        // rendering "undefined".
        const row160 = screen.getByText('$160').closest('tr')!;
        const cells160 = within(row160).getAllByRole('cell');
        // [strike, call bid/ask, call OI, call IV, put bid/ask, put OI, put IV]
        expect(cells160[4]).toHaveTextContent('—');
        expect(cells160[5]).toHaveTextContent('—');
        expect(cells160[6]).toHaveTextContent('—');

        // Strike 140 only has a put side — the call cells fall back too.
        const row140 = screen.getByText('$140').closest('tr')!;
        const cells140 = within(row140).getAllByRole('cell');
        expect(cells140[1]).toHaveTextContent('—');
        expect(cells140[2]).toHaveTextContent('—');
        expect(cells140[3]).toHaveTextContent('—');

        // Strike 152.5 is a non-integer strike with no bid/ask quote posted
        // and no IV — its price/IV cells collapse to the placeholder.
        const row1525 = screen.getByText('$152.5').closest('tr')!;
        const cells1525 = within(row1525).getAllByRole('cell');
        expect(cells1525[1]).toHaveTextContent('—');
        expect(cells1525[3]).toHaveTextContent('—');

        // Strike 155 has a bid but no ask — the per-side (not both-null)
        // fallback renders "$0.50/—" rather than collapsing the whole cell.
        const row155 = screen.getByText('$155').closest('tr')!;
        const cells155 = within(row155).getAllByRole('cell');
        expect(cells155[1]).toHaveTextContent('$0.50/—');
    });
});
