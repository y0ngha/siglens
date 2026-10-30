import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { peekMarketNewsDigestStatic } from '@/entities/market-news/api/marketNewsDigestStaticCache';
import {
    CATEGORY_CONFIG,
    NEWS_CATEGORY_SLUGS,
    categoryFromSlug,
} from '@/entities/market-news/lib/categoryConfig';
import { MarketNewsDigest } from '@/widgets/market-news/MarketNewsDigest';
import { MarketNewsList } from '@/widgets/market-news/MarketNewsList';
import { NewsCategoryTabs } from '@/widgets/news-hub/NewsCategoryTabs';
import { NEWS_ROW_SERIALIZATION_LIMIT } from '@/shared/config/newsSerialization';
import { rssAlternateTypes } from '@/shared/config/rssFeed';
import { isDatabaseConfigured } from '@/shared/db/config';
import { resolveLocale } from '@/shared/i18n/locales';
import { brandTitle } from '@/shared/lib/brandName';
import { enterLocale } from '@/shared/lib/enterLocale';
import {
    buildBreadcrumbJsonLd,
    buildWebPageJsonLd,
    SITE_URL,
} from '@/shared/lib/seo';
import { localeAlternates, localePageRobots } from '@/shared/lib/seoAlternates';
import { Breadcrumb } from '@/shared/ui/Breadcrumb';
import { JsonLd } from '@/shared/ui/JsonLd';
import { RegionTabs } from '@/shared/ui/RegionTabs';
import { DigestSkeleton } from './_components/DigestSkeleton';
import { MarketNewsDegraded } from './_components/MarketNewsDegraded';
import {
    categoryBreadcrumbTrail,
    toVisibleCrumbs,
} from './_lib/categoryBreadcrumb';
import { buildCategoryKeywords } from './_lib/categoryKeywords';
import {
    buildEmptyCategoryMetadata,
    categorySocialMetadata,
} from './_lib/categoryMetadata';
import { loadCategorySnapshot } from './_lib/categorySnapshot';
import { buildNewsItemListJsonLd } from './_lib/newsItemListJsonLd';
import { buildCategoryPageDescription, buildCategoryPageTitle } from './seo';

// 12h ISR — 신선도는 ensureMarketNewsCardsAnalyzedAction의 on-demand
// revalidateTag('market-news:<sentinel>', 'max')가 보장, 시간 기반은 상한만.
export const revalidate = 43200;

type CategoryPageParams = { category: string };

/**
 * DB가 있는 빌드(로컬·E2E)에서만 전 카테고리를 빌드타임에 prerender한다.
 *
 * 배포 빌드에는 DB가 없어, 그 상태로 prerender하면 뉴스 목록이 `[]`인 degrade 페이지(noindex)가
 * 구워져 12h revalidate 동안 크롤러에게 나간다. 그래서 DB가 없으면 빈 배열(= on-demand ISR —
 * 이게 없으면 동적 세그먼트가 매 요청 렌더로 남는다, 축 3)을 돌려 첫 요청이 실데이터로 렌더하게
 * 한다(에러/빈 결과는 `cacheNonEmpty`가 굳히지 않는다).
 */
export function generateStaticParams(): CategoryPageParams[] {
    if (!isDatabaseConfigured()) return [];
    return NEWS_CATEGORY_SLUGS.map(category => ({ category }));
}

interface Props {
    params: Promise<{ locale: string; category: string }>;
}

/**
 * 잘못된 slug는 404, 빈 목록은 noindex 메타(`buildEmptyCategoryMetadata`), 그 외에는 색인
 * 메타(로케일별 alternates + RSS 발견 링크)를 낸다 — 판정은 본문과 같은 `loadCategorySnapshot`.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale: rawLocale, category: slug } = await params;
    const locale = resolveLocale(rawLocale);
    const cat = categoryFromSlug(slug);
    // 잘못된 slug — 본문과 같은 판정으로 메타데이터 단계에서도 404다. 본문만 notFound()를 던지면
    // generateMetadata 결과가 이겨 404 응답이 홈 description·og·twitter를 상속한다. 던지면 404
    // 경계(`[locale]/not-found.tsx`)의 메타가 쓰인다.
    if (!cat) notFound();

    const cfg = CATEGORY_CONFIG[cat];
    const canonicalPath = `/news/${cfg.slug}`;
    // 카테고리 라벨·소개는 네 로케일 카탈로그의 키(`labelKey`·`descriptionKey`)로 푼다 —
    // `koLabel`을 번역된 템플릿에 꽂으면 반쪽만 번역된 문장이 나간다.
    const [tSeo, tRoot, { isEmpty }] = await Promise.all([
        getTranslations({ locale, namespace: 'shared.seo' }),
        getTranslations({ locale }),
        loadCategorySnapshot(cat, locale),
    ]);
    const label = tRoot(cfg.labelKey);

    if (isEmpty) {
        return buildEmptyCategoryMetadata({
            locale,
            canonicalPath,
            label,
            tSeo,
        });
    }

    const title = buildCategoryPageTitle(label, tSeo);
    const description = buildCategoryPageDescription(
        tRoot(cfg.descriptionKey),
        tSeo
    );
    return {
        title,
        description,
        keywords: buildCategoryKeywords(cfg),
        // canonical을 넘기지 않는다 — `localeAlternates`가 로케일별 자기참조 URL을 만든다.
        // 로케일 무관 경로를 넘기면 `/en/news/…`이 ko를 canonical로 가리켜 hreflang 상호참조가 깨진다.
        alternates: localeAlternates(locale, canonicalPath, {
            types: rssAlternateTypes(locale),
        }),
        // 루트 레이아웃과 같은 값이지만 명시한다 — 생략하면 상속에 기대게 된다(src/app/CLAUDE.md#AP-3).
        robots: localePageRobots(locale),
        ...categorySocialMetadata(
            locale,
            canonicalPath,
            brandTitle(title, locale),
            description
        ),
    };
}

/**
 * 카테고리 뉴스 페이지 — 지역·카테고리 탭, 다이제스트(SSR peek 시드), 기사 목록. 목록이 비면
 * 탭을 남긴 채 degrade 안내를 그리고 WebPage·BreadcrumbList 구조화데이터는 생략한다.
 */
