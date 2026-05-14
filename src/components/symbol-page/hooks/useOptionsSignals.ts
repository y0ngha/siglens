'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
    getOptionsSignalsAction,
    type OptionsSignalsResult,
} from '@/infrastructure/options/optionsActions';
import { QUERY_KEYS } from '@/lib/queryConfig';
import { MS_PER_MINUTE } from '@/domain/constants/time';

const OPTIONS_SIGNALS_STALE_TIME_MS = 5 * MS_PER_MINUTE;

/**
 * Loads the chart-page option signal card data (ATM IV / Put-Call / Max
 * Pain) anchored on the nearest expiration. Architecture §0 prohibits
 * `.tsx` components from importing infrastructure directly, so the card
 * consumes this hook instead of calling the Server Action.
 */
export function useOptionsSignals(
    symbol: string
): UseQueryResult<OptionsSignalsResult | null> {
    return useQuery<OptionsSignalsResult | null>({
        queryKey: QUERY_KEYS.optionsSignals(symbol),
        queryFn: () => getOptionsSignalsAction(symbol),
        retry: 1,
        staleTime: OPTIONS_SIGNALS_STALE_TIME_MS,
    });
}
