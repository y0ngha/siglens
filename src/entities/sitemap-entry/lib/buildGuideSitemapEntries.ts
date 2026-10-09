import {
    GUIDE_CATEGORIES,
    type GuideEntrySummary,
} from '@/entities/guide/types';
import { STATIC_INDEXABLE_LOCALES } from '@/shared/i18n/indexableLocales';
import {
    GUIDE_PATH,
    guideCategoryPath,
    guideEntryPath,
} from '@/shared/lib/guidePaths';
import { SITE_URL } from '@/shared/lib/seo';
import type { SitemapEntry } from '../model';
import { maxLastModified } from './maxLastModified';
import { sitemapAlternates } from './sitemapAlternates';

function toEntry(
    path: string,
    lastModified: Date,
    priority: number
): SitemapEntry {
    return {
        url: `${SITE_URL}${path}`,
        lastModified,
        changeFrequency: 'monthly',
        priority,
        alternates: sitemapAlternates(path, STATIC_INDEXABLE_LOCALES),
    };
}

/**
 * 차트 가이드의 sitemap 엔트리 — 허브 1 + 카테고리 4 + 항목 N개. 순수 함수.
 *
 * 항목 목록은 DB에서 오므로 `STATIC_PAGE_PATHS`(고정 상수)에 담을 수 없다. 호출부가 ko 카탈로그를
 * 읽어 넘기고, 이 빌더는 I/O를 하지 않는다. 카탈로그가 비면(오프라인 빌드·시드 전) `[]`다 —
 * 페이지가 "준비 중" noindex로 degrade하는 때에 sitemap이 그 URL을 광고하면 안 된다.
 *
 * lastmod는 항목의 `updatedAt`, 카테고리·허브는 그 아래 항목들의 최댓값이다. `now`는 항목의
 * `updatedAt`이 파싱되지 않을 때의 폴백으로만 쓴다(Invalid Date를 XML에 내보내지 않으려고).
 */
export function buildGuideSitemapEntries(
    entries: readonly GuideEntrySummary[],
    now: Date
): SitemapEntry[] {
    if (entries.length === 0) return [];

    const entryItems = entries.map(entry => {
        const parsed = new Date(entry.updatedAt);
        return {
            entry,
            lastModified: Number.isNaN(parsed.getTime()) ? now : parsed,
        };
    });
    const itemEntries = entryItems.map(({ entry, lastModified }) =>
        toEntry(guideEntryPath(entry.category, entry.slug), lastModified, 0.5)
    );

    const categoryEntries = GUIDE_CATEGORIES.flatMap(category => {
        const inCategory = entryItems.filter(
            ({ entry }) => entry.category === category
        );
        if (inCategory.length === 0) return [];
        const lastModified = new Date(
            Math.max(...inCategory.map(item => item.lastModified.getTime()))
        );
        return [toEntry(guideCategoryPath(category), lastModified, 0.5)];
    });

    const hub = toEntry(GUIDE_PATH, maxLastModified(itemEntries, now), 0.6);

    return [hub, ...categoryEntries, ...itemEntries];
}
