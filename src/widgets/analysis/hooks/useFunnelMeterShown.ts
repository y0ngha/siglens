'use client';

import { useEffect, useState } from 'react';
import type { MeterState } from '@/shared/lib/funnel/funnelEvents';
import { claimMeterShown } from '@/shared/lib/funnel/meterShownDedupe';
import { trackFunnelEvent } from '@/shared/lib/funnel/trackFunnelEvent';

/**
 * 하루 무료 공개 미터의 띠(`revealed`)·카드(`exhausted`)가 **화면에 처음 보일 때**
 * `meter_shown`을 보낸다. 돌려받는 ref 콜백을 그 요소에 붙인다.
 *
 * - 노출은 (종목, KST 날짜, 상태)당 한 번이다(`claimMeterShown`) — 새로고침·타임프레임
 *   전환이 같은 노출을 다시 세지 않는다.
 * - `state`가 `null`이면(미터 미적용·응답 전) 아무것도 하지 않는다.
 * - 요소가 바뀌면(띠 → 카드) 관찰을 새로 시작한다. `useInViewOnce`는 한 번 보이면
 *   영구히 보임으로 굳어, 다른 요소로 바뀐 뒤에도 화면 밖에서 발화하므로 쓰지 않는다.
 * - `IntersectionObserver`가 없는 환경은 마운트 즉시 보인 것으로 친다.
 */
export function useFunnelMeterShown(
    state: MeterState | null,
    symbol: string
): (node: Element | null) => void {
    const [node, setNode] = useState<Element | null>(null);

    useEffect(() => {
        if (state === null || node === null) return;
        const report = (): void => {
            if (claimMeterShown(symbol, state)) {
                trackFunnelEvent('meter_shown', { state });
            }
        };
        if (typeof IntersectionObserver === 'undefined') {
            report();
            return;
        }
        const observer = new IntersectionObserver(entries => {
            if (!entries.some(entry => entry.isIntersecting)) return;
            report();
            observer.disconnect();
        });
        observer.observe(node);
        return () => observer.disconnect();
    }, [node, state, symbol]);

    return setNode;
}
