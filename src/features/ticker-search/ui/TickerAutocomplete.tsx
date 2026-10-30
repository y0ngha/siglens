'use client';

import { type MouseEvent, useId } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { SURFACE_FLOATING } from '@/shared/lib/surfaceStyles';
import {
    useAutocomplete,
    type UseAutocompleteOptions,
} from '../hooks/useAutocomplete';
import { useSearchAnnouncement } from '../hooks/useSearchAnnouncement';
import type { SearchStatus } from '../lib/searchStatus';
import { AutocompleteOption } from './AutocompleteOption';

type TickerAutocompleteSize = 'sm' | 'lg';

const INPUT_BASE =
    'bg-secondary-800 border-border-control text-secondary-100 placeholder-secondary-500 focus:border-primary-600 focus:ring-primary-500 rounded-lg border transition-colors outline-none focus:ring-1';
/*
 * `lg`는 홈 히어로 전용이다(다른 소비처는 전부 `sm`). 검색은 그 페이지의 주 행동이라
 * 화면에서 가장 큰 인터랙티브 요소여야 하고, 헤더 검색(h-11)과 확실히 달라야 위계가 선다.
 * 포커스는 링이 아니라 보더 굵기로 표현해(`focus-glow`) 큰 입력에서
 * 링이 과하게 두꺼워 보이는 문제를 피한다.
 */
const INPUT_SIZE: Record<TickerAutocompleteSize, string> = {
    sm: 'h-11 px-3 text-sm',
    lg: 'focus-glow h-14 px-5 text-lg',
};

const BUTTON_BASE =
    'bg-primary-600 hover:bg-primary-700 shrink-0 rounded-lg font-semibold whitespace-nowrap text-white transition-colors focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none';
const BUTTON_SIZE: Record<TickerAutocompleteSize, string> = {
    sm: 'h-11 px-3 text-sm sm:px-4',
    lg: 'h-14 w-full px-7 text-base sm:w-auto',
};

const STATUS_ROW_CLASS = 'px-4 py-3 text-sm text-secondary-400';

/**
 * 드롭다운 안의 클릭이 입력의 포커스를 빼앗지 않게 한다. 포커스가 입력에 남아야 blur로
 * 목록이 닫히지 않고(닫히면 클릭이 닿기 전에 옵션이 사라진다) 키보드 조작도 이어진다.
 */
function keepInputFocus(e: MouseEvent<HTMLDivElement>): void {
    e.preventDefault();
}

interface TickerAutocompleteProps {
    className?: string;
    /** `lg`는 홈 히어로 전용이다. */
    size?: TickerAutocompleteSize;
    /** 종목을 고르면 부른다(`useAutocomplete`의 `onSelect`). */
    onSelect?: UseAutocompleteOptions['onSelect'];
    /** `useAutocomplete`의 `navigateOnSelect`. 폼 안의 값 선택기로 쓸 때 false를 넘긴다. */
    navigateOnSelect?: boolean;
    /**
     * 입력의 겉모습(배경·높이·보더·포커스 링)을 호스트 폼에 맞춘다 — 예: `HoldingForm`의
     * 옆 칸(수량·가격) 입력. 크기별 기본값 위에 `cn`(`twMerge`)으로 합치므로 뒤의 유틸리티가
     * 이긴다. 다른 소비처(헤더·홈 히어로)의 기본 모양은 그대로다.
     */
    inputClassName?: string;
    /** 입력에 그대로 넘긴다 — 호스트 폼이 자기 칸 오류를 이 입력에 잇는다. */
    ariaInvalid?: boolean;
    /** 입력에 그대로 넘긴다 — 호스트 폼이 자기 칸 오류 문구를 이 입력에 잇는다. */
    ariaDescribedby?: string;
    /**
     * 호스트 폼의 보이는 칸 라벨(예: `HoldingForm`의 "종목")을 입력·listbox의 접근 이름으로
     * 쓴다. 주면 기본 `aria-label`("종목 티커 검색")을 붙이지 않는다 — 화면의 말과 접근
     * 이름이 같아야 한다.
     */
    ariaLabelledby?: string;
    /** 입력 id. 헤더 검색만 준다 — 다른 곳의 "종목 검색" 버튼이 이 입력에 포커스를 보낸다. */
    inputId?: string;
    /** 결과 행에 관심종목 ★를 붙인다. 종목 페이지로 가는 검색에만 준다(폼 입력에는 주지 않는다). */
    showWatchlistStar?: boolean;
}

