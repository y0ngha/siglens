'use server';

import { getAssetInfo } from '@y0ngha/siglens-core';
import type { AssetInfo } from '@/domain/types';

export async function getAssetInfoAction(
    symbol: string
): Promise<AssetInfo | null> {
    return getAssetInfo(symbol);
}
