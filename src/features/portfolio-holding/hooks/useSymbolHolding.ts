'use client';

import { usePortfolioHoldings } from '@/entities/portfolio/hooks/usePortfolioHoldings';
import type { PortfolioHoldingView } from '@/entities/portfolio';

export interface UseSymbolHoldingReturn {
    holding: PortfolioHoldingView | null;
    isHydrated: boolean;
    isLoading: boolean;
    isError: boolean;
    save: ReturnType<typeof usePortfolioHoldings>['save'];
}

/** Selects the current symbol's holding (case-insensitive) out of the member's full holdings list. */
export function useSymbolHolding(symbol: string): UseSymbolHoldingReturn {
    const { holdings, isHydrated, isLoading, isError, save } =
        usePortfolioHoldings();
    const upper = symbol.toUpperCase();
    const holding = holdings.find(h => h.symbol === upper) ?? null;
    return { holding, isHydrated, isLoading, isError, save };
}
