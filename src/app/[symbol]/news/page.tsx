import { Suspense, cache } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
    getNewsList,
    getGradeEvents,
    getNextEarningsCalendar,
    getLatestEarningsReport,
} from '@/app/[symbol]/news/newsData';
import { todayKstIsoDate } from '@/infrastructure/utils/dateKey';
import { VALID_TICKER_RE } from '@/domain/constants/market';
import { buildDisplayName } from '@/domain/ticker';
import { getAssetInfoAction } from '@/infrastructure/ticker/getAssetInfoAction';
import { NewsList } from '@/components/news/sections/NewsList';
import { EventCalendar } from '@/components/news/sections/EventCalendar';
import { AnalystActions } from '@/components/news/sections/AnalystActions';
import { NewsAiSummary } from '@/components/news/NewsAiSummary';
import { NewsAiSummarySkeleton } from '@/components/news/NewsAiSummarySkeleton';
import { NewsAiSummaryError } from '@/components/news/NewsAiSummaryError';
import { ErrorBoundary } from 'react-error-boundary';
import { CrossLinkCards } from '@/components/symbol-page/CrossLinkCards';
import { SectionSkeleton } from '@/components/symbol-page/SectionSkeleton';
import { JsonLd } from '@/components/ui/JsonLd';
import {
    buildBreadcrumbJsonLd,
    buildSymbolNewsSeoContent,
    SITE_NAME,
    SITE_URL,
} from '@/lib/seo';
import { waitUntil } from '@vercel/functions';
import { ensureNewsCardsAnalyzedAction } from '@/infrastructure/market/ensureNewsCardsAnalyzedAction';

// React.cache로 generateMetadata와 page body의 중복 fetch를 동일 render pass 안에서 dedupe.
const getAssetInfoCached = cache(getAssetInfoAction);

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
    return <NewsList items={items} />;
}

async function EventCalendarSection({ symbol }: SymbolSectionProps) {
    const today = todayKstIsoDate();
    const [nextEarnings, latestReport] = await Promise.all([
        getNextEarningsCalendar(symbol, today),
        getLatestEarningsReport(symbol),
    ]);
    return (
        <EventCalendar
            nextEarnings={nextEarnings}
            latestReport={latestReport}
        />
    );
}

async function AnalystActionsSection({ symbol }: SymbolSectionProps) {
    const events = await getGradeEvents(symbol);
    return <AnalystActions events={events} />;
}

export default async function NewsPage({ params }: Props) {
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

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: fullTitle,
        description,
        url,
        inLanguage: 'ko',
        about: {
            '@type': 'Corporation',
            name: displayName,
            tickerSymbol: upper,
        },
    };

    const breadcrumbJsonLd = buildBreadcrumbJsonLd([
        { name: upper, url: `/${upper}` },
        { name: '뉴스 분석', url: `/${upper}/news` },
    ]);

    const aiArticleJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: `${displayName} 최근 뉴스 AI 요약`,
        description: `${displayName} 관련 최신 뉴스의 sentiment와 핵심 이슈를 한국어로 정리합니다.`,
        inLanguage: 'ko',
        datePublished: new Date().toISOString(),
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
    const newsListJsonLd =
        newsItems.length > 0
            ? {
                  '@context': 'https://schema.org',
                  '@type': 'ItemList',
                  name: `${displayName} 최신 뉴스`,
                  itemListElement: newsItems
                      .slice(0, 10)
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
            <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
                <h1 className="sr-only">
                    {displayName} 최신 뉴스와 어닝 일정
                </h1>
                <ErrorBoundary FallbackComponent={NewsAiSummaryError}>
                    <Suspense fallback={<NewsAiSummarySkeleton />}>
                        <NewsAiSummary symbol={upper} />
                    </Suspense>
                </ErrorBoundary>

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
