'use client';

import { useEffect, useState } from 'react';
import { MS_PER_SECOND } from '@/shared/config/time';

/** 상호작용이 없어도 이 시간이 지나면 노출한다. */
export const NOTICE_REVEAL_DELAY_MS = 8 * MS_PER_SECOND;

/**
 * 첫 상호작용을 뜻하는 이벤트들. 스크롤·포인터·키보드 중 무엇이든 "읽기 시작했다"는
 * 신호로 충분하다.
 */
const INTERACTION_EVENTS = ['pointerdown', 'keydown', 'scroll'] as const;

/**
 * 마운트 직후가 아니라 **첫 상호작용 또는 `delayMs` 경과 후**에 `true`가 된다.
 *
 * WHY: 공지 팝업이 마운트 즉시 전체 화면을 덮으면, 검색 결과로 들어온 첫 화면이
 * 콘텐츠 대신 모달이다 — 구글의 모바일 인터스티셜 판정이 정확히 그 모양이다
 * (2026-09 구글 정책 감사 L21). 사용자가 페이지를 한 번이라도 만진 뒤에 띄우면
 * "콘텐츠를 가린 채 맞이하는" 상태가 아니게 된다. 아무 조작이 없어도 8초 뒤에는
 * 띄운다 — 긴급 공지가 영영 안 보이는 경우를 만들지 않기 위해서다.
 *
 * 이벤트는 `once`라 첫 한 번만 반응하고, 타이머와 리스너는 어느 쪽이 먼저
 * 도달하든 언마운트 시 함께 정리된다.
 */
export function useDeferredReveal(
    delayMs: number = NOTICE_REVEAL_DELAY_MS
): boolean {
    const [revealed, setRevealed] = useState(false);

    useEffect(() => {
        const reveal = () => setRevealed(true);
        const timer = setTimeout(reveal, delayMs);
        for (const event of INTERACTION_EVENTS) {
            window.addEventListener(event, reveal, {
                once: true,
                passive: true,
            });
        }
        return () => {
            clearTimeout(timer);
            for (const event of INTERACTION_EVENTS) {
                window.removeEventListener(event, reveal);
            }
        };
    }, [delayMs]);

    return revealed;
}