export default async function CategoryNewsPage({ params }: Props) {
    const { locale: rawLocale, category: slug } = await params;
    const locale = enterLocale(rawLocale);
    const cat = categoryFromSlug(slug);
    if (!cat) notFound();

    const cfg = CATEGORY_CONFIG[cat];
    const categoryPath = `/news/${cfg.slug}`;
    // 번역자·목록·다이제스트 SSR 시드(`peekMarketNewsDigestStatic`, 읽기 전용 peek)는 서로 독립이다.
    const [tNav, t, tSeo, { items, isEmpty }, digestPeekSeed] =
        await Promise.all([
            getTranslations(),
            getTranslations('app.news'),
            getTranslations('shared.seo'),
            loadCategorySnapshot(cat, locale),
            peekMarketNewsDigestStatic(cat, locale),
        ]);
    const label = tNav(cfg.labelKey);
    const intro = tNav(cfg.descriptionKey);
    const categoryUrl = `${SITE_URL}${categoryPath}`;
    // JSON-LD와 화면 브레드크럼의 단일 소스.
    const breadcrumbTrail = categoryBreadcrumbTrail(cfg, categoryPath, tNav);
    const newsListJsonLd = buildNewsItemListJsonLd(
        items,
        tSeo('faq.newsListName', { v0: label }),
        locale
    );

    return (
        <>
            {/* WebPage·BreadcrumbList는 색인되는 렌더에만 낸다 — noindex degrade 렌더에서는
                처리되지 않을 마크업이 크롤 예산만 쓴다. */}
            {!isEmpty && (
                <>
                    <JsonLd
                        data={buildWebPageJsonLd({
                            url: categoryUrl,
                            name: brandTitle(
                                buildCategoryPageTitle(label, tSeo),
                                locale
                            ),
                            description: buildCategoryPageDescription(
                                intro,
                                tSeo
                            ),
                            locale,
                        })}
                    />
                    <JsonLd
                        data={buildBreadcrumbJsonLd(
                            breadcrumbTrail.map(({ name, path }) => ({
                                name,
                                url: `${SITE_URL}${path}`,
                            })),
                            locale
                        )}
                    />
                </>
            )}
            {newsListJsonLd ? <JsonLd data={newsListJsonLd} /> : null}
            <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
                {/*
                    지역 선택기가 먼저, 그 안의 카테고리 선택기가 다음.
                    둘 다 degrade 경로에서도 렌더한다 — 실패한 카테고리가
                    막다른 길이 되지 않도록.
                */}
                <RegionTabs
                    vertical="news"
                    active={cfg.region}
                    currentPath={categoryPath}
                />
                <NewsCategoryTabs activeCategory={cat} />
                <Breadcrumb trail={toVisibleCrumbs(breadcrumbTrail)} />
                <h1 className="text-2xl font-bold tracking-tight text-balance text-secondary-50 sm:text-3xl">
                    {/* `koLabel`(AI 프롬프트용 한국어)이 아니라 로케일 라벨이다. */}
                    {label} {t('page.3a465d')}
                </h1>
                <p className="text-sm text-secondary-400">{intro}</p>
                <Suspense fallback={<DigestSkeleton />}>
                    <MarketNewsDigest
                        category={cat}
                        hasEnrichedNews={items.some(
                            item => item.sentiment !== null
                        )}
                        peekSeed={digestPeekSeed}
                    />
                </Suspense>
                {isEmpty ? (
                    <MarketNewsDegraded label={label} />
                ) : (
                    // 그리지 않는 카드까지 RSC 페이로드로 내보내지 않는다 —
                    // NEWS_ROW_SERIALIZATION_LIMIT 주석 참고.
                    <MarketNewsList
                        category={cat}
                        initialItems={items.slice(
                            0,
                            NEWS_ROW_SERIALIZATION_LIMIT
                        )}
                    />
                )}
            </main>
        </>
    );
}
