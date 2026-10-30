'use client';

import { useTranslations } from 'next-intl';
import type { UseRecentSearchesResult } from '../../hooks/useRecentSearches';

interface OverlayRecentSearchesProps {
    entries: UseRecentSearchesResult['recentSearches'];
    onSelect: (symbol: string, label: string) => void;
    /**
     * "전체 삭제". 이 섹션을 통째로 언마운트시키므로 호출부가 포커스를 입력으로 돌려야 한다
     * — 두면 포커스가 `<body>`로 떨어져 다음 Tab이 문서 처음부터 시작한다(WCAG 2.4.3).
     */
    onClearAll: () => void;
}

/**
 * 검색 오버레이의 최근 검색 칩(질의가 없을 때). 저장된 항목을 **전부** 보여 준다 — 최근 본
 * 종목 사이를 오가는 것이 이 화면의 용도이고, 오버레이 목록은 늘 스크롤되므로 세로가
 * 제약이 아니다(홈 히어로는 `HERO_RECENT_CHIP_LIMIT`로 자른다).
 */
export function OverlayRecentSearches({
    entries,
    onSelect,
    onClearAll,
}: OverlayRecentSearchesProps) {
    const t = useTranslations('features.ticker-search');

    return (
        <section>
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <h2 className="text-xs font-medium text-secondary-400">
                    {t('search.recentHeading')}
                </h2>
                <button
                    type="button"
                    onClick={onClearAll}
                    className="inline-flex min-h-11 touch-manipulation items-center px-1 text-xs text-secondary-400 transition-colors hover:text-secondary-200 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    {t('search.clearAll')}
                </button>
            </div>
            <div className="flex flex-wrap gap-2 px-4 pb-3">
                {entries.map(entry => (
                    <button
                        key={entry.symbol}
                        type="button"
                        onClick={() => onSelect(entry.symbol, entry.label)}
                        className="min-h-11 max-w-[12rem] touch-manipulation truncate rounded-full border border-primary-500 bg-primary-600/5 px-3 text-xs text-secondary-200 transition-colors hover:border-primary-400 hover:text-primary-300 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                        {entry.label}
                    </button>
                ))}
            </div>
        </section>
    );
}
