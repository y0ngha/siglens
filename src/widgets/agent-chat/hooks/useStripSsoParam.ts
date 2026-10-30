'use client';

/**
 * 주소창에서 `?sso=none`만 지우는 마운트 훅.
 */
import { useEffect } from 'react';
import { withoutSsoParam } from '../utils/withoutSsoParam';

/**
 * `?sso=none`은 서버의 "핸드오프는 이미 돌았다" 신호(`proxy.ts`가 쿠키로도 기억한다)일 뿐
 * 방문자에게는 의미가 없다. 남겨 두면 새로고침·공유·북마크에 실려 나간다. `sso`만 지운다 —
 * `q`와 광고 클릭 id는 살아야 한다.
 */
export function useStripSsoParam(): void {
    useEffect(() => {
        const cleaned = withoutSsoParam(window.location.href);
        if (cleaned !== null) {
            window.history.replaceState(window.history.state, '', cleaned);
        }
    }, []);
}
