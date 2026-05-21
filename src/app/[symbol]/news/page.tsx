import {
    getEarningsReportComparison,
    getGradeEvents,
    getNewsList,
} from '@/app/[symbol]/news/newsData';
import { NewsAiSummary } from '@/components/news/NewsAiSummary';
import { NewsAiSummaryErrorBoundary } from '@/components/news/NewsAiSummaryErrorBoundary';
import { NewsAiSummarySkeleton } from '@/components/news/NewsAiSummarySkeleton';
import { AnalystActions } from '@/components/news/sections/AnalystActions';
import { EventCalendar } from '@/components/news/sections/EventCalendar';
import { NewsList } from '@/components/news/sections/NewsList';
import { CrossLinkCards } from '@/components/symbol-page/CrossLinkCards';
import { SectionSkeleton } from '@/components/symbol-page/SectionSkeleton';
import { JsonLd } from '@/components/ui/JsonLd';
import { VALID_TICKER_RE } from '@/domain/constants/market';
import { buildDisplayName } from '@/domain/ticker';
import { ensureNewsCardsAnalyzedAction } from '@/infrastructure/market/ensureNewsCardsAnalyzedAction';
import { getAssetInfoCached } from '@/infrastructure/ticker/getAssetInfoCached';
import { todayKstIsoDate } from '@/infrastructure/utils/dateKey';
import {
    buildBreadcrumbJsonLd,
    buildSymbolNewsSeoContent,
    buildSymbolSeoContent,
    SITE_BUILD_DATE,
    SITE_NAME,
    SITE_URL,
} from '@/lib/seo';
import { waitUntil } from '@vercel/functions';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';

// JSON-LD ItemList 최대 노출 — Google ItemList 가이드라인의 "주요 항목"만 노출하라는 권고에 맞춤.
const JSON_LD_NEWS_MAX_ITEMS = 10;

interface Props {
    params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { symbol } = await params;
    const upper = symbol.toUpperCase();
    const assetInfo = await getAssetInfoCached(upper);
    const displayName = assetInfo ? buildDisplayName(assetInfo, upper) : upper;
    const { title, fullTitle, description, url, keywords } =
        buildSymbolNewsSeoContent(upper, {
            displayName,
            koreanName: assetInfo?.koreanName,
        });

    return {
        title,
        description,
        keywords,
        alternates: {
            canonical: url,
        },
        openGraph: {
            type: 'website',
            siteName: SITE_NAME,
            title: fullTitle,
            description,
            url,
            locale: 'ko_KR',
        },
        twitter: {
            card: 'summary_large_image',
            title: fullTitle,
            description,
        },
    };
}

interface SymbolSectionProps {
    symbol: string;
}

async function NewsListSection({ symbol }: SymbolSectionProps) {
    const items = await getNewsList(symbol);
    return <NewsList items={items} symbol={symbol} />;
}

async function EventCalendarSection({ symbol }: SymbolSectionProps) {
    const today = todayKstIsoDate();
    const earningsReports = await getEarningsReportComparison(symbol, today);
    return <EventCalendar earningsReports={earningsReports} />;
}

async function AnalystActionsSection({ symbol }: SymbolSectionProps) {
    const events = await getGradeEvents(symbol);
    return <AnalystActions events={events} />;
}

export default async function NewsPage({ params }: Props) {
    // Cache Components: `new Date().toISOString()` below (for the JSON-LD
    // `dateModified`) reads Date.now(), which requires a prior dynamic-data
    // accessor. `await params` doesn't qualify; opt in explicitly.
    await connection();

    const { symbol } = await params;
    const upper = symbol.toUpperCase();

    if (!VALID_TICKER_RE.test(upper)) {
        notFound();
    }

    const assetInfo = await getAssetInfoCached(upper);
    if (!assetInfo) {
        notFound();
    }

    const displayName = buildDisplayName(assetInfo, upper);
    const { fullTitle, description, url } = buildSymbolNewsSeoContent(upper, {
        displayName,
        koreanName: assetInfo.koreanName,
    });

    // waitUntil keeps the serverless function alive past response completion so the analysis settles without blocking the stream.
    waitUntil(
        ensureNewsCardsAnalyzedAction(upper).catch((error: unknown) => {
            console.error(
                '[NewsPage] ensureNewsCardsAnalyzedAction failed:',
                error
            );
        })
    );

    // `about` block intentionally omitted: hardcoding `@type: 'Corporation'`
    // misrepresents ETF/Index tickers (e.g. SPY, QQQ, SPXUSD). Re-adding it
    // requires an AssetInfo discriminator that distinguishes Stock/ETF/Index.
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: fullTitle,
        description,
        url,
        inLanguage: 'ko',
    };

    const breadcrumbJsonLd = buildBreadcrumbJsonLd([
        { name: upper, url: buildSymbolSeoContent(upper).url },
        { name: '뉴스 분석', url: buildSymbolNewsSeoContent(upper).url },
    ]);

    // datePublished는 페이지(요약 콘텐츠)가 처음 노출되는 빌드 시각으로 고정. 매 요청마다 변동시키면 Googlebot이 매번 "방금 발행"으로 간주.
    // dateModified는 실제 카드 분석이 백그라운드에서 갱신되므로 요청 시각으로 둔다.
    const nowIso = new Date().toISOString();
    const aiArticleJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: `${displayName} 최근 뉴스 AI 요약`,
        description: `${displayName} 관련 최신 뉴스의 호재나 악재 분위기와 핵심 이슈를 한국어로 정리합니다.`,
        inLanguage: 'ko',
        datePublished: SITE_BUILD_DATE.toISOString(),
        dateModified: nowIso,
        isPartOf: { '@type': 'WebPage', url },
        author: {
            '@type': 'Organization',
            name: SITE_NAME,
            url: SITE_URL,
        },
        publisher: {
            '@type': 'Organization',
            name: SITE_NAME,
            url: SITE_URL,
            logo: {
                '@type': 'ImageObject',
                url: `${SITE_URL}/icon512.png`,
            },
        },
    };

    // getNewsList uses `'use cache'`, so this call is deduped against NewsListSection's fetch.
    const newsItems = await getNewsList(upper);
    // At least one AI-enriched card means aggregate analysis can start immediately.
    const hasEnrichedNews = newsItems.some(item => item.sentiment !== null);

    const newsListJsonLd =
        newsItems.length > 0
            ? {
                  '@context': 'https://schema.org',
                  '@type': 'ItemList',
                  name: `${displayName} 최신 뉴스`,
                  itemListElement: newsItems
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
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <JsonLd data={aiArticleJsonLd} />
            {newsListJsonLd ? <JsonLd data={newsListJsonLd} /> : null}
            <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
                <h1 className="sr-only">{displayName} 최신 뉴스와 어닝 일정</h1>
                <NewsAiSummaryErrorBoundary>
                    <Suspense fallback={<NewsAiSummarySkeleton />}>
                        <NewsAiSummary
                            symbol={upper}
                            companyName={assetInfo?.name ?? upper}
                            hasEnrichedNews={hasEnrichedNews}
                        />
                    </Suspense>
                </NewsAiSummaryErrorBoundary>

                <Suspense fallback={<SectionSkeleton />}>
                    <NewsListSection symbol={upper} />
                </Suspense>

                <Suspense fallback={<SectionSkeleton />}>
                    <EventCalendarSection symbol={upper} />
                </Suspense>

                <Suspense fallback={<SectionSkeleton />}>
                    <AnalystActionsSection symbol={upper} />
                </Suspense>

                <CrossLinkCards symbol={upper} current="news" />
            </main>
        </>
    );
}
