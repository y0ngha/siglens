'use client';

import { useQuery } from '@tanstack/react-query';
import { getAssetInfoAction } from '@/entities/ticker/actions';
import {
    ASSET_INFO_STALE_TIME_MS,
    QUERY_KEYS,
} from '@/shared/config/queryConfig';
import type { AssetInfo } from '@/shared/lib/types';

export function useAssetInfo(symbol: string): AssetInfo | undefined {
    const { data } = useQuery({
        queryKey: QUERY_KEYS.assetInfo(symbol),
        queryFn: ({ queryKey: [, qSymbol] }) => getAssetInfoAction(qSymbol),
        staleTime: ASSET_INFO_STALE_TIME_MS,
    });
    return data ?? undefined;
}
