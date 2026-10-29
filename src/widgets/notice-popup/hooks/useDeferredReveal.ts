'use client';

/**
 * 공지 팝업을 언제 마운트할지 정하는 지연 노출 훅.
 */
import { startTransition, useEffect, useState } from 'react';
import { MS_PER_SECOND } from '@/shared/config/time';
import {
    listenForFirstInteraction,
    scheduleIdleAfter,
} from '../utils/revealTriggers';

/**
 * 상호작용이 전혀 없을 때의 노출 시점. **Lighthouse 측정 창(로드 후 수 초) 밖**에 둔다.
 *
 * 측정 창 안에서 뜨면, 아무 입력도 없는 실험실 측정에서 전체 화면 모달이 LCP 후보를
 * 바꾸고 레이아웃 작업을 얹는다. 실제 사람은 거의 항상 30초 안에 스크롤·포인터·키 입력
 * 중 하나를 하므로, 이 폴백은 "아무것도 안 하고 화면만 보는" 방문자에게 긴급 공지가
 * 영영 안 보이는 일을 막는 안전망일 뿐이다.
 */
export const NOTICE_IDLE_FALLBACK_MS = 30 * MS_PER_SECOND;

/**
 * 마운트 직후가 아니라 **첫 상호작용 또는 `NOTICE_IDLE_FALLBACK_MS` 경과 후의 유휴
 * 시점**에 `true`가 된다.
 *
 * WHY: 공지 팝업이 마운트 즉시 전체 화면을 덮으면, 검색 결과로 들어온 첫 화면이
 * 콘텐츠 대신 모달이다 — 구글의 모바일 인터스티셜 판정이 정확히 그 모양이다.
 * 사용자가 페이지를 한 번이라도 만진 뒤에 띄우면 "콘텐츠를 가린 채 맞이하는" 상태가
 * 아니게 된다.
 *
 * 노출은 `startTransition`으로 한다 — 첫 입력(스크롤 등)에 반응하는 긴급 렌더를 팝업
 * 청크 로드·마운트가 막지 않게 하기 위해서다(INP).
 *
 * 타이머·유휴 콜백·리스너는 어느 쪽이 먼저 도달하든 언마운트 시 함께 정리된다.
 */
export function useDeferredReveal(
    fallbackMs: number = NOTICE_IDLE_FALLBACK_MS
): boolean {
    const [revealed, setRevealed] = useState(false);

    useEffect(() => {
        const reveal = (): void => {
            startTransition(() => setRevealed(true));
        };
        const cancelFallback = scheduleIdleAfter(fallbackMs, reveal);
        const stopListening = listenForFirstInteraction(reveal);
        return () => {
            cancelFallback();
            stopListening();
        };
    }, [fallbackMs]);

    return revealed;
}
