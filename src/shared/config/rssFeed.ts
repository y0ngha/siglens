import { DEFAULT_LOCALE, type Locale } from '@/shared/i18n/locales';
import { SITE_URL } from '@/shared/lib/seo';

/**
 * RSS 피드 경로. `next.config.ts`의 rewrite(`/rss.xml` → `/api/rss`)와 `<link rel="alternate">`
 * 발견 링크가 같은 값을 본다 — 한쪽만 바뀌면 발견 링크가 404를 가리킨다.
 */
export const RSS_FEED_PATH = '/rss.xml';

export const RSS_FEED_URL = `${SITE_URL}${RSS_FEED_PATH}`;

/** `Metadata['alternates']['types']`에 그대로 넣는 발견 링크. */
export const RSS_ALTERNATE_TYPES = {
    'application/rss+xml': RSS_FEED_URL,
} as const;

/**
 * 허브 페이지의 RSS 발견 링크 — 색인 로케일(ko)에만 건다. 피드가 한국어 전용이라 `/en/…`에
 * 걸면 영어 페이지가 한국어 피드를 구독 대상으로 광고한다. 페이지가 `alternates`를 선언하면
 * 레이아웃 값이 교체되므로 페이지마다 이 값을 `types`로 넘겨야 한다.
 */
export function rssAlternateTypes(
    locale: Locale
): typeof RSS_ALTERNATE_TYPES | undefined {
    return locale === DEFAULT_LOCALE ? RSS_ALTERNATE_TYPES : undefined;
}
