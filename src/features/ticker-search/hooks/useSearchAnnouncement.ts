'use client';

import { useTranslations } from 'next-intl';
import type { SearchStatus } from '../lib/searchStatus';

/**
 * 검색 상태의 라이브 리전 문구. 데스크톱 자동완성과 모바일 오버레이가 같은 문구로 고지한다.
 *
 * 화면 문구와 따로 둔다 — 화면은 짧은 상태만 보이고, 보조기술에는 결과 수까지 알린다.
 * 한글 막다른 길의 출구(티커로 다시 치기)도 화면에만 두면 스크린리더 사용자가 못 듣는다
 * (WCAG 4.1.3).
 */
export function useSearchAnnouncement(
    status: SearchStatus,
    resultCount: number
): string {
    const t = useTranslations('features.ticker-search');
    const announcements: Record<SearchStatus, () => string> = {
        idle: () => t('search.typeToSearch'),
        searching: () => t('search.searching'),
        error: () => t('search.loadFailed'),
        results: () => t('search.resultsCount', { v0: resultCount }),
        emptyKorean: () => t('search.noResultsTryTicker'),
        empty: () => t('search.noResults'),
    };
    return announcements[status]();
}
