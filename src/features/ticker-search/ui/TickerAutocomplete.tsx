'use client';

import { useTranslations } from 'next-intl';
import { isKoreanInput } from '@/entities/ticker';
import { useAutocomplete } from '../hooks/useAutocomplete';
import { marketBadgeSpec, resultDisplayNames } from '../lib/resultDisplay';
import { MarketBadge } from './MarketBadge';
import { cn } from '@/shared/lib/cn';
import type { TickerSearchResult } from '@/shared/lib/types';

const LISTBOX_ID = 'ticker-autocomplete-listbox';
const OPTION_ID_PREFIX = `${LISTBOX_ID}-option`;

type TickerAutocompleteSize = 'sm' | 'lg';

const INPUT_BASE =
    'bg-secondary-800 border-secondary-700 text-secondary-100 placeholder-secondary-500 focus:border-primary-600 focus:ring-primary-500 rounded-lg border transition-colors outline-none focus:ring-1';
const INPUT_SIZE: Record<TickerAutocompleteSize, string> = {
    sm: 'h-11 px-3 text-sm',
    lg: 'focus-glow h-12 px-4 text-base',
};

const BUTTON_BASE =
    'bg-primary-600 hover:bg-primary-700 shrink-0 rounded-lg font-semibold whitespace-nowrap text-white transition-colors focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none';
const BUTTON_SIZE: Record<TickerAutocompleteSize, string> = {
    sm: 'h-11 px-3 text-sm sm:px-4',
    lg: 'h-12 w-full px-6 text-base sm:w-auto',
};

interface TickerAutocompleteProps {
    className?: string;
    size?: TickerAutocompleteSize;
    onSelect?: (entry: { symbol: string; label: string }) => void;
    /** See useAutocomplete's navigateOnSelect — pass false to use this as a plain value-picker inside a form. */
    navigateOnSelect?: boolean;
    /**
     * Overrides the input's own visual styling (bg/height/border/focus ring)
     * to match a specific host form — e.g. HoldingForm's sibling quantity/price
     * inputs — without changing the default appearance for other consumers
     * (Header, SymbolSearchPanel). Merged on top of the size-based defaults via
     * `cn`/`twMerge`, so later utility classes win over earlier ones.
     */
    inputClassName?: string;
    /** Forwarded to the underlying input so a host form can associate its own field-level error message. */
    ariaInvalid?: boolean;
    /** Forwarded to the underlying input so a host form can associate its own field-level error message. */
    ariaDescribedby?: string;
    /**
     * Associates the input with a host form's own visible field label (e.g.
     * HoldingForm's "종목" label) so the accessible name matches what's on
     * screen, instead of the generic default "종목 티커 검색" aria-label.
     * When provided, this takes over as the input's accessible name (the
     * default `aria-label` is omitted) — other consumers that don't pass it
     * keep the unchanged default behavior.
     */
    ariaLabelledby?: string;
}

