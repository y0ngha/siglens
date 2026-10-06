/**
 * Cloudflare 엣지 캐시를 배포 때 **골라서** 비우기 위한 `Cache-Tag` 응답 헤더 규칙.
 *
 * 예전 배포는 `purge_everything`으로 엣지를 통째로 비웠다. 그러면 콘텐츠 해시가 붙어
 * 절대 바뀌지 않는 `/_next/static/*`, 최적화 이미지, 30일 revalidate인 OG 이미지까지 하루
 * 3~4번씩 엣지에서 쫓겨나 오리진(t4g, 터널 경유 송신 과금)으로 되돌아왔다(2026-10 비용 감사).
 * 이제 응답마다 거친 태그 하나를 달고, 배포는 HTML 태그만 지운다
 * (`scripts/purge-cdn-cache.sh`, `.github/workflows/deploy.yml`). 단 저장소 변수
 * `CF_TAG_PURGE_ENABLED=true`일 때만이다 — 기본은 여전히 통째로 비운다. 이 헤더가 붙기 전에
 * 캐시된 엔트리에는 태그가 없어서다.
 *
 * 태그는 일부러 거칠게 셋만 둔다 — 배포 단위로만 지우므로 그 이상은 쓸 데가 없다.
 *
 *   - `siglens-html`  — 기본값. HTML·RSC 페이로드·라우트 핸들러·sitemap/RSS·`sw.js` 등 빌드
 *                       산출물에 따라 달라지는 모든 것. **배포마다 지운다.** 옛 HTML은 옛
 *                       청크 해시를 가리키므로 남겨 두면 새 빌드와 어긋난다.
 *   - `siglens-og`    — 코드로 그리는 공유 카드: OG/twitter 이미지 메타데이터 라우트와
 *                       `/api/ai/og/*`. 데이터로 그려지고 30일 revalidate라
 *                       배포와 무관하다. 배포 때 지우지 않는다 — 카드 디자인을 바꾼 릴리스라면
 *                       운영자가 이 태그를 손으로 지운다.
 *   - `siglens-asset` — `/_next/static/*`(콘텐츠 해시, immutable), `/_next/image`, 확장자가 있는
 *                       정적 미디어·폰트. 배포 때 지우지 않는다. `public/`의 이미지를 같은 이름으로
 *                       바꿔 끼운 릴리스라면 운영자가 이 태그를 손으로 지운다.
 *
 * 태그 이름에 빌드 ID를 넣지 않는 이유: 그러면 퍼지가 "직전 빌드들의 태그 목록"을 알아야 한다.
 * 롤링 배포·롤백·실패한 배포가 섞이면 그 목록이 쉽게 틀리고, 빠진 태그의 HTML은 TTL까지
 * 옛 청크를 가리킨다. 고정 태그 하나를 매번 지우는 쪽이 같은 효과에 실패 모드가 없다.
 *
 * Cloudflare는 `Cache-Tag` 헤더를 엣지에서 떼고 방문자에게 보내지 않는다. 엣지에 캐시되지 않는
 * 응답(우회 규칙에 걸린 `/api/*` 등)에 붙은 태그는 그냥 무시된다.
 */

export const CACHE_TAG_HEADER = 'Cache-Tag';

export const CDN_CACHE_TAG = {
    html: 'siglens-html',
    og: 'siglens-og',
    asset: 'siglens-asset',
} as const;

export type CdnCacheTag = (typeof CDN_CACHE_TAG)[keyof typeof CDN_CACHE_TAG];

/** 배포가 지우는 태그. `scripts/purge-cdn-cache.sh`의 기본값과 같아야 한다(테스트가 대조). */
export const DEPLOY_PURGE_TAGS: readonly CdnCacheTag[] = [CDN_CACHE_TAG.html];

/**
 * 확장자로 식별하는, 빌드와 무관한 정적 미디어·폰트. `js`·`css`·`json`·`xml`·`txt`·
 * `webmanifest`·`html`은 **넣지 않는다** — `public/sw.js`, `offline.html`, 매니페스트,
 * sitemap처럼 해시 없이 내용이 배포마다 바뀌는 파일이 그 확장자로 나간다.
 */
const STATIC_MEDIA_EXTENSIONS = [
    'png',
    'jpg',
    'jpeg',
    'gif',
    'svg',
    'webp',
    'avif',
    'ico',
    'woff',
    'woff2',
    'ttf',
    'otf',
    'mp4',
    'webm',
] as const;

interface HeaderRule {
    source: string;
    headers: { key: string; value: string }[];
}

function tagRule(source: string, tag: CdnCacheTag): HeaderRule {
    return { source, headers: [{ key: CACHE_TAG_HEADER, value: tag }] };
}

/**
 * `next.config.ts` `headers()`에 그대로 펼친다.
 *
 * **순서가 의미다.** Next는 일치하는 규칙의 헤더를 차례로 덮어쓴다(같은 키면 뒤가 이긴다 —
 * next/dist/server/lib/router-utils/resolve-routes.js `resHeaders[key] = value`). 그래서 모든
 * 경로에 기본 `siglens-html`을 달고, 그 뒤에 지우지 않을 부류만 다른 태그로 덮는다. 새 부류가
 * 규칙에서 빠지면 기본값(배포마다 지움)으로 떨어진다 — 안전한 쪽 실패다.
 */
export const CDN_CACHE_TAG_HEADER_RULES: readonly HeaderRule[] = [
    tagRule('/(.*)', CDN_CACHE_TAG.html),
    // 확장자로 고르는 정적 미디어. `app/icon.png`·`app/apple-icon.png`·`app/favicon.ico`
    // (파일 그대로 서빙되는 메타데이터 파일 — Next가 링크에 `?<내용 해시>`를 붙여 바뀌면 URL이
    // 갈린다)와 `public/` 이미지가 여기 걸린다. 코드로 그리는 이미지 라우트는 아래 OG 규칙들이
    // 다시 덮으므로 **반드시 이 규칙 뒤에** 둔다.
    tagRule(
        `/:path(.*\\.(?:${STATIC_MEDIA_EXTENSIONS.join('|')}))`,
        CDN_CACHE_TAG.asset
    ),
    // `/[locale]/[symbol]/opengraph-image` 등 — 경로 세그먼트가 그 이름으로 시작할 때만.
    // Next가 붙이는 `-<해시>`·확장자 접미사와 `generateImageMetadata`의 하위 경로(`/<id>`)까지
    // 포함한다(확장자가 붙어도 위 미디어 규칙을 덮는다).
    tagRule(
        '/:path((?:.*/)?(?:opengraph|twitter)-image(?:[-.][^/]*)?(?:/.*)?)',
        CDN_CACHE_TAG.og
    ),
    // SiglensAI 공유 카드 `/api/ai/og/<locale>.png`(`app/api/ai/og/[file]/route.tsx`)와 옛
    // 쿼리스트링 경로 `/api/ai/og`. `.png`라 미디어 규칙에 걸리지만 문구·디자인을 코드로 그리므로
    // OG로 분류한다.
    tagRule('/api/ai/og/:path*', CDN_CACHE_TAG.og),
    tagRule('/_next/image', CDN_CACHE_TAG.asset),
    tagRule('/_next/static/:path*', CDN_CACHE_TAG.asset),
];
