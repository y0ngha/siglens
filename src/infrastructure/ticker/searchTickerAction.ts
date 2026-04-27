'use server';

import { waitUntil } from '@vercel/functions';
import { type TickerSearchResult, searchTicker } from '@y0ngha/siglens-core';

export async function searchTickerAction(
    query: string
): Promise<TickerSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    return searchTicker(trimmed, { waitUntil });
}
