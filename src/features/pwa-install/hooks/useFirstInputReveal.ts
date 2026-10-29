'use client';

import { useEffect, useState } from 'react';
import { hadFirstInputBeforeHydration } from '../lib/firstInputProbe';
import {
    POINTERUP_REVEAL_DELAY_MS,
    subscribeBannerTriggers,
} from '../lib/bannerTriggers';

/**
 * 첫 사용자 입력이 끝났는지 — 설치 배너를 띄울 시점 — 를 돌려준다(`usePwaInstall` 전용).
 *
 * `enabled`가 false인 동안은 듣지 않는다. 방아쇠는 합쳐서 **한 번만** 발화한다: 값이
 * true가 되면 리스너와 대기 타이머를 모두 걷고 다시 false로 돌아가지 않는다. 그래서
 * 배너를 닫은 뒤 다른 방아쇠가 배너를 다시 띄우지 않는다.
 */
export function useFirstInputReveal(enabled: boolean): boolean {
    const [revealed, setRevealed] = useState(false);
    /** `click` 없는 `pointerup`이 왔다 — 지연 후 띄울 차례. */
    const [revealPending, setRevealPending] = useState(false);

    useEffect(() => {
        if (revealed || !enabled) return;

        // 하이드레이션 전에 이미 첫 입력이 있었다(`firstInputProbe`) — 그 입력은 아래 리스너가
        // 붙기 전에 지나갔으므로 기다리지 않고 띄운다. 이미 끝난 탭이라 가로챌 것이 없다.
        if (hadFirstInputBeforeHydration()) {
            const timer = setTimeout(() => setRevealed(true), 0);
            return () => clearTimeout(timer);
        }

        return subscribeBannerTriggers({
            onTrigger: () => setRevealed(true),
            onPointerUp: () => setRevealPending(true),
        });
    }, [enabled, revealed]);

    // `click` 없이 `pointerup`만 온 탭: 잠시 뒤에 띄운다. 그 사이 `click`이 와서 `revealed`가
    // 서면 타이머는 정리된다.
    useEffect(() => {
        if (!revealPending || revealed) return;
        const timer = setTimeout(
            () => setRevealed(true),
            POINTERUP_REVEAL_DELAY_MS
        );
        return () => clearTimeout(timer);
    }, [revealPending, revealed]);

    return revealed;
}
