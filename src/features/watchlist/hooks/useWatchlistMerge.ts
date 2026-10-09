'use client';

import { useEffect, useEffectEvent, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useCurrentUser } from '@/entities/auth/hooks/useCurrentUser';
import { mergeWatchlistAction } from '@/entities/watchlist/actions/mergeWatchlistAction';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { WATCHLIST_MAX_MEMBER } from '@/shared/config/watchlist';
import { trackFunnelEvent } from '@/shared/lib/funnel/trackFunnelEvent';
import { useToast } from '@/shared/ui/ToastProvider';
import { readLocalWatchlist } from '../lib/localWatchlist';
import {
    clearWatchlistMergedThisSession,
    hasWatchlistMergedThisSession,
    markWatchlistMergedThisSession,
} from '../lib/mergeSession';
import { useLocalWatchlist } from './useLocalWatchlist';

/**
 * 로그인이 **확정**된 뒤(`currentUser.data !== null`) 로컬 관심종목을 계정으로 한 번 합친다(§5).
 * 시도는 페이지 로드·사용자당 **한 번**이다 — 실패하면 로컬·플래그를 그대로 두고(다음 페이지
 * 로드에서 다시) 이 로드에서는 재시도하지 않는다. 무제한 재시도는 서버 장애·미인증 응답에서
 * 경로마다 액션을 두드린다. 성공 토스트는 가입 직후 랜딩(`/portfolio`)을 포함해 어느
 * 페이지에서든 뜬다.
 *
 * 등록 effect의 deps는 원시값만이다(userId·로컬 개수). 실제 작업은 `useEffectEvent`가
 * 최신 번역자·토스트·쿼리 클라이언트를 읽어 수행한다.
 */
export function useWatchlistMerge(): void {
    const inFlightRef = useRef(false);
    const attemptedUserIdRef = useRef<string | null>(null);
    // 직전 렌더의 userId. `null`은 "로그아웃"과 "첫 응답 전(pending)"을 모두 뜻하므로, 세션
    // 플래그는 회원이었다가 `null`이 된 전이에서만 지운다.
    const previousUserIdRef = useRef<string | null>(null);
    const { data: user } = useCurrentUser();
    const { entries, clear } = useLocalWatchlist();
    const qc = useQueryClient();
    const { showToast } = useToast();
    const t = useTranslations('features.watchlist');

    const userId = user?.id ?? null;
    const localCount = entries.length;

    const runMerge = useEffectEvent(async (id: string) => {
        if (
            inFlightRef.current ||
            attemptedUserIdRef.current === id ||
            hasWatchlistMergedThisSession()
        )
            return;
        const local = readLocalWatchlist();
        if (local.length === 0) return;
        inFlightRef.current = true;
        attemptedUserIdRef.current = id;
        // `try … finally`는 React Compiler가 아직 내리지 못한다(react-hooks-js/todo) — 요청만
        // try/catch로 감싸고 in-flight 해제는 그 뒤에 한 번 한다.
        let result: Awaited<ReturnType<typeof mergeWatchlistAction>> | null;
        try {
            result = await mergeWatchlistAction(
                local.map(entry => ({
                    symbol: entry.symbol,
                    label: entry.label,
                }))
            );
        } catch {
            // 조용히 — 로컬이 남아 있으므로 다음 페이지 로드에서 다시 시도한다.
            result = null;
        }
        inFlightRef.current = false;
        if (result === null || result.status !== 'ok') return;
        clear();
        markWatchlistMergedThisSession();
        void qc.invalidateQueries({ queryKey: QUERY_KEYS.watchlist() });
        const skippedLine =
            result.skipped > 0
                ? t('toast.mergedSkipped', {
                      v0: WATCHLIST_MAX_MEMBER,
                      v1: result.skipped,
                  })
                : null;
        if (result.added > 0) {
            showToast({
                message: t('toast.merged', { v0: result.added }),
                ...(skippedLine ? { detail: skippedLine } : {}),
                link: { href: '/portfolio', label: t('toast.viewMine') },
            });
            trackFunnelEvent('watchlist_merged', { count: result.added });
        } else if (skippedLine) {
            showToast({ message: skippedLine });
        }
    });

    useEffect(() => {
        const previousUserId = previousUserIdRef.current;
        previousUserIdRef.current = userId;
        if (userId === null) {
            attemptedUserIdRef.current = null;
            if (previousUserId !== null) clearWatchlistMergedThisSession();
            return;
        }
        if (localCount === 0) return;
        void runMerge(userId);
    }, [userId, localCount]);
}
