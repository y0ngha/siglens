import { STATIC_INDEXABLE_LOCALES } from '@/shared/i18n/indexableLocales';
import { SITE_URL } from '@/shared/lib/seo';

import type { SitemapEntry } from '../model';
import { sitemapAlternates } from './sitemapAlternates';

/**
 * 정적 페이지 하나의 sitemap 엔트리. 모든 정적 라우트가 같은 로케일 집합
 * (`STATIC_INDEXABLE_LOCALES`)으로 대체본을 붙이므로 한 곳에서 만든다. `lastModified`가
 * 없는 엔트리(`/symbols`)와 루트(`SITE_URL`에 `/`가 붙지 않는다)는 이 헬퍼를 쓰지 않는다.
 */
export function staticSitemapEntry(
    path: string,
    lastModified: Date,
    changeFrequency: SitemapEntry['changeFrequency'],
    priority: number
): SitemapEntry {
    return {
        url: `${SITE_URL}${path}`,
        lastModified,
        changeFrequency,
        priority,
        alternates: sitemapAlternates(path, STATIC_INDEXABLE_LOCALES),
    };
}
