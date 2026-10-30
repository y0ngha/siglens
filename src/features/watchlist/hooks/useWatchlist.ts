'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useAuthHint } from '@/entities/auth/hooks/useAuthHint';
import { useCurrentUser } from '@/entities/auth/hooks/useCurrentUser';
import { useWatchlistQuery } from '@/entities/watchlist/hooks/useWatchlistQuery';
import type {
    RawWatchlistInput,
    WatchlistItemView,
    WatchlistSource,
} from '@/entities/watchlist/model';
import {
    WATCHLIST_MAX_LOCAL,
    WATCHLIST_MAX_MEMBER,
} from '@/shared/config/watchlist';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { trackFunnelEvent } from '@/shared/lib/funnel/trackFunnelEvent';
import { useToast } from '@/shared/ui/ToastProvider';
import { toWatchlistViews } from '../lib/localWatchlist';
import {
    addToWatchlist,
    removeFromWatchlist,
    toggleWatchlist,
    type WatchlistAddOutcome,
    type WatchlistToggleOutcome,
    type WatchlistWriteContext,
} from '../lib/watchlistWrites';
import { useLocalWatchlist } from './useLocalWatchlist';

/** `useWatchlist`의 반환값. 함수(`has` 제외)는 데이터가 바뀌어도 참조가 유지된다. */
export interface UseWatchlistResult {
    /** 회원: 서버, 비회원: 로컬. 최근 담은 순. */
    items: WatchlistItemView[];
    has: (symbol: string) => boolean;
    /** 있으면 빼고 없으면 담는다. 담기 성공에만 `watchlist_added {source}`를 보낸다. */
    toggle: (
        entry: RawWatchlistInput,
        source: WatchlistSource
    ) => Promise<WatchlistToggleOutcome>;
    /**
     * 담기 전용. 이미 담겨 있으면(다른 탭에서 먼저 담은 경우 포함) 아무것도 하지 않고 `added`를
     * 돌려준다 — `toggle`과 달리 절대 빼지 않는다. 이벤트는 실제로 담았을 때만 보낸다.
     */
    add: (
        entry: RawWatchlistInput,
        source: WatchlistSource
    ) => Promise<WatchlistAddOutcome>;
    /** 명시적 삭제(`/watchlist` 목록·보유로 전환·검색 담기 되돌리기). 이벤트 없음. */
    remove: (symbol: string) => Promise<boolean>;
    /** 하이드레이션 전(회원은 첫 목록 도착 전)엔 false — 토글 비활성, 목록 비어 있음. */
    isHydrated: boolean;
    isAtLimit: boolean;
    limit: number;
    /** 회원일 가능성(힌트 쿠키 또는 `currentUser` 확정). 목록 출처와 "보유로 전환" 노출이 이 값을 따른다. */
    isMember: boolean;
    /**
     * 회원인지 비회원인지 아직 모른다(힌트 없음 · `currentUser` 조회 중). 이 동안 `items`는 로컬
     * 목록이라 "비어 있음"이 "계정에 없음"을 뜻하지 않는다 — 빈 상태 CTA는 이 값이 false일 때만 그린다.
     */
    isIdentityPending: boolean;
}

function trackWatchlistAdded(source: WatchlistSource): void {
    trackFunnelEvent('watchlist_added', { source });
}

/**
 * 소비자가 회원 여부를 모르게 하는 통합 훅. 회원 판정은 `usePortfolioHoldings`와 같은 규칙
 * (힌트 쿠키 또는 `currentUser` 확정)이다. 비회원 **확정 전**(힌트 없음·조회 pending)에는
 * 로컬을 쓴다 — 토글을 막지 않고, 회원으로 판명되면 `useWatchlistMerge`가 로컬을 계정으로 옮긴다.
 * 로그아웃 뒤에는 로컬이 빈 상태로 시작한다(계정 데이터를 로컬에 복사하지 않는다 — 공용 PC).
 * 담기·빼기 절차는 `watchlistWrites`가 정하고, 이 훅은 최신 렌더 값으로 그 컨텍스트를 만든다.
 */
