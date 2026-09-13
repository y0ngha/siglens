'use client';

import { useQuery } from '@tanstack/react-query';
import { getAssetLabelsAction } from '@/entities/ticker/actions';
import { QUERY_KEYS } from '@/shared/config/queryConfig';

/**
 * Display names for the symbols under an answer (`005930.KS` → `삼성전자`),
 * with the same Korean-name-first rule as search results. Names never change
 * within a session, so one lookup per symbol set is enough; while it is in
 * flight — or when a symbol has no name — the caller shows the symbol itself.
 */
export function useSymbolLabels(
    symbols: readonly string[]
): Readonly<Record<string, string>> {
    const { data } = useQuery({
        queryKey: QUERY_KEYS.assetLabels(symbols),
        queryFn: () => getAssetLabelsAction(symbols),
        enabled: symbols.length > 0,
        staleTime: Infinity,
        gcTime: Infinity,
    });
    return data?.labels ?? {};
}
