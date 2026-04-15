'use client';

import { useEffect } from 'react';

// window.adsbygoogle: Google AdSense가 로드 후 채우는 전역 배열.
// 각 <ins> 엘리먼트를 큐에 등록하면 AdSense가 광고를 삽입한다.
declare global {
    interface Window {
        adsbygoogle?: object[];
    }
}

// NEXT_PUBLIC_ 변수는 빌드 타임에 인라인된다.
// 미설정 시 빈 문자열 → 광고 미노출 (graceful degradation).
const ADSENSE_PUBLISHER_ID = process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID ?? '';

export type AdBannerSlot = 'analysis-progress' | 'analysis-panel-bottom';

export const AD_SLOT_ID: Record<AdBannerSlot, string> = {
    'analysis-progress': process.env.NEXT_PUBLIC_ADSENSE_SLOT_PROGRESS ?? '',
    'analysis-panel-bottom':
        process.env.NEXT_PUBLIC_ADSENSE_SLOT_PANEL_BOTTOM ?? '',
};

/**
 * 광고 표시 여부를 결정한다.
 * isFreeUser가 true이고 publisherId가 설정된 경우에만 광고를 표시한다.
 */
export function shouldShowAdBanner(
    isFreeUser: boolean,
    publisherId: string
): boolean {
    return isFreeUser && publisherId.length > 0;
}

interface AdBannerProps {
    /** false이면 컴포넌트가 렌더링되지 않는다. Pro 사용자에게는 false를 전달한다. */
    isFreeUser: boolean;
    /** 광고 배치 위치. AdSense 슬롯 ID 매핑에 사용된다. */
    slot: AdBannerSlot;
}

export function AdBanner({ isFreeUser, slot }: AdBannerProps) {
    // 훅은 조건부 반환 이전에 호출해야 한다 (Rules of Hooks).
    useEffect(() => {
        if (!shouldShowAdBanner(isFreeUser, ADSENSE_PUBLISHER_ID)) return;
        (window.adsbygoogle = window.adsbygoogle ?? []).push({});
    }, [isFreeUser]);

    // Pro 사용자이거나 환경 변수 미설정 시 아무것도 렌더링하지 않는다.
    if (!shouldShowAdBanner(isFreeUser, ADSENSE_PUBLISHER_ID)) return null;

    return (
        <div className="overflow-hidden rounded-md">
            {/* adsbygoogle 클래스와 block은 AdSense가 요구하는 display:block을 Tailwind로 충족한다. */}
            <ins
                className="adsbygoogle block"
                data-ad-client={ADSENSE_PUBLISHER_ID}
                data-ad-slot={AD_SLOT_ID[slot]}
                data-ad-format="auto"
                data-full-width-responsive="true"
            />
        </div>
    );
}
