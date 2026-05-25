// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { useOptionsChainMetrics } from '@/widgets/options/hooks/useOptionsChainMetrics';
import type { OptionsSnapshot } from '@y0ngha/siglens-core';

vi.mock('@/entities/options-chain', () => ({
    pickActiveChain: (snapshot: OptionsSnapshot, exp: string) => {
        if (exp === 'all') return snapshot.chains[0] ?? null;
        return snapshot.chains.find(c => c.expirationDate === exp) ?? null;
    },
}));

vi.mock('@y0ngha/siglens-core', async () => {
    const actual = await vi.importActual('@y0ngha/siglens-core');
    return {
        ...actual,
        summarizeChainForLlm: (_chain: unknown, _price: number) => ({
            maxPain: 150,
            putCallRatio: 0.8,
            atmImpliedVolatility: 0.35,
            impliedMovePercent: 4.2,
        }),
    };
});

const SNAPSHOT: OptionsSnapshot = {
    symbol: 'AAPL',
    underlyingPrice: 150,
    capturedAt: '2025-01-15T10:00:00Z',
    chains: [
        {
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
                    contractSymbol: 'AAPL250620C00150000',
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
                    contractSymbol: 'AAPL250620P00150000',
                },
            ],
        },
    ],
};

describe('useOptionsChainMetrics', () => {
    it('returns chain and metrics for a matching expiration', () => {
        const { result } = renderHook(() =>
            useOptionsChainMetrics(SNAPSHOT, '2025-06-20')
        );
        expect(result.current.chain).toBeTruthy();
        expect(result.current.metrics).toBeTruthy();
        expect(result.current.metrics?.maxPain).toBe(150);
    });

    it('returns null chain and metrics for non-matching expiration', () => {
        const { result } = renderHook(() =>
            useOptionsChainMetrics(SNAPSHOT, '2099-01-01')
        );
        expect(result.current.chain).toBeNull();
        expect(result.current.metrics).toBeNull();
    });

    it('uses first chain when "all" is selected', () => {
        const { result } = renderHook(() =>
            useOptionsChainMetrics(SNAPSHOT, 'all')
        );
        expect(result.current.chain).toBeTruthy();
        expect(result.current.chain?.expirationDate).toBe('2025-06-20');
    });

    it('memoizes result across re-renders with same inputs', () => {
        const { result, rerender } = renderHook(() =>
            useOptionsChainMetrics(SNAPSHOT, '2025-06-20')
        );
        const first = result.current;
        rerender();
        expect(result.current).toBe(first);
    });
});
