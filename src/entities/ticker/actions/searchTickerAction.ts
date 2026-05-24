'use server';

import { waitUntil } from '@vercel/functions';
import { searchTicker } from '../lib/searchTicker';
import type { TickerSearchResult } from '@/domain/types';

export async function searchTickerAction(
    query: string
): Promise<TickerSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    return searchTicker(trimmed, { waitUntil });
}
