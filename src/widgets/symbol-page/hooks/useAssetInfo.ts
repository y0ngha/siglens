'use client';

import { useQuery } from '@tanstack/react-query';
import { getAssetInfoAction } from '@/entities/ticker/actions';
import {
    ASSET_INFO_STALE_TIME_MS,
    QUERY_KEYS,
} from '@/shared/config/queryConfig';
import type { AssetInfo } from '@/shared/lib/types';
import { useHydrated } from '@/shared/hooks/useHydrated';

export function useAssetInfo(symbol: string): AssetInfo | undefined {
    const isHydrated = useHydrated();
    const { data } = useQuery({
        queryKey: QUERY_KEYS.assetInfo(symbol),
        queryFn: ({ queryKey: [, qSymbol] }) => getAssetInfoAction(qSymbol),
        enabled: isHydrated,
        staleTime: ASSET_INFO_STALE_TIME_MS,
    });
    return data ?? undefined;
}
