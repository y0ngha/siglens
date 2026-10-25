import type { Metadata } from 'next';
import { loadGuideCatalog } from '@/entities/guide/api';
import { resolveLocale } from '@/shared/i18n/locales';
import { enterLocale } from '@/shared/lib/enterLocale';
import { guideCategoryPath } from '@/shared/lib/guidePaths';
import { buildHubMetadata } from '@/shared/lib/seoAlternates';
import { JsonLd } from '@/shared/ui/JsonLd';
import { GuideCategoryPage } from '@/views/guide/GuideCategoryPage';
import { notFound } from 'next/navigation';
import {
    countGuideHubEntries,
    loadGuideCategoryCopy,
    loadGuideHubSeoCopy,
} from '@/views/guide/lib/guideCopy';
import {
    buildGuideBreadcrumbJsonLd,
    buildGuideCollectionJsonLd,
} from '@/views/guide/lib/guideJsonLd';
import { renderGuideUnavailable, requireCategory } from '../_lib/guideRoute';

// `/guide`와 같은 근거(AP-1: 리터럴).
export const revalidate = 86400;

// 빈 배열 = on-demand ISR. 이게 없으면 동적 세그먼트가 매 요청 렌더(ƒ)로 남는다(AP-1).
export async function generateStaticParams() {
    return [];
}

interface GuideCategoryRouteProps {
    readonly params: Promise<{ locale: string; category: string }>;
}

export async function generateMetadata({
    params,
}: GuideCategoryRouteProps): Promise<Metadata> {
    const { locale: rawLocale, category: categorySegment } = await params;
    const locale = resolveLocale(rawLocale);
    const category = requireCategory(categorySegment);
    const catalog = await loadGuideCatalog(locale);
    const count =
        catalog?.entries.filter(entry => entry.category === category).length ??
        0;
    // 항목이 없는 분류(시드 전의 howto 등)는 빈 목록 페이지를 색인시키지 않는다. 카탈로그를 못 읽은 경우(null)는 안내가 맡는다.
    if (catalog !== null && count === 0) notFound();
    const [copy, seo] = await Promise.all([
        loadGuideCategoryCopy(locale),
        loadGuideHubSeoCopy(
            locale,
            countGuideHubEntries(catalog?.entries ?? [])
        ),
    ]);
    return buildHubMetadata({
        params,
        locale,
        path: guideCategoryPath(category),
        title: copy.seoTitle[category],
        description: seo.categoryDescription(category, count),
        keywords: [copy.label[category], ...seo.hubSeoKeywords.slice(0, 1)],
        degraded: catalog === null,
    });
}

export default async function GuideCategoryRoute({
    params,
}: GuideCategoryRouteProps) {
    const { locale: rawLocale, category: categorySegment } = await params;
    const locale = enterLocale(rawLocale);
    const category = requireCategory(categorySegment);
    const catalog = await loadGuideCatalog(locale);
    if (catalog === null) return renderGuideUnavailable(locale);

    const inCategory = catalog.entries.filter(
        entry => entry.category === category
    );
    // 항목이 없는 분류는 404다 — 빈 목록이 soft 404로 색인되지 않게 한다.
    if (inCategory.length === 0) notFound();
    const [copy, seo] = await Promise.all([
        loadGuideCategoryCopy(locale),
        loadGuideHubSeoCopy(locale, countGuideHubEntries(catalog.entries)),
    ]);
    const path = guideCategoryPath(category);
    return (
        <>
            <JsonLd
                data={buildGuideCollectionJsonLd({
                    locale,
                    path,
                    name: copy.label[category],
                    description: seo.categoryDescription(
                        category,
                        inCategory.length
                    ),
                    entries: inCategory,
                })}
            />
            <JsonLd
                data={buildGuideBreadcrumbJsonLd({
                    locale,
                    hubTitle: seo.hubTitle,
                    category: { id: category, label: copy.label[category] },
                })}
            />
            <GuideCategoryPage
                locale={locale}
                category={category}
                entries={catalog.entries}
            />
        </>
    );
}
