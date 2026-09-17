import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { DEFAULT_LOCALE, isLocale, localePath } from '@/shared/i18n/locales';
import type { Locale } from '@/shared/i18n/locales';
import { localeAlternates, localeOpenGraph } from '@/shared/lib/seoAlternates';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import {
    CATEGORY_CONFIG,
    MARKET_NEWS_CACHE_TAG_PREFIX,
    NEWS_CATEGORY_SLUGS,
    categoryFromSlug,
    type MarketNewsCardItem,
    type CategoryConfig,
    type NewsFeedCategoryId,
} from '@/entities/market-news';
import { getMarketNewsCards } from '@/entities/market-news/api';
import {
    MarketNewsDigest,
    MarketNewsList,
    MARKET_NEWS_LIST_PAGE_SIZE,
    MARKET_NEWS_ROW_SERIALIZATION_LIMIT,
} from '@/widgets/market-news';
import { NewsCategoryTabs } from '@/widgets/news-hub';
import { Breadcrumb } from '@/shared/ui/Breadcrumb';
import { JsonLd } from '@/shared/ui/JsonLd';
import { RegionTabs } from '@/shared/ui/RegionTabs';
import { regionsOf, type NavRegionId } from '@/shared/config/assetClassNav';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { contentLocaleKeyPart } from '@/shared/cache/contentLocaleKeyPart';
import { SECONDS_PER_HALF_DAY } from '@/shared/config/time';
import {
    buildBreadcrumbJsonLd,
    buildWebPageJsonLd,
    SITE_NAME,
    SITE_URL,
} from '@/shared/lib/seo';
import { resolveNewsTitle } from '@/shared/lib/news/resolveNewsTitle';
import { buildCategoryPageTitle, buildCategoryPageDescription } from './seo';

// 12h ISR — 신선도는 ensureMarketNewsCardsAnalyzedAction의 on-demand
// revalidateTag('market-news:<sentinel>', 'max')가 보장, 시간 기반은 상한만.
export const revalidate = 43200;

// 빈 배열 = on-demand ISR, generateStaticParams 없으면 dynamic으로 남아 ISR이 걸리지 않는다 — app CLAUDE.md 축 3.
type CategoryPageParams = { category: string };
export function generateStaticParams(): CategoryPageParams[] {
    return NEWS_CATEGORY_SLUGS.map(category => ({ category }));
}

/**
 * 지역별 추가 SEO 키워드.
 *
 * `미국 마켓 뉴스`는 2026-08 리브랜딩 전 표기다 — 기존 유입 질의를 잃지 않으려고
 * 미국 카테고리에만 남긴다.
 */
const REGION_KEYWORDS: Record<NavRegionId, readonly string[]> = {
    us: ['미국 시장 뉴스', '미국 마켓 뉴스'],
    kr: ['한국 증시 뉴스', '코스피 뉴스', '코스닥 뉴스'],
    crypto: ['암호화폐 뉴스', '비트코인 뉴스'],
};

/**
 * 카테고리 페이지의 breadcrumb 마디 — 허브 → 지역 허브 → 카테고리.
 *
 * 지역에 카테고리가 하나뿐이면(한국·암호화폐) 지역 허브와 카테고리 페이지가
 * 같은 URL이라 2단계로 줄인다. 같은 URL을 두 단계로 넣으면 breadcrumb가
 * 자기 자신을 부모로 갖는다.
 *
 * **마디를 돌려주고 마크업은 만들지 않는다.** 같은 배열이 `BreadcrumbList`
 * JSON-LD와 화면 `<Breadcrumb>` 양쪽을 만든다 — 구글은 둘의 텍스트가 다르면
 * 마크업을 무시하므로 두 벌로 두면 한쪽만 고쳐져 자격을 잃는다.
 */
function categoryBreadcrumbTrail(
    cfg: CategoryConfig,
    categoryPath: string,
    /** `shared.config` 번역자. 이 헬퍼는 순수 함수라 훅을 부를 수 없어 주입받는다. */
    tNav: (key: string) => string
): Array<{ name: string; path: string }> {
    const regionLink = regionsOf('news').find(r => r.region === cfg.region);
    const trail = [{ name: tNav('app.news.page.dc06c4'), path: '/news' }];
    if (regionLink && regionLink.href !== categoryPath) {
        trail.push({
            name: tNav(regionLink.fullLabelKey),
            path: regionLink.href,
        });
    }
    trail.push({ name: tNav(cfg.labelKey), path: categoryPath });
    return trail;
}

interface Props {
    params: Promise<{ locale: string; category: string }>;
}

