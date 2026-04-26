'use server';

import { searchTicker } from '@y0ngha/siglens-core';
import type { TickerSearchResult } from '@/domain/types';

export async function searchTickerAction(
    query: string
): Promise<TickerSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    return searchTicker(trimmed);
}
