'use client';

import { useEffect } from 'react';
import { kstDateKey } from '@/shared/lib/etTimeUtils';

/** 마지막으로 비콘을 보낸 KST 날짜를 담는다. */
const STORAGE_KEY = 'siglens:visit';

/**
 * 하루 한 번, 방문 사실만 알린다. **본문은 보내지 않는다** — IP와 User-Agent는
 * 이미 요청 헤더에 있다.
 *
 * 서버가 아니라 클라이언트에서 보내는 이유가 두 가지다.
 *  1. 페이지에서 `headers()`를 부르면 그 라우트의 ISR이 꺼진다.
 *  2. JS를 실행하지 않는 크롤러는 이 비콘을 아예 띄우지 않는다 — UA 정규식보다
 *     강한 봇 필터가 공짜로 생긴다.
 *
 * 날짜는 `kstDateKey`로 판정한다. 브라우저 로컬 타임존을 쓰면 서버의 날짜 경계와
 * 어긋나 그 방문자가 특정 날에 통째로 누락된다. 반대 방향(중복 전송)은 서버가
 * `ON CONFLICT DO NOTHING`으로 흡수하므로 무해하다.
 *
 * `@/entities/visitor` barrel은 `server-only`라 여기서 import하지 않는다.
 */
export function VisitorPing(): null {
    useEffect(() => {
        // 사람 수를 세는 것이 목적이다. Playwright·Puppeteer는 사람이 아니다.
        if (navigator.webdriver) return;

        const today = kstDateKey(new Date());

        let last: string | null = null;
        try {
            last = window.localStorage.getItem(STORAGE_KEY);
        } catch {
            // 사파리 프라이빗 모드 등 — 매번 보낸다. 서버가 중복을 흡수한다.
        }
        if (last === today) return;

        void fetch('/api/presence', { method: 'POST', keepalive: true })
            .then(response => {
                // 실패는 기록하지 않는다. pepper 미설정 같은 배포 오류가
                // 다음 로드에서 다시 드러나야 한다.
                if (!response.ok) return;
                try {
                    window.localStorage.setItem(STORAGE_KEY, today);
                } catch {
                    // 위와 같다.
                }
            })
            .catch(() => {
                // 차단기·오프라인. 집계 하나 놓치는 편이 화면을 깨뜨리는 것보다 낫다.
            });
    }, []);

    return null;
}
