'use server';

import { getAssetInfo } from '../server/getAssetInfo';
import type { AssetInfo } from '@/shared/lib/types';

export async function getAssetInfoAction(
    symbol: string
): Promise<AssetInfo | null> {
    return getAssetInfo(symbol.toUpperCase());
}
