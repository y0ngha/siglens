'use client';

import { startTransition, useEffect, useState } from 'react';
import { MS_PER_SECOND } from '@/shared/config/time';

/**
 * 상호작용이 전혀 없을 때의 노출 시점. **Lighthouse 측정 창(로드 후 수 초) 밖**에 둔다.
 *
 * 예전 8초 폴백은 측정 창 안이라, 아무 입력도 없는 실험실 측정에서 전체 화면 모달이
 * 뜨며 LCP 후보를 바꾸고 레이아웃 작업을 얹었다. 실제 사람은 거의 항상 30초 안에
 * 스크롤·포인터·키 입력 중 하나를 하므로, 이 폴백은 "아무것도 안 하고 화면만 보는"
 * 방문자에게 긴급 공지가 영영 안 보이는 일을 막는 안전망일 뿐이다.
 */
export const NOTICE_IDLE_FALLBACK_MS = 30 * MS_PER_SECOND;

/**
 * 첫 상호작용을 뜻하는 이벤트들. 스크롤·포인터·키보드·터치·휠 중 무엇이든 "읽기
 * 시작했다"는 신호로 충분하다. `pointermove`·`wheel`·`touchstart`는 데스크톱에서
 * 마우스를 움직이기만 한 사람, 트랙패드로 스크롤을 시작한 사람(`scroll`보다 먼저 온다)
 * 까지 잡는다.
 */
const INTERACTION_EVENTS = [
    'pointerdown',
    'keydown',
    'scroll',
    'pointermove',
    'touchstart',
    'wheel',
] as const;

/**
 * 폴백 타이머가 끝난 뒤 브라우저가 한가할 때 노출한다. `requestIdleCallback`이 없는
 * 브라우저(Safari)는 타이머 만료 즉시 노출한다 — 이미 30초가 지났으므로 더 미룰
 * 이유가 없다.
 */
function scheduleIdle(callback: () => void): () => void {
    if (
        typeof window.requestIdleCallback === 'function' &&
        typeof window.cancelIdleCallback === 'function'
    ) {
        // 예약 시점의 취소 함수를 잡아 둔다 — 정리는 언마운트 때 돌아 그 사이 전역이
        // 바뀌어도(테스트 스텁 복원 등) 짝이 맞는 취소를 부른다.
        const cancel = window.cancelIdleCallback.bind(window);
        const id = window.requestIdleCallback(callback);
        return () => cancel(id);
    }
    callback();
    return () => {};
}

/**
 * 마운트 직후가 아니라 **첫 상호작용 또는 `NOTICE_IDLE_FALLBACK_MS` 경과 후의 유휴
 * 시점**에 `true`가 된다.
 *
 * WHY: 공지 팝업이 마운트 즉시 전체 화면을 덮으면, 검색 결과로 들어온 첫 화면이
 * 콘텐츠 대신 모달이다 — 구글의 모바일 인터스티셜 판정이 정확히 그 모양이다
 * (2026-09 구글 정책 감사 L21). 사용자가 페이지를 한 번이라도 만진 뒤에 띄우면
 * "콘텐츠를 가린 채 맞이하는" 상태가 아니게 된다.
 *
 * 노출은 `startTransition`으로 한다 — 첫 입력(스크롤 등)에 반응하는 긴급 렌더를 팝업
 * 청크 로드·마운트가 막지 않게 하기 위해서다(INP).
 *
 * 이벤트는 `once`라 첫 한 번만 반응하고, 타이머·유휴 콜백·리스너는 어느 쪽이 먼저
 * 도달하든 언마운트 시 함께 정리된다.
 */
export function useDeferredReveal(
    fallbackMs: number = NOTICE_IDLE_FALLBACK_MS
): boolean {
    const [revealed, setRevealed] = useState(false);

    useEffect(() => {
        let cancelIdle: () => void = () => {};
        const reveal = (): void => {
            startTransition(() => setRevealed(true));
        };
        const timer = setTimeout(() => {
            cancelIdle = scheduleIdle(reveal);
        }, fallbackMs);
        for (const event of INTERACTION_EVENTS) {
            window.addEventListener(event, reveal, {
                once: true,
                passive: true,
            });
        }
        return () => {
            clearTimeout(timer);
            cancelIdle();
            for (const event of INTERACTION_EVENTS) {
                window.removeEventListener(event, reveal);
            }
        };
    }, [fallbackMs]);

    return revealed;
}
