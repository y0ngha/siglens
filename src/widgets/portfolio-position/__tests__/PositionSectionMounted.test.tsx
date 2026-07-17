import { render, screen, waitFor } from '@testing-library/react';
import type { UseQueryResult } from '@tanstack/react-query';
import { useCurrentUser } from '@/entities/auth';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { useSymbolHolding } from '@/features/portfolio-holding/hooks/useSymbolHolding';
import type { UseSymbolHoldingReturn } from '@/features/portfolio-holding/hooks/useSymbolHolding';
import type { PortfolioHoldingView } from '@/entities/portfolio';
import type { AuthUserRecord } from '@/shared/lib/auth/types';
import { PositionSectionMounted } from '../ui/PositionSectionMounted';

vi.mock('@/entities/auth');
vi.mock('@/shared/hooks/useHydrated');
vi.mock('@/features/portfolio-holding/hooks/useSymbolHolding');

const mockUseCurrentUser = vi.mocked(useCurrentUser);
const mockUseHydrated = vi.mocked(useHydrated);
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
    quantity: '10.00000000',
    averagePrice: '150.00000000',
    updatedAt: '2026-01-02T00:00:00.000Z',
};

function setCurrentUser(data: AuthUserRecord | null | undefined) {
    mockUseCurrentUser.mockReturnValue({
        data,
    } as unknown as CurrentUserResult);
}

function setHolding(overrides: Partial<UseSymbolHoldingReturn>) {
    mockUseSymbolHolding.mockReturnValue({
        holding: null,
        isHydrated: true,
        isLoading: false,
        isError: false,
        save: {
            mutateAsync: vi.fn(),
            isPending: false,
        } as unknown as UseSymbolHoldingReturn['save'],
        ...overrides,
    });
}

const RANGE_PROPS = {
    symbol: 'AAPL',
    low52w: 100,
    high52w: 200,
    lastClose: 180,
};

describe('PositionSectionMounted', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseHydrated.mockReturnValue(true);
        setHolding({});
    });

    it('hydrate 되기 전에는 아무것도 렌더하지 않고 내부(PositionSection) 청크를 마운트하지 않는다', () => {
        mockUseHydrated.mockReturnValue(false);
        setCurrentUser(USER);
        const { container } = render(
            <PositionSectionMounted {...RANGE_PROPS} />
        );
        expect(container.firstChild).toBeNull();
        // The outer gate returns null before rendering the lazy-loaded inner
        // component, so useSymbolHolding (only called inside PositionSection)
        // is never invoked — no getPortfolioHoldingsAction fetch is fired.
        expect(mockUseSymbolHolding).not.toHaveBeenCalled();
    });

    it('비회원(guest, useCurrentUser data=null)이면 아무것도 렌더하지 않고 내부 청크를 마운트하지 않는다', () => {
        setCurrentUser(null);
        const { container } = render(
            <PositionSectionMounted {...RANGE_PROPS} />
        );
        expect(container.firstChild).toBeNull();
        expect(mockUseSymbolHolding).not.toHaveBeenCalled();
    });

    it('로그인 판별 전(data=undefined)이면 아무것도 렌더하지 않고 내부 청크를 마운트하지 않는다', () => {
        setCurrentUser(undefined);
        const { container } = render(
            <PositionSectionMounted {...RANGE_PROPS} />
        );
        expect(container.firstChild).toBeNull();
        expect(mockUseSymbolHolding).not.toHaveBeenCalled();
    });

    it('회원이지만 이 심볼의 보유 내역이 없으면(holding=null) 아무것도 렌더하지 않는다', async () => {
        setCurrentUser(USER);
        setHolding({ holding: null });
        render(<PositionSectionMounted {...RANGE_PROPS} />);
        // PositionSection is next/dynamic(ssr:false)-loaded, so it mounts
        // asynchronously — wait for the lazy chunk to resolve before asserting.
        await waitFor(() => expect(mockUseSymbolHolding).toHaveBeenCalled());
        expect(screen.queryByText('내 위치')).not.toBeInTheDocument();
    });

    it('범위가 degenerate(high<=low)해 computePosition이 null이면 아무것도 렌더하지 않는다', async () => {
        setCurrentUser(USER);
        setHolding({ holding: AAPL_HOLDING });
        render(
            <PositionSectionMounted
                symbol="AAPL"
                low52w={100}
                high52w={100}
                lastClose={100}
            />
        );
        await waitFor(() => expect(mockUseSymbolHolding).toHaveBeenCalled());
        expect(screen.queryByText('내 위치')).not.toBeInTheDocument();
    });

    it('회원 + 보유 내역 + 유효한 범위이면 내부 청크를 lazy-load해 카드를 렌더한다', async () => {
        setCurrentUser(USER);
        setHolding({ holding: AAPL_HOLDING });
        render(<PositionSectionMounted {...RANGE_PROPS} />);
        expect(await screen.findByText('내 위치')).toBeInTheDocument();
    });
});
