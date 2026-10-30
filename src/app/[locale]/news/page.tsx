import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import {
    CATEGORY_CONFIG,
    categoriesInRegion,
    type NewsFeedCategoryId,
} from '@/entities/market-news/lib/categoryConfig';
import { CategoryCard } from '@/widgets/news-hub/CategoryCard';
import { shortenRevalidateIfDatabaseMissingAtBuild } from '@/shared/cache/buildDegradedRevalidate';
import { regionsOf, type NavRegionId } from '@/shared/config/assetClassNav';
import { resolveLocale } from '@/shared/i18n/locales';
import { brandTitle } from '@/shared/lib/brandName';
import { cn } from '@/shared/lib/cn';
import { enterLocale } from '@/shared/lib/enterLocale';
import {
    buildBreadcrumbJsonLd,
    buildWebPageJsonLd,
    clampSeoDescription,
    SITE_URL,
    type SeoTranslator,
} from '@/shared/lib/seo';
import {
    localeAlternatesFrom,
    selfCanonicalAlternates,
} from '@/shared/lib/seoAlternates';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { Breadcrumb } from '@/shared/ui/Breadcrumb';
import { JsonLd } from '@/shared/ui/JsonLd';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { fetchCategoryDigestLines } from './_lib/categoryDigests';
import { fetchCategoryPreviews } from './_lib/categoryPreviews';
import { buildNewsHubMetadata } from './_lib/newsHubMetadata';
import { allPreviewsEmpty, previewCategoryOf } from './_lib/regionPreviews';

// 24h ISR — 허브 인덱스는 지역 구조가 바뀌지 않는 한 신선도가 낮아도 무방.
// 카드별 헤드라인은 staticSymbolCache(24h TTL)를 통해 캐싱된다 — 페이지 revalidate와
// TTL을 맞춰 s-maxage가 1h로 clamp되지 않도록 한다.
export const revalidate = 86400;

const NEWS_HUB_PATH = '/news';

/**
 * 3지역 커버리지를 밝히는 허브 제목 — metadata·h1 옆 JSON-LD `name`이 공유한다.
 * 커버리지 문구는 `src/app/__tests__/supportedAssets.test.ts`가 카탈로그 원문에서 검사한다.
 */
function newsHubTitle(t: SeoTranslator): string {
    return t('newsHub.title');
}

/** metadata·JSON-LD가 같은 길이 제한을 거친 설명을 쓰도록 한 곳에서 자른다. */
function newsHubDescription(t: SeoTranslator): string {
    return clampSeoDescription(t('newsHub.description'));
}

/** 지역 카드 순서(`regionsOf('news')`)와 같은 순서의 미리보기 카테고리. */
function regionPreviewCategories(): NewsFeedCategoryId[] {
    return regionsOf('news').map(region => previewCategoryOf(region.region));
}

/**
 * 지역 카드 설명의 메시지 키(`app.news`). `CATEGORY_CONFIG.descriptionKey`를 재사용하지
 * 않는다 — 그건 단일 카테고리 설명이고 여기서는 지역 전체(미국은 4개 카테고리)를 말해야 한다.
 * 키만 두고 `t()` 호출은 번역자를 선언한 렌더 쪽에서 한다(`noTranslatorParamCall` 가드).
 */
const REGION_DESCRIPTION_KEY: Record<NavRegionId, string> = {
    us: 'regionDescription.us',
    kr: 'regionDescription.kr',
    crypto: 'regionDescription.crypto',
};

interface NewsHubRouteProps {
    readonly params: Promise<{ locale: string }>;
}

/**
 * 3지역 상위 허브. 지역 head term(`미국 시장 뉴스`·`한국 증시 뉴스`·`암호화폐 뉴스`)은
 * 각 지역 허브가 title·h1·본문으로 정면 타게팅하므로 여기에 넣지 않는다 — 허브가 같은
 * 질의를 노리면 두 URL이 나눠 갖고, 구글은 보통 주제로는 더 얕은 허브를 고른다.
 * 허브는 "어느 시장인지 아직 안 정한" 상위 질의만 노린다.
 */
export async function generateMetadata({
    params,
}: NewsHubRouteProps): Promise<Metadata> {
    const locale = resolveLocale((await params).locale);
    const [previews, tSeo] = await Promise.all([
        Promise.all(
            regionPreviewCategories().map(category =>
                fetchCategoryPreviews(category, locale)
            )
        ),
        getTranslations({ locale, namespace: 'shared.seo' }),
    ]);
    const degraded = allPreviewsEmpty(previews);
    return buildNewsHubMetadata({
        locale,
        path: NEWS_HUB_PATH,
        title: newsHubTitle(tSeo),
        description: newsHubDescription(tSeo),
        keywords: [
            '시장 뉴스',
            '주식 뉴스',
            '시장 뉴스 한국어',
            'AI 뉴스 다이제스트',
            '시그렌즈 뉴스',
        ],
        degraded,
        alternates: degraded
            ? selfCanonicalAlternates(locale, NEWS_HUB_PATH)
            : await localeAlternatesFrom(params, NEWS_HUB_PATH),
    });
}

