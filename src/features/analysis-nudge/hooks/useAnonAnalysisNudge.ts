'use client';

import { useCallback } from 'react';
import { useCurrentUser } from '@/entities/auth';
import {
    recordAnonSymbolAnalysis,
    hasNudgeShownToday,
    markNudgeShownToday,
} from '@/shared/lib/anonAnalysisCount';

export interface UseAnonAnalysisNudgeResult {
    /**
     * True once `useCurrentUser` has settled (data !== undefined) — i.e. we
     * definitively know whether the visitor is a member or anonymous.
     * Callers that gate a "consume once" ref (e.g. ChartContent's
     * notifiedSymbolRef) on `onSymbolAnalyzed` MUST also gate on this flag
     * and include it in their effect's dependency array. Otherwise a call
     * that lands before login resolves gets silently absorbed by the
     * no-op branch below, the ref is marked "done" anyway, and the
     * effective (anonymous) call that would fire once resolution flips
     * true never happens — dropping that symbol from the distinct-symbol
     * count (see member-reasoning-toggle spec Part B).
     */
    isLoginResolved: boolean;
    /**
     * Call when a symbol analysis completes/renders. No-op for members and
     * while the login state is still resolving (§ do not count before
     * membership is known — a member's first paint must never be
     * miscounted as anonymous activity, and an anonymous visitor's first
     * paint must not be dropped either way, so the safest boundary is to
     * wait for the definitive answer before counting at all).
     */
    onSymbolAnalyzed: (symbol: string) => void;
}

/**
 * Anonymous 3-distinct-symbol signup nudge (member-reasoning-toggle spec Part
 * B). Tracks distinct symbols an anonymous visitor has analyzed today via
 * `recordAnonSymbolAnalysis`, and opens a soft nudge modal the first time the
 * count crosses the threshold — once per day (`hasNudgeShownToday`/
 * `markNudgeShownToday`). Members are always a no-op: the counter and modal
 * exist purely to solicit signup, so a logged-in user has nothing to gain
 * from either.
 *
 * The modal's open-state and the single modal instance are NOT owned here.
 * They live in `SymbolModelProvider` so the auto-nudge (this hook) and the
 * locked-toggle nudge (`SymbolLayoutHeader`) share ONE modal instance — two
 * co-mounted `fixed inset-0 z-50` modals would fight over focus-trap/Escape.
 * The caller passes `openNudge` (the provider's shared opener); crossing the
 * threshold invokes it instead of a local `setState`.
 *
 * @param openNudge Shared opener from `useSymbolModel().openSignupNudge`. Must
 *   be a stable reference (the provider memoizes it with `useCallback`) so
 *   `onSymbolAnalyzed`'s identity only changes with login resolution — callers
 *   dedup on that identity.
 */
export function useAnonAnalysisNudge(
    openNudge: () => void
): UseAnonAnalysisNudgeResult {
    const currentUserQuery = useCurrentUser();
    // undefined until the query settles — before that we don't know whether
    // the visitor is a member, so we must not count (see onSymbolAnalyzed doc).
    const isLoginResolved = currentUserQuery.data !== undefined;
    const isAnonymous = isLoginResolved && currentUserQuery.data === null;

    const onSymbolAnalyzed = useCallback(
        (symbol: string): void => {
            if (!isAnonymous) return;

            const { crossedThreshold } = recordAnonSymbolAnalysis(symbol);
            if (!crossedThreshold) return;
            if (hasNudgeShownToday()) return;

            markNudgeShownToday();
            openNudge();
        },
        [isAnonymous, openNudge]
    );

    return { isLoginResolved, onSymbolAnalyzed };
}
