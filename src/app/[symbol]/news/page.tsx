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
import { buildAssetAboutNode } from '@/domain/seo/assetClassification';
import { buildDisplayName } from '@/domain/ticker';
import { ensureNewsCardsAnalyzedAction } from '@/infrastructure/market/ensureNewsCardsAnalyzedAction';
import { getTodayIsoDay } from '@/infrastructure/seo/getTodayIsoDay';
import { getAssetInfoCached } from '@/infrastructure/ticker/getAssetInfoCached';
import { todayKstIsoDate } from '@/infrastructure/utils/dateKey';
import {
    buildBreadcrumbJsonLd,
    buildSymbolNewsSeoContent,
    buildSymbolSeoContent,
    SITE_NAME,
    SITE_URL,
} from '@/shared/lib/seo';
import { waitUntil } from '@vercel/functions';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

// JSON-LD ItemList 최대 노출 — Google ItemList 가이드라인의 "주요 항목"만 노출하라는 권고에 맞춤.
const JSON_LD_NEWS_MAX_ITEMS = 10;

interface Props {
    params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { symbol } = await params;
    const upper = symbol.toUpperCase();
    // 본문 notFound()와 일관: 잘못된 ticker는 메타데이터를 비우고 noindex로 응답한다.
    if (!VALID_TICKER_RE.test(upper)) {
        return { robots: { index: false, follow: false } };
    }
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

    // about 노드는 stock으로 분류된 경우만 채워지고, ETF/Index/모호한 종목은
    // undefined로 자연 생략된다 (assetClassification 모듈 doc 참고).
    const aboutNode = buildAssetAboutNode(
        upper,
        assetInfo.koreanName ?? assetInfo.name,
        assetInfo.fmpSymbol
    );
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        name: fullTitle,
        description,
        url,
        inLanguage: 'ko',
        isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}#website` },
        ...(aboutNode && { about: aboutNode }),
    };

    const breadcrumbJsonLd = buildBreadcrumbJsonLd([
        { name: upper, url: buildSymbolSeoContent(upper).url },
        { name: '뉴스 분석', url: buildSymbolNewsSeoContent(upper).url },
    ]);

    // datePublished는 의도적으로 생략한다 — ticker별 최초 뉴스 ingestion 시각
    // fetch 없이는 정확한 datePublished를 알 수 없어 SITE_BUILD_DATE를 쓰면 모든
    // ticker가 동일 시점으로 표기되는 오류 신호가 된다. Article schema에서
    // datePublished는 옵션이라 생략 가능. dateModified는 getTodayIsoDay()로
    // 일 단위 양자화 (rationale은 helper JSDoc 참고).
    const todayIsoDay = getTodayIsoDay();
    const aiArticleJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: `${displayName} 최근 뉴스 AI 요약`,
        description: `${displayName} 최신 뉴스의 호재·악재 분위기와 핵심 이슈를 한국어로 정리합니다.`,
        inLanguage: 'ko',
        dateModified: todayIsoDay,
        isPartOf: { '@type': 'WebPage', '@id': `${url}#webpage` },
        // Article schema는 image를 명시할 때 Rich Results 자격이 강해진다.
        // 정적 og-image.png를 사용해 hashless permanent URL을 보장 — Next.js의
        // file-based opengraph-image route는 빌드 시 `?<hash>` cache-buster를
        // URL에 부여하기 때문에, schema에서 그 URL을 hardcode하면 빌드마다
        // schema image와 OG meta가 불일치하는 회귀가 발생한다. 정적 자원은
        // 영구 URL이라 schema image 신뢰도 측면에서 더 유리.
        image: [`${SITE_URL}/og-image.png`],
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
                <section className="sr-only">
                    <h2>{displayName} 뉴스 분석 개요</h2>
                    <p>
                        {displayName}의 최신 뉴스 분위기, 다음 어닝 일정, 최근
                        실적 보고서, 애널리스트 등급 변경을 한국어로 정리합니다.
                    </p>
                </section>
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
