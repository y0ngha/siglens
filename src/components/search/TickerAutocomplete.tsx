'use client';

import { isKoreanInput } from '@/domain/ticker';
import { useAutocomplete } from '@/components/search/hooks/useAutocomplete';
import { cn } from '@/lib/cn';
import type { TickerSearchResult } from '@y0ngha/siglens-core';

const LISTBOX_ID = 'ticker-autocomplete-listbox';
const OPTION_ID_PREFIX = `${LISTBOX_ID}-option`;

type TickerAutocompleteSize = 'sm' | 'lg';

const INPUT_BASE =
    'bg-secondary-800 border-secondary-700 text-secondary-100 placeholder-secondary-500 focus:border-primary-600 focus:ring-primary-500 rounded-lg border transition-colors outline-none focus:ring-1';
const INPUT_SIZE: Record<TickerAutocompleteSize, string> = {
    sm: 'px-3 py-2 text-sm',
    lg: 'focus-glow w-full px-4 py-3 text-base sm:w-96',
};

const BUTTON_BASE =
    'bg-primary-600 hover:bg-primary-700 shrink-0 rounded-lg font-semibold whitespace-nowrap text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500';
const BUTTON_SIZE: Record<TickerAutocompleteSize, string> = {
    sm: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
};

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
    const {
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
    } = useAutocomplete({ onSelect });

    const isKorean = isKoreanInput(query);

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
                    placeholder="종목 입력 (예: AAPL, 애플)"
                    className={cn(INPUT_BASE, INPUT_SIZE[size])}
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
                className={cn(BUTTON_BASE, BUTTON_SIZE[size])}
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
                'hover:bg-secondary-700 focus-visible:ring-primary-500 w-full px-4 py-2 text-left transition-colors focus-visible:ring-1 focus-visible:outline-none',
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
