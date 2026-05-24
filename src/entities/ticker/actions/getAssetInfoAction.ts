'use server';

import { getAssetInfo } from '../lib/getAssetInfo';
import type { AssetInfo } from '@/domain/types';

export async function getAssetInfoAction(
    symbol: string
): Promise<AssetInfo | null> {
    return getAssetInfo(symbol.toUpperCase());
}
