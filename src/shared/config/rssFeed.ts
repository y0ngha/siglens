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
