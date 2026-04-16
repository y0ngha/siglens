/**
 * Google AdSense 설정 및 상수
 */

export const ADSENSE_PUBLISHER_ID =
    process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID ?? '';
export const ADSENSE_ENABLED =
    process.env.NEXT_PUBLIC_ADSENSE_ENABLED === 'true';

export const ADSENSE_SLOTS = {
    PROGRESS: process.env.NEXT_PUBLIC_ADSENSE_SLOT_PROGRESS ?? '',
    PANEL_BOTTOM: process.env.NEXT_PUBLIC_ADSENSE_SLOT_PANEL_BOTTOM ?? '',
} as const;
