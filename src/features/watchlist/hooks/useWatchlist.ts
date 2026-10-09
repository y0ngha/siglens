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
import { useLocalWatchlist } from './useLocalWatchlist';

export type WatchlistToggleOutcome =
    | 'added'
    | 'removed'
    | 'at_limit'
    | 'failed';

export interface UseWatchlistResult {
    /** 회원: 서버, 비회원: 로컬. 최근 담은 순. */
    items: WatchlistItemView[];
    has: (symbol: string) => boolean;
    /** 있으면 빼고 없으면 담는다. 담기 성공에만 `watchlist_added {source}`를 보낸다. */
    toggle: (
        entry: RawWatchlistInput,
        source: WatchlistSource
    ) => Promise<WatchlistToggleOutcome>;
    /** 명시적 삭제(내 종목 섹션·보유로 전환). 이벤트 없음. */
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

/**
 * 소비자가 회원 여부를 모르게 하는 통합 훅. 회원 판정은 `usePortfolioHoldings`와 같은 규칙
 * (힌트 쿠키 또는 `currentUser` 확정)이다. 비회원 **확정 전**(힌트 없음·조회 pending)에는
 * 로컬을 쓴다 — 토글을 막지 않고, 회원으로 판명되면 `useWatchlistMerge`가 로컬을 계정으로 옮긴다.
 * 로그아웃 뒤에는 로컬이 빈 상태로 시작한다(계정 데이터를 로컬에 복사하지 않는다 — 공용 PC).
 */
export function useWatchlist(): UseWatchlistResult {
    const hydrated = useHydrated();
    const hasAuthHint = useAuthHint();
    const { data: currentUser, isPending: isUserPending } = useCurrentUser();
    const isMemberLikely = hasAuthHint || currentUser != null;
    // "아직 모름"은 데이터(`undefined`)가 아니라 쿼리 상태로 판단한다(`usePortfolioHoldings`와 동일).
    const isIdentityPending = hydrated && !hasAuthHint && isUserPending;
    const server = useWatchlistQuery({ enabled: hydrated && isMemberLikely });
    const {
        entries: localEntries,
        add: addLocal,
        remove: removeLocal,
    } = useLocalWatchlist();
    const { mutateAsync: addServer } = server.add;
    const { mutateAsync: removeServer } = server.remove;
    const { showToast } = useToast();
    const t = useTranslations('features.watchlist');

    const localViews = useMemo(
        () => toWatchlistViews(localEntries),
        [localEntries]
    );
    const items = isMemberLikely ? server.items : localViews;
    const limit = isMemberLikely ? WATCHLIST_MAX_MEMBER : WATCHLIST_MAX_LOCAL;
    const isHydrated = hydrated && (!isMemberLikely || !server.isPending);
    const isAtLimit = items.length >= limit;

    const has = useMemo(() => {
        const symbols = new Set(items.map(item => item.symbol));
        return (symbol: string): boolean => symbols.has(symbol.toUpperCase());
    }, [items]);

    // 핸들러는 최신 렌더 값을 ref로 읽는다 — 그래야 `toggle`·`remove`가 데이터가 바뀌어도
    // 같은 참조로 남아 소비자의 effect·memo deps를 흔들지 않는다. ref는 effect에서 갱신한다.
    const latestRef = useRef({
        has,
        isAtLimit,
        isMemberLikely,
        limit,
        showToast,
        t,
    });
    useEffect(() => {
        latestRef.current = {
            has,
            isAtLimit,
            isMemberLikely,
            limit,
            showToast,
            t,
        };
    }, [has, isAtLimit, isMemberLikely, limit, showToast, t]);

    const remove = useCallback(
        async (symbol: string): Promise<boolean> => {
            const { isMemberLikely, showToast, t } = latestRef.current;
            if (!isMemberLikely) {
                if (removeLocal(symbol)) return true;
                showToast({ message: t('toast.failed') });
                return false;
            }
            try {
                const result = await removeServer(symbol);
                if (result.status === 'ok') return true;
                showToast({ message: result.message });
                return false;
            } catch {
                showToast({ message: t('toast.failed') });
                return false;
            }
        },
        [removeLocal, removeServer]
    );

    const toggle = useCallback(
        async (
            entry: RawWatchlistInput,
            source: WatchlistSource
        ): Promise<WatchlistToggleOutcome> => {
            const { has, isAtLimit, isMemberLikely, limit, showToast, t } =
                latestRef.current;
            if (has(entry.symbol)) {
                return (await remove(entry.symbol)) ? 'removed' : 'failed';
            }
            if (isAtLimit) {
                showToast({ message: t('toast.limit', { v0: limit }) });
                return 'at_limit';
            }
            if (!isMemberLikely) {
                if (!addLocal(entry)) {
                    showToast({ message: t('toast.failed') });
                    return 'failed';
                }
                trackFunnelEvent('watchlist_added', { source });
                return 'added';
            }
            try {
                const result = await addServer(entry);
                if (result.status !== 'ok') {
                    showToast({ message: result.message });
                    return 'failed';
                }
                trackFunnelEvent('watchlist_added', { source });
                return 'added';
            } catch {
                showToast({ message: t('toast.failed') });
                return 'failed';
            }
        },
        [addLocal, addServer, remove]
    );

    return {
        items,
        has,
        toggle,
        remove,
        isHydrated,
        isAtLimit,
        limit,
        isMember: isMemberLikely,
        isIdentityPending,
    };
}
