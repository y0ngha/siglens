'use client';

import { useEffect } from 'react';
import {
    ADSENSE_PUBLISHER_ID,
    ADSENSE_SLOTS,
    shouldShowAd,
} from '@/lib/adsense';

// window.adsbygoogle: Google AdSense가 로드 후 채우는 전역 배열.
// 각 <ins> 엘리먼트를 큐에 등록하면 AdSense가 광고를 삽입한다.
declare global {
    interface Window {
        adsbygoogle?: object[];
    }
}

export type AdBannerSlot = 'analysis-progress' | 'analysis-panel-bottom';

const SLOT_MAPPING: Record<AdBannerSlot, string> = {
    'analysis-progress': ADSENSE_SLOTS.PROGRESS,
    'analysis-panel-bottom': ADSENSE_SLOTS.PANEL_BOTTOM,
};

interface AdBannerProps {
    /** false이면 컴포넌트가 렌더링되지 않는다. Pro 사용자에게는 false를 전달한다. */
    isFreeUser: boolean;
    /** 광고 배치 위치. AdSense 슬롯 ID 매핑에 사용된다. */
    slot: AdBannerSlot;
}

export function AdBanner({ isFreeUser, slot }: AdBannerProps) {
    const showAd = shouldShowAd(isFreeUser);

    useEffect(() => {
        if (!showAd) return;

        // 레이아웃이 확정된 후 광고를 요청하기 위해 requestAnimationFrame 사용
        const timeoutId = setTimeout(() => {
            try {
                (window.adsbygoogle = window.adsbygoogle ?? []).push({});
            } catch (e) {
                console.error('AdSense push error:', e);
            }
        }, 100);

        return () => clearTimeout(timeoutId);
    }, [showAd]);

    if (!showAd) return null;

    const isProgress = slot === 'analysis-progress';
    const supportMessage = isProgress
        ? 'AI가 정밀 분석 중입니다… 광고 수익은 더 나은 AI 모델 도입과 서버 유지비로 소중하게 사용됩니다.'
        : '분석 결과가 도움이 되셨나요? 하단 제휴 링크를 통한 활동은 Siglens 서비스를 지속하는 데 큰 힘이 됩니다.';

    return (
        <div className="flex w-full flex-col items-center gap-2 overflow-hidden rounded-md py-4">
            <ins
                className="adsbygoogle block w-full min-w-[250px]"
                data-ad-client={ADSENSE_PUBLISHER_ID}
                data-ad-slot={SLOT_MAPPING[slot]}
                data-ad-format="auto"
                data-full-width-responsive="true"
            />
            <p className="text-secondary-400 whitespace-nowrap text-center text-xs leading-relaxed">
                {supportMessage}
            </p>
        </div>
    );
}
