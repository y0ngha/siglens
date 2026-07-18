import { render, screen } from '@testing-library/react';
import type { UseQueryResult } from '@tanstack/react-query';
import { useCurrentUser } from '@/entities/auth';
import { useSymbolHolding } from '@/features/portfolio-holding';
import type { AuthUserRecord } from '@/shared/lib/auth/types';
import type { PortfolioHoldingView } from '@/entities/portfolio';
import { PositionTabContent } from '../ui/PositionTabContent';

const { mockUseHydrated } = vi.hoisted(() => ({
    mockUseHydrated: vi.fn(),
}));

vi.mock('@/shared/hooks/useHydrated', () => ({
    useHydrated: () => mockUseHydrated(),
}));
vi.mock('@/entities/auth');
// PositionTabMemberContent (lazy, next/dynamic ssr:false) is the ONLY place
// useSymbolHolding lives — mocking the barrel lets guest-path tests assert
// the holdings query is never fired (chunk never mounted).
vi.mock('@/features/portfolio-holding');

const mockUseCurrentUser = vi.mocked(useCurrentUser);
const mockUseSymbolHolding = vi.mocked(useSymbolHolding);

type CurrentUserResult = UseQueryResult<AuthUserRecord | null>;

const USER = {
    id: 'u-1',
    email: 'me@example.com',
} as unknown as AuthUserRecord;

const AAPL_HOLDING: PortfolioHoldingView = {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    fmpSymbol: 'AAPL',
    quantity: '10',
    averagePrice: '150',
    updatedAt: '2026-01-02T00:00:00.000Z',
};

function setCurrentUser(
    data: AuthUserRecord | null | undefined,
    isLoading = false
) {
    mockUseCurrentUser.mockReturnValue({
        data,
        isLoading,
    } as unknown as CurrentUserResult);
}

describe('PositionTabContent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseSymbolHolding.mockReturnValue({
            holding: null,
            isHydrated: true,
            isLoading: false,
            isError: false,
            save: { mutateAsync: vi.fn() } as unknown as ReturnType<
                typeof useSymbolHolding
            >['save'],
        });
    });

    it('renders nothing before hydration (avoids SSR/CSR login-state mismatch)', () => {
        mockUseHydrated.mockReturnValue(false);
        setCurrentUser(undefined);
        const { container } = render(
            <PositionTabContent
                symbol="AAPL"
                low52w={100}
                high52w={200}
                lastClose={180}
            />
        );
        expect(container).toBeEmptyDOMElement();
        expect(mockUseSymbolHolding).not.toHaveBeenCalled();
    });

    it('shows a fixed-size skeleton while the login check is in flight', () => {
        mockUseHydrated.mockReturnValue(true);
        setCurrentUser(undefined, true);
        render(
            <PositionTabContent
                symbol="AAPL"
                low52w={100}
                high52w={200}
                lastClose={180}
            />
        );
        expect(screen.getByTestId('position-auth-loading')).toBeInTheDocument();
        expect(mockUseSymbolHolding).not.toHaveBeenCalled();
    });

    it('renders the CTA for a guest (data null) WITHOUT downloading the member chunk or firing the holdings query', () => {
        mockUseHydrated.mockReturnValue(true);
        setCurrentUser(null);
        render(
            <PositionTabContent
                symbol="AAPL"
                low52w={100}
                high52w={200}
                lastClose={180}
            />
        );
        expect(screen.getByTestId('position-cta')).toBeInTheDocument();
        expect(mockUseSymbolHolding).not.toHaveBeenCalled();
    });

    it('renders the range as neutral context text inside the guest CTA', () => {
        mockUseHydrated.mockReturnValue(true);
        setCurrentUser(null);
        render(
            <PositionTabContent
                symbol="AAPL"
                low52w={100}
                high52w={200}
                lastClose={180}
            />
        );
        expect(screen.getByTestId('position-cta-range')).toBeInTheDocument();
    });

    it('omits the range line in the guest CTA when the server-side range failed to resolve', () => {
        mockUseHydrated.mockReturnValue(true);
        setCurrentUser(null);
        render(
            <PositionTabContent
                symbol="AAPL"
                low52w={null}
                high52w={null}
                lastClose={null}
            />
        );
        expect(
            screen.queryByTestId('position-cta-range')
        ).not.toBeInTheDocument();
    });

    it('mounts the lazy member content (and fires the holdings query) for a resolved, present member', async () => {
        mockUseHydrated.mockReturnValue(true);
        setCurrentUser(USER);
        mockUseSymbolHolding.mockReturnValue({
            holding: AAPL_HOLDING,
            isHydrated: true,
            isLoading: false,
            isError: false,
            save: { mutateAsync: vi.fn() } as unknown as ReturnType<
                typeof useSymbolHolding
            >['save'],
        });
        render(
            <PositionTabContent
                symbol="AAPL"
                low52w={100}
                high52w={200}
                lastClose={180}
            />
        );
        // PositionTabMemberContent is next/dynamic(ssr:false)-loaded — it mounts
        // asynchronously, so assert via findBy* rather than a synchronous query.
        expect(
            await screen.findByTestId('position-member-content')
        ).toBeInTheDocument();
        expect(mockUseSymbolHolding).toHaveBeenCalledWith('AAPL');
    });
});
