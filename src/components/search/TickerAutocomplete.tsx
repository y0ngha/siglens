'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';

import { isKoreanInput } from '@/domain/ticker';
import { useTickerSearch } from '@/components/search/hooks/useTickerSearch';
import { useOnClickOutside } from '@/components/search/hooks/useOnClickOutside';
import { cn } from '@/lib/cn';
import type { TickerSearchResult } from '@/domain/types';

const LISTBOX_ID = 'ticker-autocomplete-listbox';
const OPTION_ID_PREFIX = `${LISTBOX_ID}-option`;

type TickerAutocompleteSize = 'sm' | 'lg';

interface TickerAutocompleteProps {
    className?: string;
    size?: TickerAutocompleteSize;
    onSelect?: (symbol: string) => void;
}

export function TickerAutocomplete({
    className,
    size = 'sm',
    onSelect,
}: TickerAutocompleteProps) {
    const [query, setQuery] = useState('');
    const [isClosed, setIsClosed] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);

    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const prefetchedRef = useRef(new Set<string>());

    const router = useRouter();
    const { results, isSearching, hasQuery } = useTickerSearch(query);

    const isOpen = !isClosed && hasQuery;
    const isKorean = isKoreanInput(query);
    const inputClass = useMemo(
        () =>
            cn(
                'bg-secondary-800 border-secondary-700 text-secondary-100 placeholder-secondary-500 focus:border-primary-600 focus:ring-primary-500 rounded-lg border transition-colors outline-none focus:ring-1',
                size === 'lg'
                    ? 'focus-glow w-full px-4 py-3 text-base sm:w-96'
                    : 'px-3 py-2 text-sm'
            ),
        [size]
    );
    const buttonClass = useMemo(
        () =>
            cn(
                'bg-primary-600 hover:bg-primary-700 shrink-0 rounded-lg font-semibold whitespace-nowrap text-white transition-colors',
                size === 'lg' ? 'px-6 py-3 text-base' : 'px-4 py-2 text-sm'
            ),
        [size]
    );

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

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            setQuery(e.target.value);
            setIsClosed(false);
            setSelectedIndex(-1);
        },
        []
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
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

    useOnClickOutside([inputRef, dropdownRef], () => setIsClosed(true));

    return (
        <div
            className={cn(
                'relative flex items-center gap-2',
                size === 'lg' && 'w-full max-w-md',
                className
            )}
        >
            <div className="relative flex-1">
                <input
                    ref={inputRef}
                    name="symbol"
                    autoComplete="off"
                    role="combobox"
                    aria-label="종목 티커 검색"
                    aria-expanded={isOpen}
                    aria-haspopup="listbox"
                    aria-controls={LISTBOX_ID}
                    aria-autocomplete="list"
                    aria-activedescendant={
                        selectedIndex >= 0
                            ? `${OPTION_ID_PREFIX}-${selectedIndex}`
                            : undefined
                    }
                    type="text"
                    value={query}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onFocus={handleFocus}
                    placeholder="티커 입력… (예: AAPL)"
                    className={inputClass}
                />
                {isOpen && (
                    <div
                        ref={dropdownRef}
                        id={LISTBOX_ID}
                        role="listbox"
                        className="border-secondary-700 bg-secondary-800 absolute top-full left-0 z-50 mt-1 w-full overflow-hidden rounded-lg border shadow-lg"
                    >
                        {isSearching && (
                            <div className="text-secondary-400 px-4 py-3 text-sm">
                                검색 중…
                            </div>
                        )}
                        {!isSearching && results.length === 0 && (
                            <div className="text-secondary-400 px-4 py-3 text-sm">
                                {isKorean
                                    ? '검색 결과 없음 — 티커(예: AAPL)로 검색해 보세요'
                                    : '검색 결과 없음'}
                            </div>
                        )}
                        {results.map((result, index) => (
                            <ResultItem
                                key={result.symbol}
                                id={`${OPTION_ID_PREFIX}-${index}`}
                                result={result}
                                isSelected={index === selectedIndex}
                                onSelect={navigate}
                                onPrefetch={prefetch}
                            />
                        ))}
                    </div>
                )}
            </div>
            <button
                type="button"
                onClick={handleSearchClick}
                className={buttonClass}
            >
                검색
            </button>
        </div>
    );
}

interface ResultItemProps {
    id: string;
    result: TickerSearchResult;
    isSelected: boolean;
    onSelect: (symbol: string) => void;
    onPrefetch: (symbol: string) => void;
}

function ResultItem({
    id,
    result,
    isSelected,
    onSelect,
    onPrefetch,
}: ResultItemProps) {
    const displayName = result.koreanName
        ? `${result.name} (${result.koreanName})`
        : result.name;

    return (
        <button
            id={id}
            type="button"
            role="option"
            aria-selected={isSelected}
            onClick={() => onSelect(result.symbol)}
            onMouseEnter={() => onPrefetch(result.symbol)}
            className={cn(
                'hover:bg-secondary-700 w-full px-4 py-2 text-left transition-colors',
                isSelected && 'bg-secondary-700'
            )}
        >
            <div className="flex items-baseline gap-2">
                <span className="text-secondary-100 shrink-0 font-medium">
                    {result.symbol}
                </span>
                <span className="text-secondary-400 truncate text-sm">
                    {displayName}
                </span>
            </div>
            <div className="text-secondary-500 text-xs">
                {result.exchangeFullName}
            </div>
        </button>
    );
}
