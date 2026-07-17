'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useHydrated } from '@/shared/hooks/useHydrated';
import {
    PORTFOLIO_HOLDINGS_STALE_TIME_MS,
    QUERY_KEYS,
} from '@/shared/config/queryConfig';
import {
    deletePortfolioHoldingAction,
    getPortfolioHoldingsAction,
    savePortfolioHoldingAction,
} from '@/entities/portfolio/actions';
import type {
    PortfolioHoldingView,
    RawHoldingInput,
    SavePortfolioResult,
    DeletePortfolioResult,
} from '@/entities/portfolio';

/** Fetches the current member's holdings and exposes save/delete mutations that invalidate the list on success. */
export function usePortfolioHoldings() {
    const isHydrated = useHydrated();
    const qc = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: QUERY_KEYS.portfolioHoldings(),
        queryFn: () => getPortfolioHoldingsAction(),
        enabled: isHydrated,
        staleTime: PORTFOLIO_HOLDINGS_STALE_TIME_MS,
    });

    const invalidate = () =>
        qc.invalidateQueries({ queryKey: QUERY_KEYS.portfolioHoldings() });

    const save = useMutation<SavePortfolioResult, Error, RawHoldingInput>({
        mutationFn: input => savePortfolioHoldingAction(input),
        onSuccess: result => {
            if (result.status === 'ok') invalidate();
        },
    });

    const remove = useMutation<DeletePortfolioResult, Error, string>({
        mutationFn: symbol => deletePortfolioHoldingAction(symbol),
        onSuccess: result => {
            if (result.status === 'ok') invalidate();
        },
    });

    const holdings: PortfolioHoldingView[] = data ?? [];

    return { holdings, isHydrated, isLoading, save, remove };
}
