'use client';

import { useQuery } from '@tanstack/react-query';
import { getAssetInfoAction } from '@/entities/ticker/actions';
import {
    ASSET_INFO_STALE_TIME_MS,
    QUERY_KEYS,
} from '@/shared/config/queryConfig';
import type { AssetInfo } from '@/shared/lib/types';
import { useHydrated } from '@/shared/hooks/useHydrated';

/**
 * Returns:
 * - `undefined` — query in-flight (loading placeholder should be shown)
 * - `null`      — query resolved but no matching asset found (unknown symbol)
 * - `AssetInfo` — resolved asset
 */
export function useAssetInfo(symbol: string): AssetInfo | null | undefined {
    const isHydrated = useHydrated();
    const { data } = useQuery({
        queryKey: QUERY_KEYS.assetInfo(symbol),
        queryFn: ({ queryKey: [, qSymbol] }) => getAssetInfoAction(qSymbol),
        enabled: isHydrated,
        staleTime: ASSET_INFO_STALE_TIME_MS,
    });
    // `data` is `undefined` when the query has not yet resolved (loading),
    // and `null` when the server action returned null (unknown symbol).
    // We preserve the distinction so consumers can handle each case separately.
    return data === undefined ? undefined : data;
}
