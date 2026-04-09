'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

import { isKoreanInput } from '@/domain/ticker';
import { useTickerSearch } from '@/components/search/hooks/useTickerSearch';
import { useOnClickOutside } from '@/components/search/hooks/useOnClickOutside';
import { cn } from '@/lib/cn';
import type { TickerSearchResult } from '@/domain/types';

const LISTBOX_ID = 'ticker-autocomplete-listbox';

interface TickerAutocompleteProps {
    className?: string;
    size?: 'sm' | 'lg';
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

    const router = useRouter();
    const { results, isSearching, hasQuery } = useTickerSearch(query);

    useOnClickOutside([inputRef, dropdownRef], () => setIsClosed(true));

    const isOpen = !isClosed && hasQuery;
    const isKorean = isKoreanInput(query);

    const navigate = useCallback(
        (symbol: string) => {
            setQuery('');
            setIsClosed(false);
            setSelectedIndex(-1);
            onSelect?.(symbol);
            router.push(`/${symbol}`);
        },
        [onSelect, router]
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
                setSelectedIndex(prev =>
                    Math.min(prev + 1, results.length - 1)
                );
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, -1));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (selectedIndex >= 0 && results[selectedIndex]) {
                    navigate(results[selectedIndex].symbol);
                } else {
                    const trimmed = query.trim().toUpperCase();
                    if (trimmed) navigate(trimmed);
                }
            } else if (e.key === 'Escape') {
                setIsClosed(true);
                setSelectedIndex(-1);
            }
        },
        [navigate, query, results, selectedIndex]
    );

    const inputClass = cn(
        'bg-secondary-800 border-secondary-700 text-secondary-100 placeholder-secondary-500 focus:border-primary-600 focus:ring-primary-500 rounded-lg border transition-colors outline-none focus:ring-1',
        size === 'lg'
            ? 'focus-glow w-full px-4 py-3 text-base sm:w-96'
            : 'px-3 py-2 text-sm'
    );

    const buttonClass = cn(
        'bg-primary-600 hover:bg-primary-700 shrink-0 rounded-lg font-semibold whitespace-nowrap text-white transition-colors',
        size === 'lg' ? 'px-6 py-3 text-base' : 'px-4 py-2 text-sm'
    );

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
                    type="text"
                    value={query}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setIsClosed(false)}
                    placeholder="티커 입력 (예: AAPL)"
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
                                검색 중...
                            </div>
                        )}
                        {!isSearching && hasQuery && results.length === 0 && (
                            <div className="text-secondary-400 px-4 py-3 text-sm">
                                {isKorean
                                    ? '검색 결과 없음 — 티커(예: AAPL)로 검색해 보세요'
                                    : '검색 결과 없음'}
                            </div>
                        )}
                        {results.map((result, index) => (
                            <ResultItem
                                key={result.symbol}
                                result={result}
                                isSelected={index === selectedIndex}
                                onSelect={navigate}
                            />
                        ))}
                    </div>
                )}
            </div>
            <button
                type="button"
                onClick={() => {
                    const trimmed = query.trim().toUpperCase();
                    if (trimmed) navigate(trimmed);
                }}
                className={buttonClass}
            >
                검색
            </button>
        </div>
    );
}

interface ResultItemProps {
    result: TickerSearchResult;
    isSelected: boolean;
    onSelect: (symbol: string) => void;
}

function ResultItem({ result, isSelected, onSelect }: ResultItemProps) {
    const displayName = result.koreanName
        ? `${result.name} (${result.koreanName})`
        : result.name;

    return (
        <button
            type="button"
            role="option"
            aria-selected={isSelected}
            onClick={() => onSelect(result.symbol)}
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
