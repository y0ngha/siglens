import { getTranslations } from 'next-intl/server';
import type { SeoTranslator } from '@/shared/lib/seo';
import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { DEFAULT_LOCALE, isLocale } from '@/shared/i18n/locales';
import {
    localeAlternatesFrom,
    localeCanonical,
    localeOpenGraph,
    localeRobots,
} from '@/shared/lib/seoAlternates';
import { CATEGORY_CONFIG, categoriesInRegion } from '@/entities/market-news';
import { CategoryCard } from '@/widgets/news-hub';
import { JsonLd } from '@/shared/ui/JsonLd';
import { RegionTabs } from '@/shared/ui/RegionTabs';
import { fetchCategoryPreviews } from '../_lib/categoryPreviews';
import {
    buildBreadcrumbJsonLd,
    buildWebPageJsonLd,
    clampSeoDescription,
    SITE_NAME,
    SITE_URL,
} from '@/shared/lib/seo';

// 24h ISR — 허브 인덱스는 카테고리 구조가 바뀌지 않는 한 신선도가 낮아도 무방.
// 카드별 헤드라인은 staticSymbolCache(24h TTL)를 통해 캐싱된다 — 페이지 revalidate와
// TTL을 맞춰 s-maxage가 1h로 clamp되지 않도록 한다.
export const revalidate = 86400;

const PATH = '/news/us';
export function newsUsTitle(t: SeoTranslator): string {
    return t('newsUs.title');
}
function newsUsFullTitle(t: SeoTranslator): string {
    return `${newsUsTitle(t)} | ${SITE_NAME}`;
}
export function newsUsDescription(t: SeoTranslator): string {
    return clampSeoDescription(t('newsUs.description'));
}

/**
 * 이 페이지는 2026-08 이전 `/news`의 역할을 그대로 이어받았다.
 *
 * `/news`가 미국·한국·암호화폐 3지역 상위 허브가 되면서, "미국 카테고리 목록"이
 * 갈 곳이 필요해졌다. 구 `/news`로 유입되던 질의(`미국 시장 뉴스`, 리브랜딩 전
 * 표기인 `미국 마켓 뉴스`)를 여기가 승계한다 — 그래서 키워드 목록도 함께 옮겼다.
 */
interface LocaleMetadataParams {
    readonly params: Promise<{ locale: string }>;
}

export async function generateMetadata({
    params,
}: LocaleMetadataParams): Promise<Metadata> {
    const { locale } = await params;
    const resolvedLocale = isLocale(locale) ? locale : DEFAULT_LOCALE;
    const ogLocale = localeOpenGraph(resolvedLocale);
    // og:url도 로케일별이어야 한다 — 소셜 언퍼널이 ko URL로 되돌린다.
    const localizedUrl = localeCanonical(resolvedLocale, PATH);
    const url = localizedUrl;
    // 미리보기가 하나도 없으면 이 페이지는 h1 + 두 문단 + 카드 제목뿐이라
    // 2026-07 thin-content 사태에서 문제가 된 분량(약 677자)보다도 얇다.
    // 첫인상으로 판정되는 신규 URL이라 그 상태를 색인시키지 않는다.
    const previews = await Promise.all(
        categoriesInRegion('us').map(cat =>
            fetchCategoryPreviews(
                cat,
                isLocale(locale) ? locale : DEFAULT_LOCALE
            )
        )
    );
    const degraded = previews.every(list => list.length === 0);
    const tSeo = await getTranslations({
        locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
        namespace: 'shared.seo',
    });
    return {
        title: newsUsTitle(tSeo),
        description: newsUsDescription(tSeo),
        keywords: [
            '미국 시장 뉴스',
            // 구 표기. 리브랜딩(2026-08) 전 유입 질의를 잃지 않기 위해 남긴다.
            '미국 마켓 뉴스',
            '미국 주식 뉴스',
            '미국 외환 뉴스',
            '시장 뉴스 한국어',
            '미국 주식 뉴스 요약',
            'AI 뉴스 다이제스트',
            'Siglens 뉴스',
        ],
        alternates: await localeAlternatesFrom(params, PATH, {
            // canonical은 넘기지 않는다 — `localeAlternatesFrom`이 로케일별
            // 자기참조 URL을 만든다. ko 절대 URL을 넘기면 `/en/…`이 ko를
            // canonical로 가리켜 hreflang 상호참조가 깨진다.
            canonical: degraded ? null : undefined,
        }),
        robots: degraded
            ? { index: false, follow: true }
            : localeRobots(resolvedLocale),
        openGraph: {
            type: 'website',
            siteName: SITE_NAME,
            title: newsUsFullTitle(tSeo),
            description: newsUsDescription(tSeo),
            url,
            ...ogLocale,
            // `/news/opengraph-image.tsx`를 **명시적으로** 가리킨다. 파일 컨벤션은
            // 그 세그먼트에 붙고, 하위 세그먼트가 자기 `openGraph`를 선언하면
            // 상속이 끊긴다 — 그러면 공유 카드에 이미지가 통째로 빠지는데,
            // 빌드/렌더에는 아무 에러도 나지 않아 조용히 넘어간다.
            images: [`${SITE_URL}/news/opengraph-image`],
        },
        twitter: {
            card: 'summary_large_image',
            title: newsUsFullTitle(tSeo),
            description: newsUsDescription(tSeo),
            images: [`${SITE_URL}/news/opengraph-image`],
        },
    };
}

