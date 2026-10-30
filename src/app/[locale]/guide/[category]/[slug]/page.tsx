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
    countGuideHubEntries,
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
import { loadGuideLiveSymbols } from '../../_lib/loadGuideLiveSymbols';

// 라이브 종목 모듈이 1시간 캐시(섹터 신호)를 읽으므로 그 주기에 맞춘다. 허브·카테고리는 86400 유지(src/app/CLAUDE.md#AP-1: 리터럴).
export const revalidate = 3600; // 1h

// 빈 배열 = on-demand ISR. 항목 90개를 빌드에서 미리 굽지 않는다 — 빌드는 DB가 없을 수 있다(src/app/CLAUDE.md#AP-1).
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

/** 항목 페이지 메타데이터 — 카탈로그 실패는 허브 제목으로 noindex, 없는 항목은 404. */
export async function generateMetadata({
    params,
}: GuideEntryRouteProps): Promise<Metadata> {
    const { locale: rawLocale, category: categorySegment, slug } = await params;
    const locale = resolveLocale(rawLocale);
    const category = requireCategory(categorySegment);
    const catalog = await loadGuideCatalog(locale);
    if (catalog === null) {
        // 본문을 못 읽은 렌더 — 안내문과 같은 술어로 noindex. 항목 제목을 모르니 허브 제목을 쓴다.
        const seo = await loadGuideHubSeoCopy(locale, { terms: 0, howto: 0 });
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

/** 항목 페이지 — 본문·FAQ·관련 항목과 라이브 종목 모듈(데이터원 실패 시 생략). */
export default async function GuideEntryRoute({
    params,
}: GuideEntryRouteProps) {
    const { locale: rawLocale, category: categorySegment, slug } = await params;
    const locale = enterLocale(rawLocale);
    const category = requireCategory(categorySegment);
    const catalog = await loadGuideCatalog(locale);
    if (catalog === null) return renderGuideUnavailable(locale);
    const entry = requireEntry(catalog, category, slug);

    const [copy, seo, liveSymbols] = await Promise.all([
        loadGuideCategoryCopy(locale),
        loadGuideHubSeoCopy(locale, countGuideHubEntries(catalog.entries)),
        loadGuideLiveSymbols(entry, catalog.entries),
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
                liveSymbols={liveSymbols}
            />
        </>
    );
}
