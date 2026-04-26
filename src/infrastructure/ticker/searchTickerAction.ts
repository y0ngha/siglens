'use server';

import { searchTicker } from '@y0ngha/siglens-core';
import type { TickerSearchResult } from '@/domain/types';

export async function searchTickerAction(
    query: string
): Promise<TickerSearchResult[]> {
    return searchTicker(query);
}
