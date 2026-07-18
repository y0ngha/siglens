import { render, screen } from '@testing-library/react';
import { useSymbolHolding } from '@/features/portfolio-holding';
import type { PortfolioHoldingView } from '@/entities/portfolio';
import { PositionTabMemberContent } from '../ui/PositionTabMemberContent';

vi.mock('@/features/portfolio-holding');

const mockUseSymbolHolding = vi.mocked(useSymbolHolding);

const AAPL_HOLDING: PortfolioHoldingView = {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    fmpSymbol: 'AAPL',
    quantity: '10',
    averagePrice: '150',
    updatedAt: '2026-01-02T00:00:00.000Z',
};

type HoldingResult = ReturnType<typeof useSymbolHolding>;

function setHolding(overrides: Partial<HoldingResult>) {
    const base: HoldingResult = {
        holding: null,
        isHydrated: true,
        isLoading: false,
        isError: false,
        save: { mutateAsync: vi.fn() } as unknown as HoldingResult['save'],
    };
    mockUseSymbolHolding.mockReturnValue({ ...base, ...overrides });
}

describe('PositionTabMemberContent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows a loading skeleton while the holdings query is in flight', () => {
        setHolding({ isLoading: true });
        render(
            <PositionTabMemberContent
                symbol="AAPL"
                low52w={100}
                high52w={200}
                lastClose={180}
            />
        );
        expect(screen.getByTestId('position-loading')).toBeInTheDocument();
    });

    it('renders the building + card when a holding exists and the range is geometrically valid', () => {
        setHolding({ holding: AAPL_HOLDING });
        render(
            <PositionTabMemberContent
                symbol="AAPL"
                low52w={100}
                high52w={200}
                lastClose={180}
            />
        );
        expect(
            screen.getByTestId('position-member-content')
        ).toBeInTheDocument();
        expect(screen.getByTestId('position-building')).toBeInTheDocument();
        expect(screen.getByText('내 위치')).toBeInTheDocument();
    });

    it('renders the CTA (not the building) when the member has no holding for this symbol', () => {
        setHolding({ holding: null });
        render(
            <PositionTabMemberContent
                symbol="AAPL"
                low52w={100}
                high52w={200}
                lastClose={180}
            />
        );
        expect(screen.getByTestId('position-cta')).toBeInTheDocument();
        expect(
            screen.queryByTestId('position-building')
        ).not.toBeInTheDocument();
    });

    it('degrades to the CTA (never throws) when the holdings query errors', () => {
        setHolding({ holding: null, isError: true });
        render(
            <PositionTabMemberContent
                symbol="AAPL"
                low52w={100}
                high52w={200}
                lastClose={180}
            />
        );
        expect(screen.getByTestId('position-cta')).toBeInTheDocument();
    });

    it('shows a "데이터 부족" note when the server-side price range failed to resolve', () => {
        setHolding({ holding: AAPL_HOLDING });
        render(
            <PositionTabMemberContent
                symbol="AAPL"
                low52w={null}
                high52w={null}
                lastClose={null}
            />
        );
        expect(
            screen.getByTestId('position-data-insufficient')
        ).toBeInTheDocument();
    });

    it('shows a "데이터 부족" note when computePosition returns null (e.g. high <= low)', () => {
        setHolding({
            holding: { ...AAPL_HOLDING, averagePrice: '150' },
        });
        render(
            <PositionTabMemberContent
                symbol="AAPL"
                low52w={200}
                high52w={100}
                lastClose={180}
            />
        );
        expect(
            screen.getByTestId('position-data-insufficient')
        ).toBeInTheDocument();
    });
});