interface CategorySnapshot {
    items: MarketNewsCardItem[];
    isEmpty: boolean;
}

/**
 * Shared helper: load the category snapshot and determine whether the list is
 * empty. Used by both `generateMetadata` and the page component so noindex
 * and the degrade UI come from a single source (no parity drift).
 *
 * Uses `staticSymbolCache` (axis 1) to avoid DYNAMIC_SERVER_USAGE from the
 * DB call during ISR cold-gen.
 *
 * 읽기(`getMarketNewsCards`) 자체가 카드 투영이라 DB 내부 컬럼(bodyEn, symbol,
 * analyzedAt)은 애초에 SELECT되지 않는다 — 받은 뒤 거르면 Neon 전송과 S3 ISR
 * 블롭에는 그대로 남는다(감사: 비용 라운드 15).
 */
async function loadCategorySnapshot(
    category: NewsFeedCategoryId,
    locale: Locale
): Promise<CategorySnapshot> {
    const cfg = CATEGORY_CONFIG[category];
    // ISR degrade guard: getMarketNewsList(DB)가 throw하면 ISR 캐시에 0-byte 빈 결과가
    // 굳는 것을 막으려면 여기서 흡수해야 한다. [] 로 degrade → isEmpty:true 가 되어
    // 이미 존재하는 MarketNewsDegraded empty-state 분기로 자연스럽게 빠진다.
    const rows = await staticSymbolCache(
        ['market-news:list', cfg.sentinel, ...contentLocaleKeyPart(locale)],
        cfg.sentinel,
        () => getMarketNewsCards(cfg.sentinel, locale),
        [`${MARKET_NEWS_CACHE_TAG_PREFIX}:${cfg.sentinel}`],
        SECONDS_PER_HALF_DAY
    ).catch((e: unknown) => {
        console.error(
            `[CategoryNewsPage] loadCategorySnapshot(${category}) failed, degrading to []:`,
            e
        );
        return [] as Awaited<ReturnType<typeof getMarketNewsCards>>;
    });
    // 읽기 자체가 카드 투영이라 여기서 다시 거를 것이 없다 — 서버 전용 컬럼
    // (bodyEn/symbol/analyzedAt)은 애초에 select되지 않는다.
    return { items: rows, isEmpty: rows.length === 0 };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale: rawLocale, category: slug } = await params;
    const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
    const tSeo = await getTranslations({ locale, namespace: 'shared.seo' });
    // 카테고리 라벨은 이미 네 로케일 카탈로그에 있다(`CATEGORY_CONFIG.labelKey`).
    // `cfg.koLabel`을 번역된 템플릿에 꽂으면 `미국 주식 News`처럼 반쪽만
    // 번역된 문장이 나간다 — 제목·설명·h1·JSON-LD가 전부 그 상태였다.
    const tRoot = await getTranslations({ locale });
    const cat = categoryFromSlug(slug);

    if (!cat) {
        // 잘못된 slug — not-found.tsx가 404와 robots 메타데이터를 담당하므로
        // 여기서 robots/alternates를 중복 설정하지 않는다(이중 robots 태그 방지).
        return {
            title: tSeo('newsCategory.notFoundTitle'),
            description: tSeo('newsCategory.notFoundDescription'),
        };
    }

    const cfg = CATEGORY_CONFIG[cat];
    const { isEmpty } = await loadCategorySnapshot(cat, locale);

    // 데이터 없으면 noindex — 페이지 본문의 degrade 메시지와 일관.
    if (isEmpty) {
        return {
            title: tSeo('newsCategory.emptyTitleTemplate', {
                label: tRoot(cfg.labelKey),
            }),
            description: tSeo('newsCategory.emptyDescriptionTemplate', {
                label: tRoot(cfg.labelKey),
            }),
            // `follow: true` — 헤더가 전 페이지에서 이 URL을 링크한다. 콜드 배포
            // 직후의 빈 상태를 `nofollow`로 두면 사이트 전역에서 링크 주스가 끊기는
            // 막다른 길이 된다. 자매 KR 라우트(`/market/kr` 등)도 전부 follow다.
            robots: { index: false, follow: true },
            alternates: { canonical: null },
        };
    }

    const canonicalPath = `/news/${cfg.slug}`;
    const title = buildCategoryPageTitle(tRoot(cfg.labelKey), tSeo);
    const fullTitle = `${title} | ${SITE_NAME}`;
    const description = buildCategoryPageDescription(tRoot(cfg.labelKey), tSeo);
    const keywords = [
        `${cfg.koLabel} 뉴스`,
        `${cfg.koLabel} 최신 뉴스`,
        `${cfg.koLabel} 뉴스 분석`,
        // 지역 키워드는 그 카테고리가 실제로 속한 지역만 붙인다 — 한국 증시
        // 페이지에 `미국 시장 뉴스`를 넣으면 무관한 질의로 유입돼 이탈만 만든다.
        ...REGION_KEYWORDS[cfg.region],
        '시장 뉴스 한국어',
        'AI 뉴스 다이제스트',
    ];

    return {
        title,
        description,
        keywords,
        // canonical을 넘기지 않는다 — `localeAlternates`가 로케일별 자기참조
        // URL을 만든다. 로케일 무관 경로를 넘기면 `/en/news/…`이 ko를 canonical로
        // 가리켜 hreflang 상호참조가 깨진다.
        alternates: localeAlternates(locale, canonicalPath),
        openGraph: {
            type: 'website',
            siteName: SITE_NAME,
            title: fullTitle,
            description,
            url: `${SITE_URL}${localePath(locale, canonicalPath)}`,
            ...localeOpenGraph(locale),
        },
        twitter: {
            card: 'summary_large_image',
            title: fullTitle,
            description,
        },
    };
}