/**
 * 3지역 상위 허브 — 지역 카드(미리보기 헤드라인 + 다이제스트 한 줄)와 미국 카테고리 바로가기.
 * 미리보기가 전부 비면 metadata와 같은 판정으로 구조화데이터를 생략한다.
 */
export default async function NewsHubPage({ params }: NewsHubRouteProps) {
    const locale = enterLocale((await params).locale);
    // 배포 빌드에는 DB가 없다 — 이름/미리보기 없이 구워진 이 렌더를 60초 뒤 재생성하게 한다.
    await shortenRevalidateIfDatabaseMissingAtBuild();
    const regions = regionsOf('news');
    const previewCategories = regionPreviewCategories();
    // 번역자·미리보기 헤드라인(제3자 제목)·다이제스트 한 줄(우리 서술)은 서로 독립이다.
    // 다이제스트를 함께 싣는 이유는 허브가 남의 제목 모음이 되지 않도록이다(`categoryDigests` JSDoc).
    const [tNav, t, tSeo, previews, digestLines] = await Promise.all([
        getTranslations(),
        getTranslations('app.news'),
        getTranslations('shared.seo'),
        Promise.all(
            previewCategories.map(category =>
                fetchCategoryPreviews(category, locale)
            )
        ),
        fetchCategoryDigestLines(previewCategories, locale),
    ]);
    // metadata가 noindex를 거는 것과 같은 술어로 구조화데이터를 끈다 — "색인하지 말라"면서
    // "이 URL이 정식 WebPage"라고 주장하지 않는다(자매 허브와 같은 규칙).
    const degraded = allPreviewsEmpty(previews);
    const hubUrl = `${SITE_URL}${NEWS_HUB_PATH}`;
    const hubName = t('page.dc06c4');

    return (
        <>
            {!degraded && (
                <>
                    <JsonLd
                        data={buildWebPageJsonLd({
                            url: hubUrl,
                            name: brandTitle(newsHubTitle(tSeo), locale),
                            description: newsHubDescription(tSeo),
                            locale,
                        })}
                    />
                    <JsonLd
                        data={buildBreadcrumbJsonLd(
                            [{ name: hubName, url: hubUrl }],
                            locale
                        )}
                    />
                </>
            )}
            <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
                {/* 가시 브레드크럼 — 텍스트가 BreadcrumbList JSON-LD의 `name`과
                    같아야 구글이 마크업을 무시하지 않는다. */}
                <Breadcrumb trail={[{ label: hubName }]} />
                <h1 className="text-2xl font-bold tracking-tight text-balance text-secondary-50 sm:text-3xl">
                    {hubName}
                </h1>
                <div className="space-y-1 text-sm text-secondary-400">
                    <p>{t('page.17728f')}</p>
                    <p>{t('page.a96e68')}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {regions.map((region, i) => (
                        <CategoryCard
                            key={region.region}
                            label={tNav(region.fullLabelKey)}
                            href={region.href}
                            description={t(
                                REGION_DESCRIPTION_KEY[region.region]
                            )}
                            previewHeadlines={previews[i]}
                            digestLine={digestLines[i]}
                        />
                    ))}
                </div>
                {/*
                    미국 4개 카테고리로 가는 직접 링크. 지역 카드만 두면 미국
                    사용자가 원하는 카테고리에 닿기까지 클릭이 두 번 필요하다.
                    목적지는 `/news/us`와 같지만 이쪽은 인덱스, 저쪽은 미리보기까지
                    있는 허브라 중복 콘텐츠가 되지 않는다.
                */}
                <section
                    aria-labelledby="news-hub-category-index"
                    className={cn('p-5', SURFACE_CARD)}
                >
                    <h2
                        id="news-hub-category-index"
                        /* 이 h2는 카테고리 바로가기라는 **보조 목록**의 라벨이라,
                           같은 페이지의 지역 카드 제목(h2, 16px)보다 커지면
                           페이지에서 가장 큰 소리를 내게 된다. 색·굵기는 토큰을
                           따르되 크기만 한 단계 낮춰 카드와 같은 위계에 둔다. */
                        className={cn(HEADING_SECTION, 'text-base')}
                    >
                        {t('page.e02fdd')}
                    </h2>
                    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                        {categoriesInRegion('us').map(cat => (
                            <li key={cat}>
                                <Link
                                    href={`/news/${CATEGORY_CONFIG[cat].slug}`}
                                    // 허브에 다수 렌더 — 진입만으로 링크마다 `_rsc` prefetch가 나가지 않게 끈다.
                                    prefetch={false}
                                    className="text-sm text-primary-400 transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                                >
                                    {/* `koLabel`은 AI 프롬프트 입력이라 전 로케일 한국어다 — 화면
                                        라벨은 로케일 카탈로그(`labelKey`)에서 읽는다. */}
                                    {tNav(CATEGORY_CONFIG[cat].labelKey)}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            </main>
        </>
    );
}
