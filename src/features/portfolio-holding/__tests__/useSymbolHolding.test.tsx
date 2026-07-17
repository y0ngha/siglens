import { renderHook } from '@testing-library/react';
import { usePortfolioHoldings } from '@/entities/portfolio/hooks/usePortfolioHoldings';
import type { PortfolioHoldingView } from '@/entities/portfolio';
import { useSymbolHolding } from '@/features/portfolio-holding/hooks/useSymbolHolding';

vi.mock('@/entities/portfolio/hooks/usePortfolioHoldings');

const mockUsePortfolioHoldings = vi.mocked(usePortfolioHoldings);

const AAPL_HOLDING: PortfolioHoldingView = {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    fmpSymbol: 'AAPL',
    quantity: '10.00000000',
    averagePrice: '150.50000000',
    updatedAt: '2026-01-02T00:00:00.000Z',
};

type Holdings = ReturnType<typeof usePortfolioHoldings>;

function setHoldings(overrides: Partial<Holdings>) {
    const base: Holdings = {
        holdings: [],
        isHydrated: true,
        isLoading: false,
        save: {
            mutateAsync: vi.fn(),
            isPending: false,
        } as unknown as Holdings['save'],
        remove: {
            mutateAsync: vi.fn(),
            isPending: false,
        } as unknown as Holdings['remove'],
    };
    mockUsePortfolioHoldings.mockReturnValue({ ...base, ...overrides });
}

describe('useSymbolHolding', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns the matching holding for an exact-case symbol', () => {
        setHoldings({ holdings: [AAPL_HOLDING] });
        const { result } = renderHook(() => useSymbolHolding('AAPL'));
        expect(result.current.holding).toEqual(AAPL_HOLDING);
    });

    it('matches case-insensitively (lowercase route param against uppercase stored symbol)', () => {
        setHoldings({ holdings: [AAPL_HOLDING] });
        const { result } = renderHook(() => useSymbolHolding('aapl'));
        expect(result.current.holding).toEqual(AAPL_HOLDING);
    });

    it('returns null when no holding matches the symbol', () => {
        setHoldings({ holdings: [AAPL_HOLDING] });
        const { result } = renderHook(() => useSymbolHolding('MSFT'));
        expect(result.current.holding).toBeNull();
    });

    it('returns null when the holdings list is empty', () => {
        setHoldings({ holdings: [] });
        const { result } = renderHook(() => useSymbolHolding('AAPL'));
        expect(result.current.holding).toBeNull();
    });

    it('passes through isHydrated and save from usePortfolioHoldings', () => {
        const save = {
            mutateAsync: vi.fn(),
            isPending: false,
        } as unknown as Holdings['save'];
        setHoldings({ holdings: [], isHydrated: false, save });
        const { result } = renderHook(() => useSymbolHolding('AAPL'));
        expect(result.current.isHydrated).toBe(false);
        expect(result.current.save).toBe(save);
    });
});
