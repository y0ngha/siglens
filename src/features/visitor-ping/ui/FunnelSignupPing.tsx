'use client';

import { useEffect } from 'react';
import { useAppPathname } from '@/shared/i18n/useAppPathname';
import { clearLastGate, readLastGate } from '@/shared/lib/funnel/lastGate';
import { consumeFunnelSignupCookie } from '@/shared/lib/funnel/signupCookie';
import { trackFunnelEvent } from '@/shared/lib/funnel/trackFunnelEvent';

/**
 * 가입 직후 첫 페이지에서 `signup_completed`를 한 번 보낸다.
 *
 * 가입 액션(`registerAction`·`finalizeOAuthSignupAction`)이 심은 1회용 쿠키
 * (`siglens_funnel_signup=<method>`)를 읽어 지우고, 비회원 시절 마지막으로 누른 게이트
 * (`lastGate`)를 붙인다. Google Ads 플래그 쿠키를 재사용하지 않는 이유: 그 쿠키는
 * `GoogleAdsTag`가 소비하면서 지우므로 두 소비자가 경쟁한다.
 *
 * 경로가 바뀔 때마다 다시 확인하는 이유는 `GoogleAdsTag`와 같다 — 가입 서버 액션의
 * redirect는 클라이언트 내비게이션이라 이 컴포넌트가 다시 마운트되지 않는다.
 */
export function FunnelSignupPing(): null {
    const pathname = useAppPathname();

    useEffect(() => {
        const method = consumeFunnelSignupCookie();
        if (method === null) return;
        const lastGate = readLastGate();
        clearLastGate();
        trackFunnelEvent('signup_completed', { method, lastGate });
    }, [pathname]);

    return null;
}
