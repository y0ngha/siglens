'use server';

import { type AssetInfo, getAssetInfo } from '@y0ngha/siglens-core';

export async function getAssetInfoAction(
    symbol: string
): Promise<AssetInfo | null> {
    return getAssetInfo(symbol.toUpperCase());
}
