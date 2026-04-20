'use client';

import {
    useCallback,
    useRef,
    useState,
    type ChangeEvent,
    type KeyboardEvent,
    type RefObject,
} from 'react';
import { useRouter } from 'next/navigation';
import type { TickerSearchResult } from '@/domain/types';
import { useOnClickOutside } from '@/components/hooks/useOnClickOutside';
import { useTickerSearch } from '@/components/search/hooks/useTickerSearch';

interface UseAutocompleteOptions {
    onSelect?: (symbol: string) => void;
}

interface UseAutocompleteReturn {
    query: string;
    results: readonly TickerSearchResult[];
    isSearching: boolean;
    selectedIndex: number;
    isOpen: boolean;
    inputRef: RefObject<HTMLInputElement | null>;
    dropdownRef: RefObject<HTMLDivElement | null>;
    handleChange: (e: ChangeEvent<HTMLInputElement>) => void;
    handleKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
    handleFocus: () => void;
    handleSearchClick: () => void;
    navigate: (symbol: string) => void;
    prefetch: (symbol: string) => void;
}

export function useAutocomplete({
    onSelect,
}: UseAutocompleteOptions = {}): UseAutocompleteReturn {
    const [query, setQuery] = useState('');
    const [isClosed, setIsClosed] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);

    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const prefetchedRef = useRef(new Set<string>());

    const router = useRouter();
    const { results, isSearching, hasQuery } = useTickerSearch(query);

    useOnClickOutside([inputRef, dropdownRef], () => setIsClosed(true));

    const isOpen = !isClosed && hasQuery;

    const navigate = useCallback(
        (symbol: string) => {
            setQuery('');
            setIsClosed(true);
            setSelectedIndex(-1);
            onSelect?.(symbol);
            router.push(`/${symbol}`);
        },
        [onSelect, router]
    );

    const prefetch = useCallback(
        (symbol: string) => {
            if (prefetchedRef.current.has(symbol)) return;
            prefetchedRef.current.add(symbol);
            router.prefetch(`/${symbol}`);
        },
        [router]
    );

    const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        setQuery(e.target.value);
        setIsClosed(false);
        setSelectedIndex(-1);
    }, []);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const nextIndex = Math.min(
                    selectedIndex + 1,
                    results.length - 1
                );
                setSelectedIndex(nextIndex);
                const next = results[nextIndex];
                if (next) prefetch(next.symbol);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prevIndex = Math.max(selectedIndex - 1, -1);
                setSelectedIndex(prevIndex);
                const prev = results[prevIndex];
                if (prev) prefetch(prev.symbol);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const selected = results[selectedIndex];
                if (selectedIndex >= 0 && selected) {
                    navigate(selected.symbol);
                } else {
                    const trimmed = query.trim().toUpperCase();
                    if (trimmed) navigate(trimmed);
                }
            } else if (e.key === 'Escape') {
                setIsClosed(true);
                setSelectedIndex(-1);
            }
        },
        [navigate, prefetch, query, results, selectedIndex]
    );

    const handleSearchClick = useCallback(() => {
        const trimmed = query.trim().toUpperCase();
        if (trimmed) navigate(trimmed);
    }, [navigate, query]);

    const handleFocus = useCallback(() => setIsClosed(false), []);

    return {
        query,
        results,
        isSearching,
        selectedIndex,
        isOpen,
        inputRef,
        dropdownRef,
        handleChange,
        handleKeyDown,
        handleFocus,
        handleSearchClick,
        navigate,
        prefetch,
    };
}
