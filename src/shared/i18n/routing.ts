import { defineRouting } from 'next-intl/routing';
import { DEFAULT_LOCALE, LOCALES } from './locales';

/**
 * next-intl 라우팅 정의.
 *
 * **`localePrefix: 'as-needed'`** — 기본 로케일(ko)은 접두사가 없다. 이 사이트는
 * 이미 순위를 가진 한국어 URL(`/AAPL`, `/news/us`)이 색인돼 있고, 2026-07에 크롤
 * 수요가 붕괴한 이력이 있다. 전 URL을 `/ko/...`로 옮기는 것은 그 사고를 자초하는
 * 변경이라 선택지가 아니다.
 *
 * **`localeDetection: false`** — Accept-Language 자동 리다이렉트를 끈다. 두 가지
 * 이유가 있다.
 *  1. Googlebot은 미국 IP + `Accept-Language: en`으로 크롤한다. 자동 리다이렉트를
 *     켜면 크롤러가 한국어 canonical에서 이탈해 기존 색인이 무너진다.
 *  2. 요청 헤더로 응답이 갈리면 CDN이 `Vary`를 타거나 캐시 키가 오염된다. 이 레포는
 *     `Vary` 때문에 Cloudflare URL 퍼지가 먹지 않는 문제를 이미 겪었다.
 * 언어 선택은 헤더 스위처에서 명시적으로만 이뤄진다.
 *
 * **`alternateLinks: false`** — next-intl 기본값은 `true`라서 매칭된 **모든**
 * 응답에 `Link: <...>; rel="alternate"; hreflang="..."` 헤더를 붙인다. Google은
 * HTTP `Link` hreflang을 HTML 태그와 동일하게 취급하므로, 이게 켜져 있으면
 * `SYMBOL_INDEXABLE_LOCALES`/`buildLanguageAlternates`로 만든 색인 게이트가
 * **HTTP 계층에서 통째로 우회된다**. 실측에서 `/AAPL`(순위 있는 페이지)이
 * noindex인 `/en/AAPL`·`/ja/AAPL`·`/zh/AAPL`을 alternate로 광고하고 있었다 —
 * noindex 대상을 alternate로 걸면 Google은 클러스터를 폐기하고 크롤 예산만 태운다.
 * 게다가 헤더는 `hreflang="zh"`를 쓰는데 `LOCALE_HREFLANG`는 `zh-Hans`라 둘이
 * 어긋난다. hreflang은 `seoAlternates.ts`와 sitemap 한 곳에서만 나가야 한다.
 *
 * **`localeCookie: false`** — 기본값은 `NEXT_LOCALE` 쿠키를 굽는 것이다.
 * `localeDetection: false`라 **읽지도 않는 쿠키**인데, `Set-Cookie`가 붙는 순간
 * Cloudflare가 해당 HTML을 캐시하지 않는다. PR #719로 HTML 히트율을
 * 13.8%→36.7%까지 올린 작업이 한국어 페이지 포함 전 페이지에서 무효화된다.
 */
export const routing = defineRouting({
    locales: LOCALES,
    defaultLocale: DEFAULT_LOCALE,
    localePrefix: 'as-needed',
    localeDetection: false,
    alternateLinks: false,
    localeCookie: false,
});
