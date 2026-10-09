'use client';

import { useEffect } from 'react';
import type { ContextOf } from '@/shared/lib/funnel/funnelEvents';
import { trackFunnelEvent } from '@/shared/lib/funnel/trackFunnelEvent';

/**
 * 넛지 모달이 **열릴 때** `nudge_shown`을 한 번 보낸다.
 *
 * 이 레포의 넛지 모달은 열릴 때 마운트되고 닫히면 언마운트되므로(조건부 렌더 +
 * `ModalShell`) 마운트 effect가 곧 "열렸다"다. 같은 종류로 다시 열라는 요청은
 * 리렌더만 일으켜 다시 보내지 않고, 열린 채 종류·문구가 바뀌면 다른 넛지를 본
 * 것이므로 다시 보낸다. `lastGate` 기록은 `trackFunnelEvent`가 맡는다.
 *
 * 개발 StrictMode의 이중 effect는 두 번 보내지만, 라우트가 프로덕션 외에서는 204만
 * 돌려주므로 기록되지 않는다.
 */
export function useFunnelNudgeShown({
    kind,
    variant,
}: ContextOf<'nudge_shown'>): void {
    useEffect(() => {
        trackFunnelEvent(
            'nudge_shown',
            variant === undefined ? { kind } : { kind, variant }
        );
    }, [kind, variant]);
}
