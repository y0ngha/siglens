'use client';

import { useCallback, useRef, useState } from 'react';
import { useWatchlist } from '@/features/watchlist/hooks/useWatchlist';
import { trackFunnelEvent } from '@/shared/lib/funnel/trackFunnelEvent';

/** {@link useNudgeWatchlistAdd}의 결과. 종목 넛지 모달의 CTA 상태다. */
export interface NudgeWatchlistAdd {
    /**
     * 실제로 담긴 상태(`has`, 낙관적 갱신·실패 시 롤백)만 따른다. 한도 초과·실패는
     * `useWatchlist`가 토스트로 알리고 이 값은 false로 남아, 담기지 않았는데 담겼다고 보이는 일이 없다.
     */
    added: boolean;
    /** 관심종목 목록이 확정돼 담을 수 있는지(하이드레이션·회원 여부 확정). */
    canAdd: boolean;
    /** 담기 요청이 진행 중인지. */
    isPending: boolean;
    /** 담는다(심볼·담기 가능 여부가 같으면 같은 참조). 담을 수 없거나 진행 중이면 아무것도 하지 않는다 — 연타해도 한 번만 나간다. */
    add: () => Promise<void>;
}

/**
 * 종목 넛지의 "관심종목에 담아 메일로 받기" — 페이지 이동 없이 `useWatchlist().add`를
 * `nudge` 출처로 실행하고 클릭을 퍼널에 남긴다. 라벨은 심볼로 넘긴다: 회원 경로의
 * `addWatchlistItemAction`이 회사명을 채운다.
 */
export function useNudgeWatchlistAdd(symbol: string): NudgeWatchlistAdd {
    const [isPending, setIsPending] = useState(false);
    // 같은 렌더 안의 연타는 `isPending` 갱신 전이라 상태로는 막지 못한다.
    const pendingRef = useRef(false);
    const watchlist = useWatchlist();
    const { add: addToWatchlist } = watchlist;

    // REACT.md#HK-1 예외: 아래 `useCallback`이 이 파생값을 deps로 받는다.
    const canAdd = watchlist.isHydrated && !watchlist.isIdentityPending;
    const add = useCallback(async (): Promise<void> => {
        if (!canAdd || pendingRef.current) return;
        pendingRef.current = true;
        trackFunnelEvent('nudge_clicked', {
            kind: 'member_symbol',
            cta: 'add',
        });
        setIsPending(true);
        // `try … finally`는 React Compiler가 내리지 못해(REACT.md#EF-3) `.catch`로 대신한다 —
        // add는 실패를 결과값('failed')으로 돌려주지만, 혹시 던져도 진행 상태는 반드시 푼다.
        await addToWatchlist({ symbol, label: symbol }, 'nudge').catch(
            () => 'failed' as const
        );
        pendingRef.current = false;
        setIsPending(false);
    }, [canAdd, addToWatchlist, symbol]);

    return { added: watchlist.has(symbol), canAdd, isPending, add };
}
