'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    hasNudgeShownThisSession,
    markNudgeShownThisSession,
} from '@/shared/lib/nudgeSession';
import { subscribeSymbolAnalyzed } from '@/shared/lib/symbolAnalyzedSignal';
import {
    hasSeenWatchlistCoachMark,
    markWatchlistCoachMarkSeen,
} from '../lib/coachMarkStorage';

interface UseWatchlistCoachMarkOptions {
    /** 하이드레이션 후 관심종목이 0개이고 호출부가 코치 마크를 원할 때만 true. */
    enabled: boolean;
}

export interface UseWatchlistCoachMarkResult {
    visible: boolean;
    /** 닫기 또는 첫 토글. 영구 플래그를 적어 다시 뜨지 않게 한다. */
    dismiss: () => void;
}

/**
 * 종목 헤더 ☆ 아래 1회 말풍선(§6.1). 차트 탭이 분석을 그린 뒤(`publishSymbolAnalyzed`) 뜨고,
 * 넛지 모달과 같은 탭 세션에 겹치지 않도록 `nudgeSession` 플래그를 **공유**한다 — 모달이
 * 먼저 떴으면 코치 마크는 다음 세션이고, 코치 마크가 먼저 떴으면 모달이 다음 세션이다.
 * 구독 콜백 안의 `setState`는 EF-1이 허용하는 경로다.
 */
export function useWatchlistCoachMark({
    enabled,
}: UseWatchlistCoachMarkOptions): UseWatchlistCoachMarkResult {
    const [visible, setVisible] = useState(false);

    const dismiss = useCallback((): void => {
        markWatchlistCoachMarkSeen();
        setVisible(false);
    }, []);

    useEffect(() => {
        if (!enabled) return;
        return subscribeSymbolAnalyzed(() => {
            if (hasSeenWatchlistCoachMark() || hasNudgeShownThisSession())
                return;
            markNudgeShownThisSession();
            setVisible(true);
        });
    }, [enabled]);

    return { visible: enabled && visible, dismiss };
}
