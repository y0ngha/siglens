'use client';

import { useTranslations } from 'next-intl';
import { useRef } from 'react';
import {
    ADSENSE_ENABLED,
    ADSENSE_PUBLISHER_ID,
    ADSENSE_SLOTS,
} from '@/shared/lib/adsense';
import { useAdSensePush } from './hooks/useAdSensePush';

type AdBannerSlot = 'analysis-progress' | 'analysis-panel-bottom';

const SLOT_MAPPING: Record<AdBannerSlot, string> = {
    'analysis-progress': ADSENSE_SLOTS.PROGRESS,
    'analysis-panel-bottom': ADSENSE_SLOTS.PANEL_BOTTOM,
};

/** `widgets.analysis.adBanner` 메시지 키 — 표시는 렌더 쪽에서 `t()`로. */
const SUPPORT_MESSAGE_KEY: Record<AdBannerSlot, string> = {
    'analysis-progress': 'analyzing',
    'analysis-panel-bottom': 'done',
};

interface AdBannerProps {
    /** false이면 컴포넌트가 렌더링되지 않는다. Pro 사용자에게는 false를 전달한다. */
    isFreeUser: boolean;
    /** 광고 배치 위치. AdSense 슬롯 ID 매핑에 사용된다. */
    slot: AdBannerSlot;
}

export function AdBanner({ isFreeUser, slot }: AdBannerProps) {
    const tAd = useTranslations('widgets.analysis.adBanner');
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
            className="flex w-full flex-col items-center gap-2 overflow-hidden rounded-lg py-4"
        >
            <ins
                className="adsbygoogle block w-full min-w-60"
                data-ad-client={ADSENSE_PUBLISHER_ID}
                data-ad-slot={slotId}
                data-ad-format="auto"
                data-full-width-responsive="true"
            />
            <p className="text-center text-xs leading-relaxed text-secondary-400">
                {tAd(SUPPORT_MESSAGE_KEY[slot])}
            </p>
        </div>
    );
}
