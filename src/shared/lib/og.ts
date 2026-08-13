// 동적 OG image 라우트(`opengraph-image.tsx`)와 정적 og-image 메타 양쪽에서 공유하는 OG 상수.
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

export const OG_BG = '#0f172a';
export const OG_FG = '#ffffff';
export const OG_ACCENT = '#3b82f6';
export const OG_MUTED = '#94a3b8';

export const OG_CONTAINER_PADDING = '80px';
export const OG_TICKER_FONT_SIZE = 240;
export const OG_LABEL_FONT_SIZE = 64;
export const OG_SITE_NAME_FONT_SIZE = 32;
export const OG_SITE_NAME_TOP = 56;
export const OG_SITE_NAME_RIGHT = 72;
export const OG_LABEL_MARGIN_TOP = 32;
/** Subtitle line below the main label in news OG images (hub and category). */
export const OG_SUBTITLE_FONT_SIZE = 40;

/**
 * OG/트위터 이미지 응답의 `Cache-Control`.
 *
 * `next/og`의 `ImageResponse`는 `public, max-age=0, must-revalidate`를 **하드코딩된
 * 기본값**으로 붙인다(`next/dist/server/og/image-response.js`). 라우트의
 * `export const revalidate`는 Next의 ISR 재생성 주기일 뿐 이 응답 헤더에 반영되지 않아,
 * CDN 입장에서는 "매번 재검증하라"는 지시가 되어 **엣지 캐시가 전혀 되지 않았다**
 * (2026-08-13 실측: `/[symbol]/opengraph-image`·`twitter-image` 221요청 히트율 0%).
 *
 * 같은 파일에서 `options.headers`가 기본값을 덮어쓰므로 여기서 명시한다.
 * - `max-age=0`: 브라우저는 종전대로 매번 재검증 — 사용자에게 낡은 이미지가 남지 않는다.
 * - `s-maxage`: CDN만 장기 보관. 이미지가 `(ticker, label)` 순수 함수라 신선도 개념이 없다.
 * - 7일로 두는 이유: 배포로는 이 URL의 엣지 캐시가 무효화되지 않는다(경로가 그대로다).
 *   템플릿을 바꾸면 최대 7일간 옛 이미지가 남으므로, 즉시 반영이 필요하면 CF Purge를 쓴다.
 *   라우트의 `revalidate = 2592000`(30d)은 Next 쪽 재생성 주기라 별개다.
 */
export const OG_IMAGE_CACHE_CONTROL =
    'public, max-age=0, s-maxage=604800, stale-while-revalidate=86400';