export default async function CategoryNewsPage({ params }: Props) {
    const { locale, category: slug } = await params;
    // 정적 렌더 활성화. 이 호출이 없으면 next-intl의 서버 API가 `headers()`로
    // 폴백해 **이 라우트의 ISR이 통째로 꺼진다**(빌드 route 표에서 `●` → `ƒ`).
    // 실측으로 확인했다 — Next 16.2는 `next/root-params` 미지원이라 이 경로가 유일하다.
    setRequestLocale(locale);
    // DB 콘텐츠(뉴스 제목·요약) 해석에 쓸 좁혀진 로케일. URL 세그먼트는 신뢰 경계다.
    const resolved = isLocale(locale) ? locale : DEFAULT_LOCALE;
    // 셋은 서로 독립이다.
    const [tNav, t, tSeo] = await Promise.all([
        getTranslations(),
        getTranslations('app.news'),
        getTranslations('shared.seo'),
    ]);
    const cat = categoryFromSlug(slug);

    if (!cat) {
        notFound();
    }

    const cfg = CATEGORY_CONFIG[cat];
    // BLOCKED(D3, PR-D plan): bots only see the digest's CSR loading/degrade
    // state because ensureMarketNewsCardsAnalyzedAction + the digest submit
    // are client-triggered — no SSR seed like /market's peekBriefingStatic or
    // /economy's peekMacroBriefingStatic exists for this widget. Blocked on a
    // siglens-core release: unlike runBriefing/runMacroBriefing, core exposes
    // no `peekMarketNewsDigestCache`, and `buildMarketNewsDigestCacheKey` /
    // the digest's input hash are explicitly `@internal` ("Consumer cannot
    // construct inputHash themselves ... Do not depend on this function from
    // outside the core library" — core's own JSDoc). Reconstructing the cache
    // key in siglens would duplicate core's analysis-cache logic, which the
    // cross-repo scope guard exists to prevent. See PR #598 Phase B audit.
    const { items, isEmpty } = await loadCategorySnapshot(cat, resolved);

    const hasEnrichedNews = items.some(item => item.sentiment !== null);

    const categoryUrl = `${SITE_URL}/news/${cfg.slug}`;

    // Only emit structured data on indexable pages — noindex degrade pages waste
    // crawl budget on schema that won't be processed anyway.
    const webPageJsonLd = !isEmpty
        ? {
              ...buildWebPageJsonLd({
                  url: categoryUrl,
                  name: `${buildCategoryPageTitle(tNav(cfg.labelKey), tSeo)} | ${SITE_NAME}`,
                  description: buildCategoryPageDescription(
                      tNav(cfg.labelKey),
                      tSeo
                  ),
                  locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
              }),
          }
        : null;

    // JSON-LD와 화면 브레드크럼의 단일 소스.
    const breadcrumbTrail = categoryBreadcrumbTrail(
        cfg,
        `/news/${cfg.slug}`,
        tNav
    );
    const breadcrumbJsonLd = !isEmpty
        ? buildBreadcrumbJsonLd(
              breadcrumbTrail.map(({ name, path }) => ({
                  name,
                  url: `${SITE_URL}${path}`,
              })),
              isLocale(locale) ? locale : DEFAULT_LOCALE
          )
        : null;

    const newsListJsonLd =
        items.length > 0
            ? {
                  '@context': 'https://schema.org',
                  '@type': 'ItemList',
                  name: tSeo('faq.newsListName', { v0: cfg.koLabel }),
                  // 초기 DOM에 실제로 그려지는 카드 수와 같은 상수로 자른다 — 근거는
                  // `MARKET_NEWS_LIST_PAGE_SIZE`(shared/config/newsSerialization) 주석.
                  itemListElement: items
                      .slice(0, MARKET_NEWS_LIST_PAGE_SIZE)
                      .map((item, idx) => ({
                          '@type': 'ListItem',
                          position: idx + 1,
                          item: {
                              /*
                               * Article (not NewsArticle): FMP does not provide per-article
                               * dateModified, which NewsArticle's stricter recency requirements
                               * would misrepresent. Article is the correct type here.
                               *
                               * publisher.name = item.source (e.g. "Reuters") because we are
                               * aggregating third-party articles — Siglens is the aggregator,
                               * not the original publisher. No logo is set per-Article since
                               * we don't hold each source's logo asset.
                               */
                              '@type': 'Article',
                              headline: resolveNewsTitle(
                                  item,
                                  isLocale(locale) ? locale : DEFAULT_LOCALE
                              ),
                              url: item.url,
                              datePublished: item.publishedAt,
                              // D5 (M-10): FMP category news carries no per-article image, so
                              // the field is omitted rather than backfilled with the shared
                              // per-category OG image on every article (misrepresents distinct
                              // articles as sharing one image). Add back only when a source
                              // supplies a genuine per-article image URL.
                              author: {
                                  '@type': 'Organization',
                                  name: item.source,
                              },
                              publisher: {
                                  '@type': 'Organization',
                                  name: item.source,
                              },
                          },
                      })),
              }
            : null;

    return (
        <>
            {webPageJsonLd ? <JsonLd data={webPageJsonLd} /> : null}
            {breadcrumbJsonLd ? <JsonLd data={breadcrumbJsonLd} /> : null}
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
                    currentPath={`/news/${cfg.slug}`}
                />
                <NewsCategoryTabs activeCategory={cat} />
                {/* 마지막 마디는 현재 페이지라 링크를 걸지 않는다. */}
                <Breadcrumb
                    trail={breadcrumbTrail.map(({ name, path }, index) => ({
                        label: name,
                        ...(index === breadcrumbTrail.length - 1
                            ? {}
                            : { href: path }),
                    }))}
                />
                <h1 className="text-2xl font-bold tracking-tight text-balance text-secondary-50 sm:text-3xl">
                    {cfg.koLabel} {t('page.3a465d')}
                </h1>
                <p className="text-sm text-secondary-400">
                    {tNav(cfg.descriptionKey)}
                </p>
                <Suspense fallback={<DigestSkeleton />}>
                    <MarketNewsDigest
                        category={cat}
                        hasEnrichedNews={hasEnrichedNews}
                    />
                </Suspense>
                {isEmpty ? (
                    <MarketNewsDegraded koLabel={tNav(cfg.labelKey)} />
                ) : (
                    // 그리지 않는 카드까지 RSC 페이로드로 내보내지 않는다 —
                    // MARKET_NEWS_ROW_SERIALIZATION_LIMIT 주석 참고.
                    <MarketNewsList
                        category={cat}
                        initialItems={items.slice(
                            0,
                            MARKET_NEWS_ROW_SERIALIZATION_LIMIT
                        )}
                    />
                )}
            </main>
        </>
    );
}

function DigestSkeleton() {
    const t = useTranslations('app.news');
    return (
        <div
            aria-busy="true"
            role="status"
            aria-label={t('page.faef4a')}
            className="rounded-lg border border-secondary-700 bg-secondary-800 p-6"
        >
            <div className="mb-4 h-5 w-1/3 animate-pulse rounded bg-secondary-700 motion-reduce:animate-none" />
            <div className="space-y-2">
                <div className="h-3.5 w-full animate-pulse rounded bg-secondary-700/70 motion-reduce:animate-none" />
                <div className="h-3.5 w-2/3 animate-pulse rounded bg-secondary-700/70 motion-reduce:animate-none" />
            </div>
        </div>
    );
}

interface MarketNewsDegradedProps {
    koLabel: string;
}

function MarketNewsDegraded({ koLabel }: MarketNewsDegradedProps) {
    const t = useTranslations('app.news');
    return (
        <section
            aria-label={t('page.newsEmptyAria', { v0: koLabel })}
            className="rounded-lg border border-secondary-700 bg-secondary-800 p-6"
        >
            <p className="text-sm text-secondary-400">
                {t('page.fdb87b', { v0: koLabel })}
            </p>
        </section>
    );
}