export default async function UsNewsHubPage({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    // 정적 렌더 활성화. 이 호출이 없으면 next-intl의 서버 API가 `headers()`로
    // 폴백해 **이 라우트의 ISR이 통째로 꺼진다**(빌드 route 표에서 `●` → `ƒ`).
    // 실측으로 확인했다 — Next 16.2는 `next/root-params` 미지원이라 이 경로가 유일하다.
    setRequestLocale(locale);
    // 셋은 서로 독립이다.
    const [t, tNav, tSeo] = await Promise.all([
        getTranslations('app.news'),
        getTranslations(),
        getTranslations('shared.seo'),
    ]);
    const categories = categoriesInRegion('us');
    const previewsByCategory = await Promise.all(
        categories.map(cat =>
            fetchCategoryPreviews(
                cat,
                isLocale(locale) ? locale : DEFAULT_LOCALE
            )
        )
    );

    const url = `${SITE_URL}${PATH}`;

    const webPageJsonLd = {
        ...buildWebPageJsonLd({
            url: url,
            name: `${newsUsTitle(tSeo)} | ${SITE_NAME}`,
            description: newsUsDescription(tSeo),
            locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
        }),
    };

    const breadcrumbJsonLd = buildBreadcrumbJsonLd(
        [
            { name: t('page.dc06c4'), url: `${SITE_URL}/news` },
            { name: t('page.d311d2'), url },
        ],
        isLocale(locale) ? locale : DEFAULT_LOCALE
    );

    return (
        <>
            <JsonLd data={webPageJsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
                <RegionTabs vertical="news" active="us" currentPath={PATH} />
                <h1 className="text-2xl font-bold tracking-tight text-balance text-secondary-100 sm:text-3xl">
                    {t('page.d311d2')}
                </h1>
                <div className="space-y-1 text-sm text-secondary-400">
                    <p>{t('page.d97943')}</p>
                    <p>{t('page.f5e9de')}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {categories.map((cat, i) => {
                        const cfg = CATEGORY_CONFIG[cat];
                        return (
                            <CategoryCard
                                key={cat}
                                label={tNav(cfg.labelKey)}
                                href={`/news/${cfg.slug}`}
                                description={tNav(cfg.descriptionKey)}
                                previewHeadlines={previewsByCategory[i]}
                            />
                        );
                    })}
                </div>
            </main>
        </>
    );
}
