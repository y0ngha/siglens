import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import {
    CATEGORY_CONFIG,
    categoriesInRegion,
} from '@/entities/market-news/lib/categoryConfig';
import { CategoryCard } from '@/widgets/news-hub/CategoryCard';
import { shortenRevalidateIfDatabaseMissingAtBuild } from '@/shared/cache/buildDegradedRevalidate';
import { resolveLocale } from '@/shared/i18n/locales';
import { brandTitle } from '@/shared/lib/brandName';
import { enterLocale } from '@/shared/lib/enterLocale';
import {
    buildBreadcrumbJsonLd,
    buildWebPageJsonLd,
    SITE_URL,
    type SeoTranslator,
} from '@/shared/lib/seo';
import { clampSeoDescription } from '@/shared/lib/seoClamp';
import {
    localeAlternatesFrom,
    selfCanonicalAlternates,
} from '@/shared/lib/seoAlternates';
import { Breadcrumb } from '@/shared/ui/Breadcrumb';
import { JsonLd } from '@/shared/ui/JsonLd';
import { RegionTabs } from '@/shared/ui/RegionTabs';
import { fetchCategoryDigestLines } from '../_lib/categoryDigests';
import { fetchCategoryPreviews } from '../_lib/categoryPreviews';
import {
    buildNewsHubMetadata,
    NEWS_HUB_OG_IMAGE_PATH,
} from '../_lib/newsHubMetadata';
import { allPreviewsEmpty } from '../_lib/regionPreviews';

// 24h ISR — 허브 인덱스는 카테고리 구조가 바뀌지 않는 한 신선도가 낮아도 무방.
// 카드별 헤드라인은 staticSymbolCache(24h TTL)를 통해 캐싱된다 — 페이지 revalidate와
// TTL을 맞춰 s-maxage가 1h로 clamp되지 않도록 한다.
export const revalidate = 86400;

const PATH = '/news/us';

/** metadata·JSON-LD `name`이 공유하는 허브 제목(브랜드 없음). */
function newsUsTitle(t: SeoTranslator): string {
    return t('newsUs.title');
}

/** metadata·JSON-LD가 같은 길이 제한을 거친 설명을 쓰도록 한 곳에서 자른다. */
function newsUsDescription(t: SeoTranslator): string {
    return clampSeoDescription(t('newsUs.description'));
}

interface UsNewsHubRouteProps {
    readonly params: Promise<{ locale: string }>;
}

/**
 * 미국 카테고리 허브. `/news`가 3지역 상위 허브라 미국 관련 질의(`미국 시장 뉴스`와
 * 옛 표기 `미국 마켓 뉴스`)는 여기가 타게팅한다. 미리보기가 하나도 없으면 h1 + 두 문단 +
 * 카드 제목뿐인 thin 분량이라 색인시키지 않는다.
 */
export async function generateMetadata({
    params,
}: UsNewsHubRouteProps): Promise<Metadata> {
    const locale = resolveLocale((await params).locale);
    const [previews, tSeo] = await Promise.all([
        Promise.all(
            categoriesInRegion('us').map(cat =>
                fetchCategoryPreviews(cat, locale)
            )
        ),
        getTranslations({ locale, namespace: 'shared.seo' }),
    ]);
    const degraded = allPreviewsEmpty(previews);
    return buildNewsHubMetadata({
        locale,
        path: PATH,
        title: newsUsTitle(tSeo),
        description: newsUsDescription(tSeo),
        keywords: [
            '미국 시장 뉴스',
            // 옛 표기 — 기존 유입 질의를 잃지 않기 위해 남긴다.
            '미국 마켓 뉴스',
            '미국 주식 뉴스',
            '미국 외환 뉴스',
            '시장 뉴스 한국어',
            '미국 주식 뉴스 요약',
            'AI 뉴스 다이제스트',
            '시그렌즈 뉴스',
        ],
        degraded,
        alternates: degraded
            ? selfCanonicalAlternates(locale, PATH)
            : await localeAlternatesFrom(params, PATH),
        // 이 세그먼트에는 `opengraph-image`가 없다 — `/news`의 이미지를 명시적으로 가리킨다.
        imagePath: NEWS_HUB_OG_IMAGE_PATH,
    });
}

/**
 * 미국 카테고리 허브 — 카테고리 카드(미리보기 헤드라인 + 다이제스트 한 줄). 미리보기가 전부
 * 비면 metadata와 같은 판정으로 구조화데이터를 생략한다.
 */
export default async function UsNewsHubPage({ params }: UsNewsHubRouteProps) {
    const locale = enterLocale((await params).locale);
    // 배포 빌드에는 DB가 없다 — 이름/미리보기 없이 구워진 이 렌더를 60초 뒤 재생성하게 한다.
    await shortenRevalidateIfDatabaseMissingAtBuild();
    const categories = categoriesInRegion('us');
    // 번역자·미리보기·다이제스트 한 줄은 서로 독립이다.
    const [t, tNav, tSeo, previewsByCategory, digestLines] = await Promise.all([
        getTranslations('app.news'),
        getTranslations(),
        getTranslations('shared.seo'),
        Promise.all(categories.map(cat => fetchCategoryPreviews(cat, locale))),
        fetchCategoryDigestLines(categories, locale),
    ]);
    // metadata가 noindex를 거는 것과 같은 술어로 구조화데이터를 끈다.
    const degraded = allPreviewsEmpty(previewsByCategory);
    const url = `${SITE_URL}${PATH}`;
    const hubName = t('page.dc06c4');
    const pageName = t('page.d311d2');

    return (
        <>
            {!degraded && (
                <>
                    <JsonLd
                        data={buildWebPageJsonLd({
                            url,
                            name: brandTitle(newsUsTitle(tSeo), locale),
                            description: newsUsDescription(tSeo),
                            locale,
                        })}
                    />
                    <JsonLd
                        data={buildBreadcrumbJsonLd(
                            [
                                { name: hubName, url: `${SITE_URL}/news` },
                                { name: pageName, url },
                            ],
                            locale
                        )}
                    />
                </>
            )}
            <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
                <RegionTabs vertical="news" active="us" currentPath={PATH} />
                {/* 가시 브레드크럼 — 위 BreadcrumbList와 같은 마디·같은 텍스트. */}
                <Breadcrumb
                    trail={[
                        { label: hubName, href: '/news' },
                        { label: pageName },
                    ]}
                />
                <h1 className="text-2xl font-bold tracking-tight text-balance text-secondary-50 sm:text-3xl">
                    {pageName}
                </h1>
                <div className="space-y-1 text-sm text-secondary-400">
                    <p>{t('page.d97943')}</p>
                    {/* 이 페이지의 카드는 전부 `/news/{slug}`로 가는 내부 링크다 — 원문 기사로
                        나가는 것은 리프 카테고리 페이지의 기사 카드라, 안내 문장도 그에 맞춘다. */}
                    <p>{t('page.ace274')}</p>
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
                                digestLine={digestLines[i]}
                            />
                        );
                    })}
                </div>
            </main>
        </>
    );
}
