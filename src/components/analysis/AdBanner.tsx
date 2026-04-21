'use client';

import { useRef } from 'react';
import {
    ADSENSE_ENABLED,
    ADSENSE_PUBLISHER_ID,
    ADSENSE_SLOTS,
} from '@/lib/adsense';
import { useAdSensePush } from './hooks/useAdSensePush';

export type AdBannerSlot = 'analysis-progress' | 'analysis-panel-bottom';

const SLOT_MAPPING: Record<AdBannerSlot, string> = {
    'analysis-progress': ADSENSE_SLOTS.PROGRESS,
    'analysis-panel-bottom': ADSENSE_SLOTS.PANEL_BOTTOM,
};

const SUPPORT_MESSAGE: Record<AdBannerSlot, string> = {
    'analysis-progress':
        'AI가 정밀 분석 중입니다… 광고 수익은 더 나은 AI 모델 도입과 서버 유지비로 소중하게 사용됩니다.',
    'analysis-panel-bottom':
        '분석 결과가 도움이 되셨나요? 하단 제휴 링크를 통한 활동은 Siglens 서비스를 지속하는 데 큰 힘이 됩니다.',
};

interface AdBannerProps {
    /** false이면 컴포넌트가 렌더링되지 않는다. Pro 사용자에게는 false를 전달한다. */
    isFreeUser: boolean;
    /** 광고 배치 위치. AdSense 슬롯 ID 매핑에 사용된다. */
    slot: AdBannerSlot;
}

export function AdBanner({ isFreeUser, slot }: AdBannerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const slotId = SLOT_MAPPING[slot];
    const showAd =
        isFreeUser &&
        ADSENSE_ENABLED &&
        ADSENSE_PUBLISHER_ID.length > 0 &&
        !!slotId;

    useAdSensePush(containerRef, showAd);

    if (!showAd) return null;

    return (
        <div
            ref={containerRef}
            className="flex w-full flex-col items-center gap-2 overflow-hidden rounded-md py-4"
        >
            <ins
                className="adsbygoogle block w-full min-w-60"
                data-ad-client={ADSENSE_PUBLISHER_ID}
                data-ad-slot={slotId}
                data-ad-format="auto"
                data-full-width-responsive="true"
            />
            <p className="text-secondary-400 text-center text-xs leading-relaxed">
                {SUPPORT_MESSAGE[slot]}
            </p>
        </div>
    );
}