export function useWatchlist(): UseWatchlistResult {
    const hydrated = useHydrated();
    const hasAuthHint = useAuthHint();
    const { data: currentUser, isPending: isUserPending } = useCurrentUser();
    const {
        entries: localEntries,
        add: addLocal,
        remove: removeLocal,
    } = useLocalWatchlist();
    const { showToast } = useToast();
    const t = useTranslations('features.watchlist');

    const isMemberLikely = hasAuthHint || currentUser != null;
    // "아직 모름"은 데이터(`undefined`)가 아니라 쿼리 상태로 판단한다(`usePortfolioHoldings`와 동일).
    const isIdentityPending = hydrated && !hasAuthHint && isUserPending;
    // HK-1 예외: 회원 추정(`isMemberLikely`)이 켜고 끄는 쿼리라 그 파생값 뒤에 둔다.
    const server = useWatchlistQuery({ enabled: hydrated && isMemberLikely });
    const { mutateAsync: addServer } = server.add;
    const { mutateAsync: removeServer } = server.remove;
    const localViews = useMemo(
        () => toWatchlistViews(localEntries),
        [localEntries]
    );
    const items = isMemberLikely ? server.items : localViews;
    const limit = isMemberLikely ? WATCHLIST_MAX_MEMBER : WATCHLIST_MAX_LOCAL;
    const isHydrated = hydrated && (!isMemberLikely || !server.isPending);
    const isAtLimit = items.length >= limit;
    const failedMessage = t('toast.failed');
    const limitMessage = t('toast.limit', { v0: limit });

    // HK-1 예외: 출처가 정해진 `items`(파생값)에서 만든다.
    const has = useMemo(() => {
        const symbols = new Set(items.map(item => item.symbol));
        return (symbol: string): boolean => symbols.has(symbol.toUpperCase());
    }, [items]);
    // HK-1 예외: 위 파생값들로 만드는 쓰기 컨텍스트다.
    const context = useMemo<WatchlistWriteContext>(
        () => ({
            isMember: isMemberLikely,
            has,
            isAtLimit,
            failedMessage,
            limitMessage,
            showMessage: message => showToast({ message }),
            track: trackWatchlistAdded,
            addLocal,
            removeLocal,
            addServer,
            removeServer,
        }),
        [
            isMemberLikely,
            has,
            isAtLimit,
            failedMessage,
            limitMessage,
            showToast,
            addLocal,
            removeLocal,
            addServer,
            removeServer,
        ]
    );
    // HK-1 예외: 첫 렌더의 `context`로 시작한다. 핸들러가 최신 렌더 값을 ref로 읽어야
    // `toggle`·`add`·`remove`가 데이터가 바뀌어도 같은 참조로 남아 소비자의 effect·memo deps를
    // 흔들지 않는다. ref는 아래 effect에서 갱신한다.
    const latestRef = useRef(context);
    // HK-1 예외: 위 ref를 읽는 핸들러라 ref 뒤에 둔다.
    const remove = useCallback(
        (symbol: string): Promise<boolean> =>
            removeFromWatchlist(latestRef.current, symbol),
        []
    );
    // HK-1 예외: 위 ref를 읽는 핸들러라 ref 뒤에 둔다.
    const add = useCallback(
        (
            entry: RawWatchlistInput,
            source: WatchlistSource
        ): Promise<WatchlistAddOutcome> =>
            addToWatchlist(latestRef.current, entry, source),
        []
    );
    // HK-1 예외: 위 ref를 읽는 핸들러라 ref 뒤에 둔다.
    const toggle = useCallback(
        (
            entry: RawWatchlistInput,
            source: WatchlistSource
        ): Promise<WatchlistToggleOutcome> =>
            toggleWatchlist(latestRef.current, entry, source),
        []
    );

    useEffect(() => {
        latestRef.current = context;
    }, [context]);

    return {
        items,
        has,
        toggle,
        add,
        remove,
        isHydrated,
        isAtLimit,
        limit,
        isMember: isMemberLikely,
        isIdentityPending,
    };
}
