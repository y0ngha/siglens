'use client';

import { SearchWatchlistStar } from '@/features/watchlist/ui/SearchWatchlistStar';
import { cn } from '@/shared/lib/cn';
import type { TickerSearchResult } from '@/shared/lib/types';
import { marketBadgeSpec, resultDisplayNames } from '../lib/resultDisplay';
import { MarketBadge } from './MarketBadge';

interface AutocompleteOptionProps {
    /** `aria-activedescendant`가 가리키는 id. */
    id: string;
    result: TickerSearchResult;
    /** 방향키로 활성화된 옵션인지. */
    isSelected: boolean;
    onSelect: (symbol: string, label: string) => void;
    onPrefetch: (symbol: string) => void;
    /** 옵션 옆에 관심종목 ★를 붙일지. */
    showWatchlistStar: boolean;
}

/**
 * 데스크톱 자동완성(`TickerAutocomplete`) listbox의 옵션 한 행.
 *
 * 옵션은 탭 정지점이 아니다(`tabIndex=-1`) — combobox에서 포커스는 늘 입력에 있고 활성
 * 옵션은 `aria-activedescendant`로만 가리킨다. 탭 정지점이면 Tab이 입력을 떠나 목록 안을
 * 돌고, 그 사이 입력은 열린 목록을 가진 채 포커스를 잃는다.
 *
 * 표시 규칙(한글명 우선·국내 종목 영문명 억제·시장 배지)은 오버레이와 공유한다
 * (`lib/resultDisplay.ts`).
 */
export function AutocompleteOption({
    id,
    result,
    isSelected,
    onSelect,
    onPrefetch,
    showWatchlistStar,
}: AutocompleteOptionProps) {
    const { primaryName, secondaryName } = resultDisplayNames(result);
    const badge = marketBadgeSpec(result);

    const option = (
        <button
            id={id}
            type="button"
            role="option"
            tabIndex={-1}
            aria-selected={isSelected}
            onClick={() => onSelect(result.symbol, primaryName)}
            onMouseEnter={() => onPrefetch(result.symbol)}
            className={cn(
                'hover:bg-secondary-700 focus-visible:ring-primary-500 px-4 py-2 text-left transition-colors focus-visible:ring-1 focus-visible:outline-none',
                showWatchlistStar ? 'min-w-0 flex-1' : 'w-full',
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
    if (!showWatchlistStar) return option;
    // 옵션 안에는 상호작용 요소를 둘 수 없어 ★를 옵션의 형제로 둔다. ★는 포인터 전용 보조
    // 컨트롤이라 접근성 트리에서 숨기고(`aria-hidden` + `tabIndex=-1`) — 그래야 listbox가 옵션만
    // 소유한다(`role="none"` 래퍼만으로는 ★ 버튼이 listbox의 자식으로 남는다). 보조기술 사용자는
    // 버튼 목록인 모바일 검색 오버레이의 ★나 종목 헤더 ☆로 담는다.
    return (
        <div role="none" className="flex items-center">
            {option}
            <SearchWatchlistStar
                symbol={result.symbol}
                label={primaryName}
                focusable={false}
                className="mr-1 size-9"
            />
        </div>
    );
}
