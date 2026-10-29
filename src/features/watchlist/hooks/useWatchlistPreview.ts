'use client';

import type { WatchlistPreviewTab } from '../lib/watchlistTabs';
import { useRecentSymbols } from './useRecentSymbols';
import { useWatchlist } from './useWatchlist';

/** 미리보기·홈 카드·최근 본 목록의 한 행. 회원·비회원·최근 본이 이 모양으로 수렴한다. */
export interface WatchlistPreviewItem {
    symbol: string;
    /** 화면에 그릴 이름. 담을 때(또는 볼 때) 저장한 표시명, 없으면 심볼. */
    name: string;
}

/** `useWatchlistPreview`의 반환값. */
export interface UseWatchlistPreviewResult {
    watchlist: WatchlistPreviewItem[];
    recent: WatchlistPreviewItem[];
    /**
     * 관심종목 목록을 믿고 그려도 되는가. 하이드레이션 전이거나 회원 여부를 아직 모르는 동안의 빈
     * 목록은 "담은 게 없음"이 아니다(`useWatchlist`의 `isIdentityPending`).
     */
    isReady: boolean;
    /** 처음 열 때의 탭 — 담은 게 있으면 관심, 없고 최근 본이 있으면 최근 본. */
    defaultTab: WatchlistPreviewTab;
}

/**
 * 헤더 ★·홈 카드·`/watchlist`가 함께 쓰는 목록 원천. 회원 여부(서버/로컬)는 `useWatchlist`가,
 * 최근 본은 기기 로컬이 맡는다. 시세는 여기서 읽지 않는다 — 행마다 보일 때만 읽는다.
 */
export function useWatchlistPreview(): UseWatchlistPreviewResult {
    const { items, isHydrated, isIdentityPending } = useWatchlist();
    const { entries } = useRecentSymbols();

    // 이름은 저장된 표시명만 쓴다. 카탈로그 한글명(`useAssetLabel`)을 읽으면 이 훅을 쓰는 헤더
    // 때문에 `shared.assetName` 네임스페이스 전체가 모든 라우트의 첫 로드에 실린다(I18-5).
    // 담는 쪽(종목 헤더·검색·인기 종목)이 이미 그 화면의 표시명을 저장하므로 대부분 같은 이름이다.
    const watchlist = items.map(item => ({
        symbol: item.symbol,
        name: item.companyName ?? item.symbol,
    }));
    const recent = entries.map(entry => ({
        symbol: entry.symbol,
        name: entry.label,
    }));
    const isReady = isHydrated && !(items.length === 0 && isIdentityPending);
    const defaultTab: WatchlistPreviewTab =
        watchlist.length === 0 && recent.length > 0 ? 'recent' : 'watchlist';

    return { watchlist, recent, isReady, defaultTab };
}
