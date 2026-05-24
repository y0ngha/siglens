'use client';

import { useQuery } from '@tanstack/react-query';
import { getAssetInfoAction } from '@/infrastructure/ticker/getAssetInfoAction';
import {
    ASSET_INFO_STALE_TIME_MS,
    QUERY_KEYS,
} from '@/shared/config/queryConfig';
import type { AssetInfo } from '@/domain/types';

export function useAssetInfo(symbol: string): AssetInfo | undefined {
    const { data } = useQuery({
        queryKey: QUERY_KEYS.assetInfo(symbol),
        queryFn: () => getAssetInfoAction(symbol),
        staleTime: ASSET_INFO_STALE_TIME_MS,
    });
    return data ?? undefined;
}
