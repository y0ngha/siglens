import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
    isGuideCategory,
    type GuideCatalog,
    type GuideCategory,
    type GuideEntry,
} from '@/entities/guide/types';
import { shortenRevalidateForBuildDegrade } from '@/shared/cache/buildDegradedRevalidate';
import type { Locale } from '@/shared/i18n/locales';
import { guideEntryPath } from '@/shared/lib/guidePaths';
import {
    localeAlternatesFrom,
    localePageRobots,
    localePageSocial,
} from '@/shared/lib/seoAlternates';
import { SITE_NAME } from '@/shared/lib/seo';
import { GuideUnavailablePage } from '@/views/guide/GuideUnavailablePage';

export type GuideRouteParams = Promise<{ locale: string }>;

/** 분류 세그먼트를 검증한다. 모르는 분류는 404 — 카탈로그를 읽기 전에 거른다. */
export function requireCategory(segment: string): GuideCategory {
    if (!isGuideCategory(segment)) notFound();
    return segment;
}

/** 카탈로그에서 항목을 찾는다. slug가 없거나 분류가 어긋나면 404다. */
export function requireEntry(
    catalog: GuideCatalog,
    category: GuideCategory,
    slug: string
): GuideEntry {
    const entry = catalog.entries.find(
        item => item.slug === slug && item.category === category
    );
    if (entry === undefined) notFound();
    return entry;
}

/**
 * 카탈로그를 못 읽은 렌더(DB 없는 빌드·마이그레이션 전·DB 오류·시드 전)의 본문.
 *
 * 404도 500도 아니다 — 안내를 내고 이 렌더의 revalidate를 60초로 낮춰, 안내문이 라우트의
 * `revalidate = 86400` 동안 굳지 않게 한다(배포 직후 첫 요청이 실데이터로 재생성한다).
 * 페이지 렌더 경로에서 불러야 revalidate 하향이 먹는다.
 */
export async function renderGuideUnavailable(
    locale: Locale
): Promise<React.JSX.Element> {
    await shortenRevalidateForBuildDegrade();
    return <GuideUnavailablePage locale={locale} />;
}

interface EntryMetadataInput {
    readonly params: GuideRouteParams;
    readonly locale: Locale;
    readonly entry: GuideEntry;
}

/**
 * 항목 메타데이터. 제목·설명은 DB의 `seoTitle`·`seoDescription`이다.
 * `<title>`은 레이아웃 템플릿(`%s | SIGLENS`)이 브랜드를 붙이고, 소셜 카드는 직접 붙인다.
 * 색인은 `localePageRobots`가 로케일 게이트(ko만)로 정한다.
 */
export async function guideEntryMetadata({
    params,
    locale,
    entry,
}: EntryMetadataInput): Promise<Metadata> {
    const path = guideEntryPath(entry.category, entry.slug);
    return {
        title: entry.seoTitle,
        description: entry.seoDescription,
        alternates: await localeAlternatesFrom(params, path),
        robots: localePageRobots(locale),
        ...localePageSocial(locale, path, {
            title: `${entry.seoTitle} | ${SITE_NAME}`,
            description: entry.seoDescription,
            type: 'article',
        }),
    };
}
