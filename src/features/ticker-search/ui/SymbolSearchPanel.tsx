'use client';

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { SearchIcon } from '@/shared/ui/StrokeIcons';
import { useRecentSearches } from '../hooks/useRecentSearches';
import { focusSearchSurface } from '../lib/focusSearchSurface';
import { SEARCH_PLACEHOLDER_KEY } from '../lib/searchLabels';
import { useSearchOverlayTrigger } from '../model/SearchOverlayContext';
import { HeroRecentSearches } from './HeroRecentSearches';
import { TickerAutocomplete } from './TickerAutocomplete';

interface SymbolSearchPanelProps {
    className?: string;
}

/**
 * 홈 히어로(와 404 화면)의 검색 패널. 브레이크포인트마다 검색 표면이 다르다 — 모바일은
 * 전체화면 오버레이를 여는 트리거, 데스크톱(`lg`)은 인라인 자동완성. 아래에 최근 검색 칩을 둔다.
 */
export function SymbolSearchPanel({ className }: SymbolSearchPanelProps) {
    const t = useTranslations('features.ticker-search');
    const triggerRef = useRef<HTMLButtonElement>(null);
    const desktopSearchRef = useRef<HTMLDivElement>(null);

    const { recentSearches, addSearch, removeSearch, clearAll } =
        useRecentSearches();
    const overlay = useSearchOverlayTrigger();

    // 칩 행이 사라진 뒤 그 행에서 이어질 만한 유일한 행동은 검색이다.
    function focusVisibleSearchSurface() {
        focusSearchSurface(triggerRef.current, desktopSearchRef.current);
    }

    return (
        <div className={cn('flex w-full flex-col', className)}>
            {/*
                모바일에서는 히어로 검색창이 **트리거**다.
                폭이 아니라 키보드가 문제여서다 — 이 입력은 이미 전폭이지만, 탭하면
                키보드가 화면의 45%를 먹어 앵커드 드롭다운에 남는 세로가 ~140px(항목
                2~3개)뿐이다. 헤더 검색과 같은 전체화면 오버레이로 보내 검색 경험을
                한 벌로 유지한다.

                겉모습은 그대로 둔다 — 홈의 주 행동 유도라 시각적 앵커가 필요하다.
                실제 `<input>` 대신 버튼을 쓰는 이유는, 타이핑을 받지 못하는 입력이
                포커스만 먹고 키보드를 올리면 사용자가 "먹통"으로 읽기 때문이다.
            */}
            {/* provider가 없으면(테스트·스토리북) 트리거 자체를 렌더하지 않는다.
                누르면 아무 일도 없는 컨트롤을 홈의 주 CTA 자리에 두는 것보다 낫다 —
                `HeaderSearch`와 같은 정책. */}
            {overlay && (
                <button
                    ref={triggerRef}
                    type="button"
                    onClick={overlay.open}
                    // aria-label을 두지 않는다. 버튼의 텍스트가 곧 접근 이름이 되고,
                    // 그게 화면에 보이는 문구와 일치해야 한다(WCAG 2.5.3 Label in Name).
                    className="focus-glow flex h-12 w-full touch-manipulation items-center gap-2 rounded-lg border border-border-control bg-secondary-800 px-4 text-left text-base text-secondary-400 transition-colors hover:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none lg:hidden"
                >
                    <SearchIcon className="size-4 shrink-0" />
                    {t(SEARCH_PLACEHOLDER_KEY)}
                </button>
            )}
            <div ref={desktopSearchRef} className="hidden lg:block">
                <TickerAutocomplete
                    size="lg"
                    onSelect={addSearch}
                    showWatchlistStar
                />
            </div>

            <HeroRecentSearches
                entries={recentSearches}
                onSelect={addSearch}
                onRemove={removeSearch}
                onClearAll={clearAll}
                onEmptied={focusVisibleSearchSurface}
            />
        </div>
    );
}
