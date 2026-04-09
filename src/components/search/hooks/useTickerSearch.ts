'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/lib/queryConfig';
import { searchTickerAction } from '@/infrastructure/ticker/searchTickerAction';
import type { TickerSearchResult } from '@/domain/types';

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
