'use client';

import {
    type ChangeEvent,
    type KeyboardEvent,
    type RefObject,
    useCallback,
    useRef,
    useState,
} from 'react';
import { useRouter } from 'next/navigation';
import type { TickerSearchResult } from '@/shared/lib/types';
import { useOnClickOutside } from '@/shared/hooks/useOnClickOutside';
import { useTickerSearch } from './useTickerSearch';

interface UseAutocompleteOptions {
    /**
     * 선택된 항목. 표시용 회사명을 함께 넘긴다 — 최근 검색이 티커가 아니라
     * 회사명으로 저장돼야 하기 때문이다(직접 입력한 문자열은 라벨이 곧 그 문자열).
     */
    onSelect?: (entry: { symbol: string; label: string }) => void;
    /**
     * Whether selecting a result also navigates to `/{symbol}`. Defaults to true
     * (the search-bar behavior used by SymbolSearchPanel/Header). Callers that embed
     * this as a plain value-picker inside a form (e.g. portfolio-management's
     * HoldingForm) must pass false — selecting a ticker there must fill the field,
     * not route away from the page mid-form.
     */
    navigateOnSelect?: boolean;
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
    navigate: (symbol: string, label?: string) => void;
    prefetch: (symbol: string) => void;
}

export function useAutocomplete({
    onSelect,
    navigateOnSelect = true,
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
        (symbol: string, label?: string) => {
            setQuery('');
            setIsClosed(true);
            setSelectedIndex(-1);
            onSelect?.({ symbol, label: label?.trim() || symbol });
            if (navigateOnSelect) router.push(`/${symbol}`);
        },
        [navigateOnSelect, onSelect, router]
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
                    navigate(
                        selected.symbol,
                        selected.koreanName ?? selected.name
                    );
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
