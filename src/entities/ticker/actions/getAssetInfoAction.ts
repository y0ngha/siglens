'use server';

import type { AssetInfo } from '@/shared/lib/types';
import { getAssetInfo } from '../server/getAssetInfo';

export async function getAssetInfoAction(
    symbol: string
): Promise<AssetInfo | null> {
    return getAssetInfo(symbol.toUpperCase());
}
