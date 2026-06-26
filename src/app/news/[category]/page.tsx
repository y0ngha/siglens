import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import {
    CATEGORY_CONFIG,
    MARKET_NEWS_CACHE_TAG_PREFIX,
    NEWS_CATEGORY_SLUGS,
    categoryFromSlug,
    toMarketNewsCardItem,
    type MarketNewsCardItem,
    type NewsFeedCategory,
} from '@/entities/market-news';
import { getMarketNewsList } from '@/entities/market-news/api';
import { MarketNewsDigest, MarketNewsList } from '@/widgets/market-news';
import { NewsCategoryTabs } from '@/widgets/news-hub';
import { JsonLd } from '@/shared/ui/JsonLd';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { SECONDS_PER_HALF_DAY } from '@/shared/config/time';
import { buildBreadcrumbJsonLd, SITE_NAME, SITE_URL } from '@/shared/lib/seo';
import { buildCategoryPageTitle, buildCategoryPageDescription } from './seo';

// 12h ISR — 신선도는 ensureMarketNewsCardsAnalyzedAction의 on-demand
// revalidateTag('market-news:<sentinel>', 'max')가 보장, 시간 기반은 상한만.
export const revalidate = 43200;

// 빈 배열 = on-demand ISR, generateStaticParams 없으면 dynamic으로 남아 ISR이 걸리지 않는다 — app CLAUDE.md 축 3.
type CategoryPageParams = { category: string };
export function generateStaticParams(): CategoryPageParams[] {
    return NEWS_CATEGORY_SLUGS.map(category => ({ category }));
}

// JSON-LD ItemList: Google 가이드라인상 "주요 항목"만 노출.
const JSON_LD_NEWS_MAX_ITEMS = 10;

interface Props {
    params: Promise<{ category: string }>;
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
 * Projects rows through the shared allowlist (`toMarketNewsCardItem`) so that
 * DB-internal columns (bodyEn, symbol, analyzedAt) are stripped before the
 * items reach any client component or RSC payload serialisation.
 */
async function loadCategorySnapshot(
    category: NewsFeedCategory
): Promise<CategorySnapshot> {
    const cfg = CATEGORY_CONFIG[category];
    // ISR degrade guard: getMarketNewsList(DB)가 throw하면 ISR 캐시에 0-byte 빈 결과가
    // 굳는 것을 막으려면 여기서 흡수해야 한다. [] 로 degrade → isEmpty:true 가 되어
    // 이미 존재하는 MarketNewsDegraded empty-state 분기로 자연스럽게 빠진다.
    const rows = await staticSymbolCache(
        ['market-news:list', cfg.sentinel],
        cfg.sentinel,
        () => getMarketNewsList(cfg.sentinel),
        [`${MARKET_NEWS_CACHE_TAG_PREFIX}:${cfg.sentinel}`],
        SECONDS_PER_HALF_DAY
    ).catch((e: unknown) => {
        console.error(
            `[CategoryNewsPage] loadCategorySnapshot(${category}) failed, degrading to []:`,
            e
        );
        return [] as Awaited<ReturnType<typeof getMarketNewsList>>;
    });
    // Project to the same allowlist `getMarketNewsCardsAction` uses so the
    // client component never sees server-only DB columns (bodyEn/symbol/analyzedAt).
    const items = rows.map(toMarketNewsCardItem);
    return { items, isEmpty: items.length === 0 };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { category: slug } = await params;
    const cat = categoryFromSlug(slug);

    if (!cat) {
        // 잘못된 slug — not-found.tsx가 404와 robots 메타데이터를 담당하므로
        // 여기서 robots/alternates를 중복 설정하지 않는다(이중 robots 태그 방지).
        return {
            title: '뉴스 카테고리를 찾을 수 없어요',
            description: '요청하신 뉴스 카테고리가 존재하지 않아요.',
        };
    }

    const cfg = CATEGORY_CONFIG[cat];
    const { isEmpty } = await loadCategorySnapshot(cat);

    // 데이터 없으면 noindex — 페이지 본문의 degrade 메시지와 일관.
    if (isEmpty) {
        return {
            title: `${cfg.koLabel} 뉴스`,
            description: `${cfg.koLabel} 최신 뉴스를 불러오지 못했어요.`,
            robots: { index: false, follow: false },
            alternates: { canonical: null },
        };
    }

    const canonicalPath = `/news/${cfg.slug}`;
    const title = buildCategoryPageTitle(cfg.koLabel);
    const fullTitle = `${title} | ${SITE_NAME}`;
    const description = buildCategoryPageDescription(cfg.koLabel);
    const keywords = [
        `${cfg.koLabel} 뉴스`,
        `${cfg.koLabel} 최신 뉴스`,
        `${cfg.koLabel} 뉴스 분석`,
        '미국 마켓 뉴스',
        '마켓 뉴스 한국어',
        'AI 뉴스 다이제스트',
    ];

    return {
        title,
        description,
        keywords,
        alternates: {
            canonical: canonicalPath,
        },
        openGraph: {
            type: 'website',
            siteName: SITE_NAME,
            title: fullTitle,
            description,
            url: `${SITE_URL}${canonicalPath}`,
            locale: 'ko_KR',
        },
        twitter: {
            card: 'summary_large_image',
            title: fullTitle,
            description,
        },
    };
}

export default async function CategoryNewsPage({ params }: Props) {
    const { category: slug } = await params;
    const cat = categoryFromSlug(slug);

    if (!cat) {
        notFound();
    }

    const cfg = CATEGORY_CONFIG[cat];
    // TODO(market-news-hub): bot user-agents only see degrade state because
    // ensureMarketNewsCardsAnalyzedAction is client-triggered. Investigate server-side
    // gated trigger or cron warmup to improve crawl signal. See PR #598 Phase B audit.
    const { items, isEmpty } = await loadCategorySnapshot(cat);

    const hasEnrichedNews = items.some(item => item.sentiment !== null);

    const categoryUrl = `${SITE_URL}/news/${cfg.slug}`;

    // Only emit structured data on indexable pages — noindex degrade pages waste
    // crawl budget on schema that won't be processed anyway.
    const webPageJsonLd = !isEmpty
        ? {
              '@context': 'https://schema.org',
              '@type': 'WebPage',
              '@id': `${categoryUrl}#webpage`,
              name: `${buildCategoryPageTitle(cfg.koLabel)} | ${SITE_NAME}`,
              description: buildCategoryPageDescription(cfg.koLabel),
              url: categoryUrl,
              inLanguage: 'ko',
              isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}#website` },
          }
        : null;

