/**
 * Google AdSense 빌드 상수. `NEXT_PUBLIC_*`은 빌드 때 클라이언트 번들에 인라인되므로
 * `process.env.NEXT_PUBLIC_X`를 리터럴로 읽어야 한다(동적 키로 읽으면 인라인되지 않는다).
 *
 * 자리별 슬롯 ID가 비어 있으면 그 자리는 렌더하지 않는다(`isAdPlacementConfigured`). 광고 단위는
 * AdSense 콘솔에서 만들고, 그 ID를 `deploy.yml` build-arg로 넘긴다.
 */

export const ADSENSE_PUBLISHER_ID =
    process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID ?? '';
export const ADSENSE_ENABLED =
    process.env.NEXT_PUBLIC_ADSENSE_ENABLED === 'true';

export const ADSENSE_SLOTS = {
    SYMBOL_BOTTOM: process.env.NEXT_PUBLIC_ADSENSE_SLOT_SYMBOL_BOTTOM ?? '',
    FEAR_GREED: process.env.NEXT_PUBLIC_ADSENSE_SLOT_FEAR_GREED ?? '',
    NEWS: process.env.NEXT_PUBLIC_ADSENSE_SLOT_NEWS ?? '',
    GUIDE: process.env.NEXT_PUBLIC_ADSENSE_SLOT_GUIDE ?? '',
} as const;

/**
 * 광고 스크립트 주소. `client` 파라미터는 Google이 현재 발급하는 코드 형식이고, 개인정보 보호 및
 * 메시지(유럽 동의 화면)가 이 값으로 계정을 찾는다.
 */
export const ADSENSE_SCRIPT_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER_ID}`;
