import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import {
    CATEGORY_CONFIG,
    categoryFromSlug,
    toMarketNewsCardItem,
    type MarketNewsCardItem,
    type NewsFeedCategory,
} from '@/entities/market-news';
import { getMarketNewsList } from '@/entities/market-news/api';
import { MarketNewsDigest } from '@/widgets/market-news/MarketNewsDigest';
import { MarketNewsList } from '@/widgets/market-news/MarketNewsList';
import { JsonLd } from '@/shared/ui/JsonLd';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { buildBreadcrumbJsonLd, SITE_NAME, SITE_URL } from '@/shared/lib/seo';
import { buildCategoryPageTitle, buildCategoryPageDescription } from './seo';

// 12h ISR — 신선도는 ensureMarketNewsCardsAnalyzedAction의 on-demand
// revalidateTag('market-news:<sentinel>', 'max')가 보장, 시간 기반은 상한만.
export const revalidate = 43200;

// Pre-builds all 5 category routes at build time (빈 배열 = on-demand ISR,
// generateStaticParams 없으면 dynamic으로 남아 ISR이 걸리지 않는다 — app CLAUDE.md 축 3).
export function generateStaticParams(): { category: string }[] {
    // safe: CATEGORY_CONFIG is Record<NewsFeedCategory, CategoryConfig>, so Object.keys is exactly the union — TS just widens to string[].
    return (Object.keys(CATEGORY_CONFIG) as NewsFeedCategory[]).map(
        category => ({ category })
    );
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
    const rows = await staticSymbolCache(
        ['market-news:list', cfg.sentinel],
        cfg.sentinel,
        () => getMarketNewsList(cfg.sentinel),
        [`market-news:${cfg.sentinel}`]
    );
    // Project to the same allowlist `getMarketNewsCardsAction` uses so the
    // client component never sees server-only DB columns (bodyEn/symbol/analyzedAt).
    const items = rows.map(toMarketNewsCardItem);
    return { items, isEmpty: items.length === 0 };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { category: slug } = await params;
    const cat = categoryFromSlug(slug);

    if (!cat) {
        // 잘못된 slug — noindex, canonical null(루트 layout canonical 상속 방지).
        return {
            title: '뉴스 카테고리를 찾을 수 없어요',
            description: '요청하신 뉴스 카테고리가 존재하지 않아요.',
            robots: { index: false, follow: false },
            alternates: { canonical: null },
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

    // 잘못된 slug — Next.js 404 페이지.
    if (!cat) {
        notFound();
    }

    const cfg = CATEGORY_CONFIG[cat];
    const { items, isEmpty } = await loadCategorySnapshot(cat);

    const hasEnrichedNews = items.some(item => item.sentiment !== null);

    const categoryUrl = `${SITE_URL}/news/${cfg.slug}`;

    const webPageJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': `${categoryUrl}#webpage`,
        name: `${buildCategoryPageTitle(cfg.koLabel)} | ${SITE_NAME}`,
        description: buildCategoryPageDescription(cfg.koLabel),
        url: categoryUrl,
        inLanguage: 'ko',
        isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}#website` },
    };

    const breadcrumbJsonLd = buildBreadcrumbJsonLd([
        { name: '마켓 뉴스 허브', url: `${SITE_URL}/news` },
        { name: cfg.koLabel, url: categoryUrl },
    ]);

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
                              '@type': 'NewsArticle',
                              headline: item.titleKo ?? item.titleEn,
                              url: item.url,
                              datePublished: item.publishedAt,
                          },
                      })),
              }
            : null;

    return (
        <>
            <JsonLd data={webPageJsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            {newsListJsonLd ? <JsonLd data={newsListJsonLd} /> : null}
            <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
                <h1 className="text-2xl font-bold tracking-tight">
                    미국 {cfg.koLabel} 뉴스
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

// ─── Degrade / skeleton sub-components ───────────────────────────────────────

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
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
            role="alert"
        >
            <p className="text-secondary-400 text-sm">
                {koLabel} 최근 뉴스를 불러오지 못했어요. 잠시 후 다시 확인해
                주세요.
            </p>
        </section>
    );
}
