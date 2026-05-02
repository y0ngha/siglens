'use server';

import { getAssetInfo } from '@/infrastructure/ticker/use-cases/getAssetInfo';
import type { AssetInfo } from '@/domain/types';

export async function getAssetInfoAction(
    symbol: string
): Promise<AssetInfo | null> {
    return getAssetInfo(symbol.toUpperCase());
}
