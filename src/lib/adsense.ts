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

/**
 * 광고 표시 여부를 결정하는 공통 로직
 */
export function shouldShowAd(isFreeUser: boolean): boolean {
    return isFreeUser && ADSENSE_ENABLED && ADSENSE_PUBLISHER_ID.length > 0;
}
