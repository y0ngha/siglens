'use client';

import Script from 'next/script';
import { useEffect, useSyncExternalStore } from 'react';
import { useAppPathname } from '@/shared/i18n/useAppPathname';
import {
    consumeSignupConversionFlag,
    hasQueuedAdsConversion,
    initAdsCommandQueue,
    subscribeAdsConversionQueued,
    trackAdsConversion,
    wasOpenedFromAdClick,
} from '@/shared/lib/googleAds';

/** 클릭 식별자는 문서가 열릴 때 정해지고 바뀌지 않는다 — 구독할 변화가 없다. */
const noSubscription = () => () => {};

interface GoogleAdsTagProps {
    id: string;
    /**
     * 처음부터 바로 불러온다. 광고 랜딩(`src/app/lp`)이 쓴다 — 방문자 전원이 광고 클릭으로
     * 들어오고 CTA가 다른 문서로 가는 링크라, 늦게 불러오면 클릭 식별자를 놓친다.
     */
    eager?: boolean;
}

/**
 * Google Ads 태그(gtag.js)와 가입 전환 기록.
 *
 * 레이아웃(서버 컴포넌트)이 `GOOGLE_ADS_ID`가 있을 때만 렌더한다 — 운영 빌드·E2E
 * 여부는 서버에서만 정확히 안다(`shared/config/googleAds.ts`).
 *
 * `allow_ad_personalization_signals: false`로 리마케팅을 끈다. 개인정보처리방침 v5가
 * "맞춤형 광고에 이용하지 않음"을 약속하므로 이 옵션을 지우면 방침이 거짓이 된다.
 *
 * **언제 불러오나.** gtag.js(~150KB)는 예전에 하이드레이션 직후 높은 우선순위로 받아,
 * 느린 모바일 회선에서 폰트·앱 JS와 대역을 다퉜다(2026-10-04 Lighthouse). 지금은
 *   - 광고 클릭으로 들어온 문서(URL에 클릭 식별자), 가입 직후, 광고 랜딩 → 바로
 *   - 그 밖 → 페이지가 다 뜬 뒤 한가할 때(`lazyOnload`)
 *   - 대기 중에 전환이 큐에 들어오면 → 그 순간 바로(`ADS_CONVERSION_QUEUED_EVENT`)
 * 초기 명령(`config`)은 불러오는 시점과 무관하게 마운트 즉시 큐에 넣는다 — 전환이
 * 설정보다 앞서지 않게 하기 위해서다(`initAdsCommandQueue`).
 *
 * 가입 플래그를 경로가 바뀔 때마다 확인하는 이유: 가입 서버 액션의 redirect는
 * 클라이언트 내비게이션이라 이 컴포넌트가 다시 마운트되지 않는다.
 */
export function GoogleAdsTag({ id, eager = false }: GoogleAdsTagProps) {
    const pathname = useAppPathname();
    // 둘 다 서버 렌더에는 알 수 없으므로 하이드레이션 뒤에 읽는다(서버 스냅샷 false).
    const fromAdClick = useSyncExternalStore(
        noSubscription,
        wasOpenedFromAdClick,
        () => false
    );
    const conversionQueued = useSyncExternalStore(
        subscribeAdsConversionQueued,
        hasQueuedAdsConversion,
        () => false
    );
    const urgent = eager || fromAdClick || conversionQueued;

    useEffect(() => {
        initAdsCommandQueue(id);
    }, [id]);

    useEffect(() => {
        if (consumeSignupConversionFlag()) trackAdsConversion('signUp');
    }, [pathname]);

    return (
        <Script
            // 대기에서 즉시로 바뀌면 다시 마운트해 바로 불러온다. 같은 src는 next/script가
            // 한 번만 넣으므로 나중에 대기 쪽이 실행돼도 두 번 받지 않는다.
            key={urgent ? 'now' : 'idle'}
            src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
            strategy={urgent ? 'afterInteractive' : 'lazyOnload'}
        />
    );
}