export function TickerAutocomplete({
    className,
    size = 'sm',
    onSelect,
    navigateOnSelect,
    inputClassName,
    ariaInvalid,
    ariaDescribedby,
    ariaLabelledby,
}: TickerAutocompleteProps) {
    const t = useTranslations('features.ticker-search');
    const {
        query,
        results,
        isSearching,
        isError,
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
    } = useAutocomplete({ onSelect, navigateOnSelect });

    const isKorean = isKoreanInput(query);

    return (
        <div
            className={cn(
                'relative flex min-w-0',
                size === 'sm'
                    ? 'items-center gap-2'
                    : 'w-full max-w-xl flex-col gap-3 sm:flex-row sm:items-center',
                className
            )}
        >
            <div className="relative min-w-0 flex-1">
                <input
                    ref={inputRef}
                    name="symbol"
                    autoComplete="off"
                    role="combobox"
                    aria-label={
                        ariaLabelledby
                            ? undefined
                            : t('TickerAutocomplete.30cf1e')
                    }
                    aria-labelledby={ariaLabelledby}
                    aria-expanded={isOpen}
                    aria-haspopup="listbox"
                    aria-controls={LISTBOX_ID}
                    aria-autocomplete="list"
                    aria-activedescendant={
                        selectedIndex >= 0
                            ? `${OPTION_ID_PREFIX}-${selectedIndex}`
                            : undefined
                    }
                    aria-invalid={ariaInvalid}
                    aria-describedby={ariaDescribedby}
                    type="text"
                    value={query}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onFocus={handleFocus}
                    placeholder={t('TickerAutocomplete.124e37')}
                    className={cn(
                        INPUT_BASE,
                        INPUT_SIZE[size],
                        'w-full min-w-0',
                        inputClassName
                    )}
                />
                {isOpen && (
                    <div
                        ref={dropdownRef}
                        id={LISTBOX_ID}
                        role="listbox"
                        className="absolute top-full left-0 z-50 mt-1 w-full overflow-hidden rounded-lg border border-secondary-700 bg-secondary-800 shadow-lg"
                    >
                        {isSearching && (
                            <div className="px-4 py-3 text-sm text-secondary-400">
                                {t('TickerAutocomplete.e39068')}
                            </div>
                        )}
                        {isError &&
                            !isSearching && (
                                // "결과 없음"과 "조회 실패"는 다르다. 구분하지 않으면 검색이
                                // 죽어도 "결과 없음"으로 보이고, 한글 질의에는 "티커로
                                // 쳐보세요"라는 틀린 안내까지 나간다. 오버레이와 같은 문구.
                                <div className="px-4 py-3 text-sm text-secondary-400">
                                    {t('search.loadFailedRetry')}
                                </div>
                            )}
                        {!isSearching && !isError && results.length === 0 && (
                            <div className="px-4 py-3 text-sm text-secondary-400">
                                {isKorean
                                    ? t('TickerAutocomplete.e62852')
                                    : t('TickerAutocomplete.5dd6d9')}
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
            {navigateOnSelect !== false && (
                <button
                    type="button"
                    onClick={handleSearchClick}
                    className={cn(BUTTON_BASE, BUTTON_SIZE[size])}
                >
                    {t('TickerAutocomplete.4f5a3f')}
                </button>
            )}
        </div>
    );
}

interface ResultItemProps {
    id: string;
    result: TickerSearchResult;
    isSelected: boolean;
    onSelect: (symbol: string, label: string) => void;
    onPrefetch: (symbol: string) => void;
}

function ResultItem({
    id,
    result,
    isSelected,
    onSelect,
    onPrefetch,
}: ResultItemProps) {
    // 표시 규칙(한글명 우선·국내 종목 영문명 억제·시장 배지)은 오버레이와 공유한다.
    // 근거와 드리프트 이력은 `lib/resultDisplay.ts` 상단 JSDoc 참고.
    const { primaryName, secondaryName } = resultDisplayNames(result);
    const badge = marketBadgeSpec(result);

    return (
        <button
            id={id}
            type="button"
            role="option"
            aria-selected={isSelected}
            onClick={() => onSelect(result.symbol, primaryName)}
            onMouseEnter={() => onPrefetch(result.symbol)}
            className={cn(
                'hover:bg-secondary-700 focus-visible:ring-primary-500 w-full px-4 py-2 text-left transition-colors focus-visible:ring-1 focus-visible:outline-none',
                isSelected && 'bg-secondary-700'
            )}
        >
            {/* 회사명이 먼저, 티커가 뒤 — 사용자는 티커가 아니라 이름으로 종목을
                떠올린다(`삼성전자`, `애플`). 티커는 같은 이름의 종목을 구분하는
                보조 정보라 뒤에 둔다. */}
            <div className="flex items-baseline gap-2">
                <span className="truncate font-medium text-secondary-100">
                    {primaryName}
                </span>
                {badge && <MarketBadge {...badge} />}
                <span className="shrink-0 text-sm text-secondary-400">
                    {result.symbol}
                </span>
                {secondaryName && (
                    <span className="truncate text-sm text-secondary-500">
                        {secondaryName}
                    </span>
                )}
            </div>
        </button>
    );
}