    const breadcrumbJsonLd = !isEmpty
        ? buildBreadcrumbJsonLd([
              { name: '마켓 뉴스 허브', url: `${SITE_URL}/news` },
              { name: cfg.koLabel, url: categoryUrl },
          ])
        : null;

    // FMP category news has no per-article image URL, so we use the per-category OG image
    // (already generated by opengraph-image.tsx in this directory) rather than the generic
    // site OG. This gives Google a category-relevant image for Rich Results.
    const CATEGORY_OG_IMAGE_URL = `${SITE_URL}/news/${cfg.slug}/opengraph-image`;
    const newsListJsonLd =
        items.length > 0
            ? {
                  '@context': 'https://schema.org',
                  '@type': 'ItemList',
                  name: `${cfg.koLabel} 최신 뉴스`,
                  itemListElement: items
                      .slice(0, JSON_LD_NEWS_MAX_ITEMS)
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
                              headline: item.titleKo ?? item.titleEn,
                              url: item.url,
                              datePublished: item.publishedAt,
                              image: CATEGORY_OG_IMAGE_URL,
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
                {/* Always rendered even on the degrade path so a failed category is never a dead end. */}
                <NewsCategoryTabs activeCategory={cat} />
                <h1 className="text-secondary-100 text-2xl font-bold tracking-tight text-balance sm:text-3xl">
                    {cfg.koLabel} 뉴스
                </h1>
                <Suspense fallback={<DigestSkeleton />}>
                    <MarketNewsDigest
                        category={cat}
                        hasEnrichedNews={hasEnrichedNews}
                    />
                </Suspense>
                {isEmpty ? (
                    <MarketNewsDegraded koLabel={cfg.koLabel} />
                ) : (
                    <MarketNewsList category={cat} initialItems={items} />
                )}
            </main>
        </>
    );
}

function DigestSkeleton() {
    return (
        <div
            aria-busy="true"
            role="status"
            aria-label="AI 다이제스트 불러오는 중"
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
        >
            <div className="bg-secondary-700 mb-4 h-5 w-1/3 animate-pulse rounded motion-reduce:animate-none" />
            <div className="space-y-2">
                <div className="bg-secondary-700/70 h-3.5 w-full animate-pulse rounded motion-reduce:animate-none" />
                <div className="bg-secondary-700/70 h-3.5 w-2/3 animate-pulse rounded motion-reduce:animate-none" />
            </div>
        </div>
    );
}

interface MarketNewsDegradedProps {
    koLabel: string;
}

function MarketNewsDegraded({ koLabel }: MarketNewsDegradedProps) {
    return (
        <section
            aria-label={`${koLabel} 뉴스 없음`}
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
        >
            <p className="text-secondary-400 text-sm">
                {koLabel} 최근 뉴스를 불러오지 못했어요. 잠시 후 다시 확인해
                주세요.
            </p>
        </section>
    );
}
