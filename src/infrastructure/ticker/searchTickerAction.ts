'use server';

import { waitUntil } from '@vercel/functions';
import { searchTicker } from '@y0ngha/siglens-core';
import type { TickerSearchResult } from '@y0ngha/siglens-core';

export async function searchTickerAction(
    query: string
): Promise<TickerSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    return searchTicker(trimmed, { waitUntil });
}
