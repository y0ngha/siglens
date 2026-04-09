import { useQuery } from '@tanstack/react-query';
import { getAssetInfoAction } from '@/infrastructure/ticker/getAssetInfoAction';
import { QUERY_KEYS, QUERY_STALE_TIME_MS } from '@/lib/queryConfig';
import type { AssetInfo } from '@/domain/types';

export function useAssetInfo(symbol: string): AssetInfo | undefined {
    const { data } = useQuery({
        queryKey: QUERY_KEYS.assetInfo(symbol),
        queryFn: () => getAssetInfoAction(symbol),
        staleTime: QUERY_STALE_TIME_MS,
    });
    return data;
}
