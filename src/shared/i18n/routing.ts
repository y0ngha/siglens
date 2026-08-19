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
 */
export const routing = defineRouting({
    locales: LOCALES,
    defaultLocale: DEFAULT_LOCALE,
    localePrefix: 'as-needed',
    localeDetection: false,
});
