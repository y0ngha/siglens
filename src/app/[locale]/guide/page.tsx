import type { Metadata } from 'next';
import { loadGuideCatalog } from '@/entities/guide/api';
import { resolveLocale } from '@/shared/i18n/locales';
import { enterLocale } from '@/shared/lib/enterLocale';
import { GUIDE_PATH } from '@/shared/lib/guidePaths';
import { buildHubMetadata } from '@/shared/lib/seoAlternates';
import { JsonLd } from '@/shared/ui/JsonLd';
import { GuideHubPage } from '@/views/guide/GuideHubPage';
import { loadGuideHubSeoCopy } from '@/views/guide/lib/guideCopy';
import {
    buildGuideBreadcrumbJsonLd,
    buildGuideCollectionJsonLd,
} from '@/views/guide/lib/guideJsonLd';
import {
    renderGuideUnavailable,
    type GuideRouteParams,
} from './_lib/guideRoute';

// 본문이 DB(`guide_entries`)에 있고 시드 재실행으로만 바뀐다 — 태그 무효화 경로가 없어
// 하루 재검증이면 충분하다. 라우트 세그먼트 설정은 리터럴이어야 한다(AP-1).
export const revalidate = 86400;

interface GuideHubRouteProps {
    readonly params: GuideRouteParams;
}

export async function generateMetadata({
    params,
}: GuideHubRouteProps): Promise<Metadata> {
    const { locale: rawLocale } = await params;
    const locale = resolveLocale(rawLocale);
    const catalog = await loadGuideCatalog(locale);
    const seo = await loadGuideHubSeoCopy(locale, catalog?.entries.length ?? 0);
    return buildHubMetadata({
        params,
        locale,
        path: GUIDE_PATH,
        title: seo.hubSeoTitle,
        description: seo.hubSeoDescription,
        keywords: seo.hubSeoKeywords,
        // 카탈로그를 못 읽은 상태는 본문(안내문)과 같은 술어로 noindex다.
        degraded: catalog === null,
    });
}

export default async function GuideHubRoute({ params }: GuideHubRouteProps) {
    const { locale: rawLocale } = await params;
    const locale = enterLocale(rawLocale);
    const catalog = await loadGuideCatalog(locale);
    if (catalog === null) return renderGuideUnavailable(locale);

    const seo = await loadGuideHubSeoCopy(locale, catalog.entries.length);
    return (
        <>
            <JsonLd
                data={buildGuideCollectionJsonLd({
                    locale,
                    path: GUIDE_PATH,
                    name: seo.hubTitle,
                    description: seo.hubSeoDescription,
                    entries: catalog.entries,
                })}
            />
            <JsonLd
                data={buildGuideBreadcrumbJsonLd({
                    locale,
                    hubTitle: seo.hubTitle,
                })}
            />
            <GuideHubPage locale={locale} entries={catalog.entries} />
        </>
    );
}
