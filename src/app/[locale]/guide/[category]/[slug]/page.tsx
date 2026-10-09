import type { Metadata } from 'next';
import { loadGuideCatalog } from '@/entities/guide/api';
import { resolveLocale } from '@/shared/i18n/locales';
import { enterLocale } from '@/shared/lib/enterLocale';
import { guideEntryPath } from '@/shared/lib/guidePaths';
import { buildHubMetadata } from '@/shared/lib/seoAlternates';
import { JsonLd } from '@/shared/ui/JsonLd';
import { GuideEntryPage } from '@/views/guide/GuideEntryPage';
import {
    loadGuideCategoryCopy,
    loadGuideHubSeoCopy,
} from '@/views/guide/lib/guideCopy';
import {
    buildGuideArticleJsonLd,
    buildGuideBreadcrumbJsonLd,
    buildGuideFaqJsonLd,
} from '@/views/guide/lib/guideJsonLd';
import {
    guideEntryMetadata,
    renderGuideUnavailable,
    requireCategory,
    requireEntry,
} from '../../_lib/guideRoute';

// `/guide`와 같은 근거(AP-1: 리터럴).
export const revalidate = 86400;

// 빈 배열 = on-demand ISR. 항목 90개를 빌드에서 미리 굽지 않는다 — 빌드는 DB가 없을 수 있다(AP-1).
export async function generateStaticParams() {
    return [];
}

interface GuideEntryRouteProps {
    readonly params: Promise<{
        locale: string;
        category: string;
        slug: string;
    }>;
}

export async function generateMetadata({
    params,
}: GuideEntryRouteProps): Promise<Metadata> {
    const { locale: rawLocale, category: categorySegment, slug } = await params;
    const locale = resolveLocale(rawLocale);
    const category = requireCategory(categorySegment);
    const catalog = await loadGuideCatalog(locale);
    if (catalog === null) {
        // 본문을 못 읽은 렌더 — 안내문과 같은 술어로 noindex. 항목 제목을 모르니 허브 제목을 쓴다.
        const seo = await loadGuideHubSeoCopy(locale, 0);
        return buildHubMetadata({
            params,
            locale,
            path: guideEntryPath(category, slug),
            title: seo.hubTitle,
            description: seo.hubSeoDescription,
            keywords: [],
            degraded: true,
        });
    }
    // 없는 항목은 메타를 내지 않고 404다 — 페이지만 notFound()를 던지면 404 응답에 정상 항목의
    // title·og가 얹힌다.
    const entry = requireEntry(catalog, category, slug);
    return guideEntryMetadata({ params, locale, entry });
}

export default async function GuideEntryRoute({
    params,
}: GuideEntryRouteProps) {
    const { locale: rawLocale, category: categorySegment, slug } = await params;
    const locale = enterLocale(rawLocale);
    const category = requireCategory(categorySegment);
    const catalog = await loadGuideCatalog(locale);
    if (catalog === null) return renderGuideUnavailable(locale);
    const entry = requireEntry(catalog, category, slug);

    const [copy, seo] = await Promise.all([
        loadGuideCategoryCopy(locale),
        loadGuideHubSeoCopy(locale, catalog.entries.length),
    ]);
    const faqJsonLd = buildGuideFaqJsonLd(entry.faq);
    return (
        <>
            <JsonLd data={buildGuideArticleJsonLd({ locale, entry })} />
            <JsonLd
                data={buildGuideBreadcrumbJsonLd({
                    locale,
                    hubTitle: seo.hubTitle,
                    category: { id: category, label: copy.label[category] },
                    entryTitle: entry.title,
                    entrySlug: entry.slug,
                })}
            />
            {faqJsonLd === null ? null : <JsonLd data={faqJsonLd} />}
            <GuideEntryPage
                locale={locale}
                entry={entry}
                catalog={catalog.entries}
            />
        </>
    );
}