/**
 * 데스크톱 인라인 종목 자동완성(WAI-ARIA combobox + listbox). 헤더·홈 히어로의 검색창이고,
 * `navigateOnSelect={false}`로 폼 안의 종목 선택기(`HoldingForm`)로도 쓴다.
 *
 * id는 `useId`로 인스턴스마다 만든다 — 홈에서는 헤더와 히어로에 두 벌이 동시에 떠서,
 * 고정 id면 `aria-controls`·`aria-activedescendant`가 다른 인스턴스의 요소를 가리킨다.
 *
 * 조회 중·실패·결과 없음 문구는 listbox **밖**에 둔다 — listbox는 옵션만 소유해야 하고,
 * 옵션이 없으면 listbox를 그리지 않는다(`aria-expanded`도 그때만 true). 상태 변화는 항상
 * 마운트된 라이브 리전이 고지한다.
 */
export function TickerAutocomplete({
    className,
    size = 'sm',
    onSelect,
    navigateOnSelect,
    inputClassName,
    ariaInvalid,
    ariaDescribedby,
    ariaLabelledby,
    inputId,
    showWatchlistStar = false,
}: TickerAutocompleteProps) {
    const t = useTranslations('features.ticker-search');
    const baseId = useId();
    const {
        query,
        results,
        status,
        selectedIndex,
        isOpen,
        inputRef,
        dropdownRef,
        handleChange,
        handleKeyDown,
        handleFocus,
        handleBlur,
        handleSearchClick,
        navigate,
        prefetch,
    } = useAutocomplete({ onSelect, navigateOnSelect });
    const announcement = useSearchAnnouncement(status, results.length);

    const listboxId = `${baseId}-listbox`;
    const optionId = (index: number): string => `${baseId}-option-${index}`;
    const isListboxShown = isOpen && results.length > 0;
    const activeOptionId =
        isListboxShown && results[selectedIndex]
            ? optionId(selectedIndex)
            : undefined;
    // 화면의 상태 문구. 결과 행이 있는 동안의 재조회에도 "검색 중…"을 함께 보인다.
    const statusTexts: Record<SearchStatus, (() => string) | null> = {
        idle: null,
        searching: () => t('TickerAutocomplete.e39068'),
        // "결과 없음"과 "조회 실패"는 다르다. 구분하지 않으면 검색이 죽어도 "결과
        // 없음"으로 보이고, 한글 질의에는 "티커로 쳐보세요"라는 틀린 안내까지 나간다.
        // 오버레이와 같은 문구.
        error: () => t('search.loadFailedRetry'),
        results: null,
        emptyKorean: () => t('TickerAutocomplete.e62852'),
        empty: () => t('TickerAutocomplete.5dd6d9'),
    };
    const statusText = statusTexts[status]?.();
    const accessibleName = ariaLabelledby
        ? undefined
        : t('TickerAutocomplete.30cf1e');

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
                    id={inputId}
                    name="symbol"
                    autoComplete="off"
                    role="combobox"
                    aria-label={accessibleName}
                    aria-labelledby={ariaLabelledby}
                    aria-expanded={isListboxShown}
                    aria-haspopup="listbox"
                    aria-controls={isListboxShown ? listboxId : undefined}
                    aria-autocomplete="list"
                    aria-activedescendant={activeOptionId}
                    aria-invalid={ariaInvalid}
                    aria-describedby={ariaDescribedby}
                    type="text"
                    value={query}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    placeholder={t('TickerAutocomplete.124e37')}
                    className={cn(
                        INPUT_BASE,
                        INPUT_SIZE[size],
                        'w-full min-w-0',
                        inputClassName
                    )}
                />
                {isOpen && (
                    // 의미 없는 배치용 래퍼다(`role="presentation"`) — mousedown 처리는 포인터
                    // 전용이고, 키보드 조작은 입력의 onKeyDown이 모두 맡는다.
                    <div
                        ref={dropdownRef}
                        role="presentation"
                        onMouseDown={keepInputFocus}
                        className={cn(
                            SURFACE_FLOATING,
                            'absolute top-full left-0 z-50 mt-1 w-full overflow-hidden shadow-lg'
                        )}
                    >
                        {statusText && (
                            // 같은 문구를 아래 라이브 리전이 고지한다 — 보조기술이 두 번 읽지 않게 시각 행은 숨긴다.
                            <div
                                aria-hidden="true"
                                className={STATUS_ROW_CLASS}
                            >
                                {statusText}
                            </div>
                        )}
                        {isListboxShown && (
                            <div
                                id={listboxId}
                                role="listbox"
                                aria-label={accessibleName}
                                aria-labelledby={ariaLabelledby}
                            >
                                {results.map((result, index) => (
                                    <AutocompleteOption
                                        key={result.symbol}
                                        id={optionId(index)}
                                        result={result}
                                        isSelected={index === selectedIndex}
                                        onSelect={navigate}
                                        onPrefetch={prefetch}
                                        showWatchlistStar={showWatchlistStar}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
                {/* 항상 마운트해 두고 내용만 바꾼다 — 내용과 함께 삽입된 리전은 첫 고지를 놓친다. */}
                <p role="status" className="sr-only">
                    {isOpen ? announcement : ''}
                </p>
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
