import type { Metadata } from 'next';
import {
    CATEGORY_CONFIG,
    MARKET_NEWS_CACHE_TAG_PREFIX,
    type NewsFeedCategory,
} from '@/entities/market-news';
import { getMarketNewsList } from '@/entities/market-news/api';
import { CategoryCard, PREVIEW_HEADLINE_LIMIT } from '@/widgets/news-hub';
import { JsonLd } from '@/shared/ui/JsonLd';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import {
    buildBreadcrumbJsonLd,
    clampSeoDescription,
    SITE_NAME,
    SITE_URL,
} from '@/shared/lib/seo';

// 24h ISR — 허브 인덱스는 카테고리 구조가 바뀌지 않는 한 신선도가 낮아도 무방.
// 카드별 헤드라인은 staticSymbolCache(1h TTL)를 통해 최신화됨.
export const revalidate = 86400;

const NEWS_HUB_PATH = '/news';
const NEWS_HUB_TITLE = '미국 마켓 뉴스 허브 — 카테고리별 최신 흐름';
const NEWS_HUB_FULL_TITLE = `${NEWS_HUB_TITLE} | ${SITE_NAME}`;
const NEWS_HUB_DESCRIPTION = clampSeoDescription(
    '미국 일반·주식·암호화폐·외환·마켓 아티클 5개 카테고리의 최신 뉴스를 한국어 AI 요약과 함께 한 곳에서 봐요.'
);

export function generateMetadata(): Metadata {
    const url = `${SITE_URL}${NEWS_HUB_PATH}`;
    return {
        title: NEWS_HUB_TITLE,
        description: NEWS_HUB_DESCRIPTION,
        keywords: [
            '미국 마켓 뉴스',
            '미국 주식 뉴스',
            '암호화폐 뉴스',
            '외환 뉴스',
            '마켓 뉴스 한국어',
            '미국 주식 뉴스 요약',
            'AI 뉴스 다이제스트',
            'Siglens 뉴스',
        ],
        alternates: {
            canonical: NEWS_HUB_PATH,
        },
        openGraph: {
            type: 'website',
            siteName: SITE_NAME,
            title: NEWS_HUB_FULL_TITLE,
            description: NEWS_HUB_DESCRIPTION,
            url,
            locale: 'ko_KR',
        },
        twitter: {
            card: 'summary_large_image',
            title: NEWS_HUB_FULL_TITLE,
            description: NEWS_HUB_DESCRIPTION,
        },
    };
}

/**
 * Fetch the top preview headlines for one category bucket.
 * Uses `staticSymbolCache` (axis 1) to avoid DYNAMIC_SERVER_USAGE from the
 * DB call during ISR cold-gen. Returns Korean titles where available, falls
 * back to English.
 */
async function fetchCategoryPreviews(
    category: NewsFeedCategory
): Promise<string[]> {
    const cfg = CATEGORY_CONFIG[category];
    const rows = await staticSymbolCache(
        ['market-news:list', cfg.sentinel],
        cfg.sentinel,
        () => getMarketNewsList(cfg.sentinel),
        [`${MARKET_NEWS_CACHE_TAG_PREFIX}:${cfg.sentinel}`]
    );
    return rows
        .slice(0, PREVIEW_HEADLINE_LIMIT)
        .map(row => row.titleKo ?? row.titleEn);
}

export default async function NewsHubPage() {
    // safe: CATEGORY_CONFIG is Record<NewsFeedCategory, CategoryConfig>, so Object.keys is exactly the union — TS just widens to string[].
    const categories = Object.keys(CATEGORY_CONFIG) as NewsFeedCategory[];

    const previewsByCategory = await Promise.all(
        categories.map(cat => fetchCategoryPreviews(cat))
    );

    const hubUrl = `${SITE_URL}${NEWS_HUB_PATH}`;

    const webPageJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': `${hubUrl}#webpage`,
        name: NEWS_HUB_FULL_TITLE,
        description: NEWS_HUB_DESCRIPTION,
        url: hubUrl,
        inLanguage: 'ko',
        isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}#website` },
    };

    const breadcrumbJsonLd = buildBreadcrumbJsonLd([
        { name: '마켓 뉴스 허브', url: hubUrl },
    ]);

    return (
        <>
            <JsonLd data={webPageJsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8">
                <h1 className="text-2xl font-bold tracking-tight">
                    마켓 뉴스 허브
                </h1>
                <p className="text-secondary-400 -mt-4 text-sm">
                    미국 일반·주식·암호화폐·외환·마켓 아티클 최신 뉴스를 AI가
                    한국어로 정리해 드려요.
                </p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {categories.map((cat, i) => {
                        const cfg = CATEGORY_CONFIG[cat];
                        return (
                            <CategoryCard
                                key={cat}
                                koLabel={cfg.koLabel}
                                slug={cfg.slug}
                                previewHeadlines={previewsByCategory[i]}
                            />
                        );
                    })}
                </div>
            </main>
        </>
    );
}
