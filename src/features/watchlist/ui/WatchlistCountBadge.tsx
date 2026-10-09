'use client';

import { useTranslations } from 'next-intl';
import { useWatchlist } from '../hooks/useWatchlist';

/**
 * 프로필 메뉴 "내 종목" 옆 관심종목 개수. 하이드레이션 후, 0이면 생략(§6.1a). 메뉴는 로그인
 * 상태에서만 열리므로 여기의 `useWatchlist`는 서버 목록을 읽는다 — 그 쿼리는 헤더가 이미
 * 켜 두므로 추가 요청이 없다.
 */
export function WatchlistCountBadge() {
    const t = useTranslations('features.watchlist');
    const { items, isHydrated } = useWatchlist();
    if (!isHydrated || items.length === 0) return null;
    return (
        <span className="ml-auto rounded-full bg-secondary-700 px-2 py-0.5 text-xs font-semibold text-secondary-100 tabular-nums">
            <span aria-hidden="true">{items.length}</span>
            <span className="sr-only">
                {t('badge.count', { v0: items.length })}
            </span>
        </span>
    );
}
