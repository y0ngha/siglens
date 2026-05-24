'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
    QUERY_KEYS,
    TICKER_SEARCH_STALE_TIME_MS,
} from '@/shared/config/queryConfig';
import { searchTickerAction } from '@/entities/ticker/actions';
import type { TickerSearchResult } from '@/shared/lib/types';

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 1;

interface UseTickerSearchResult {
    results: TickerSearchResult[];
    isSearching: boolean;
    hasQuery: boolean;
}

export function useTickerSearch(query: string): UseTickerSearchResult {
    const [debouncedQuery, setDebouncedQuery] = useState('');

    const isDebouncedQueryReady = debouncedQuery.length >= MIN_QUERY_LENGTH;

    const { data, isFetching } = useQuery({
        queryKey: QUERY_KEYS.tickerSearch(debouncedQuery),
        queryFn: () => searchTickerAction(debouncedQuery),
        enabled: isDebouncedQueryReady,
        // FMP catalogue updates daily — long staleTime is safe and protects
        // the FMP free-tier rate limit during typing sessions.
        staleTime: TICKER_SEARCH_STALE_TIME_MS,
    });

    useEffect(() => {
        const isLongEnough = query.length >= MIN_QUERY_LENGTH;
        const timer = setTimeout(
            () => setDebouncedQuery(isLongEnough ? query : ''),
            isLongEnough ? DEBOUNCE_MS : 0
        );
        return () => clearTimeout(timer);
    }, [query]);

    return {
        results: data ?? [],
        isSearching: isFetching && isDebouncedQueryReady,
        hasQuery: isDebouncedQueryReady,
    };
}
