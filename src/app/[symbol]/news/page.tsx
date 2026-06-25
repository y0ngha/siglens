import {
    getEarningsReportComparison,
    getGradeEvents,
} from '@/app/[symbol]/news/newsData';
import { getNewsList } from '@/entities/news-article/api';
import { NEWS_LIST_CACHE_KEY } from '@/entities/news-article';
import { NewsAiSummary } from '@/widgets/news/NewsAiSummary';
import { NewsAiSummaryErrorBoundary } from '@/widgets/news/NewsAiSummaryErrorBoundary';
import { NewsAiSummarySkeleton } from '@/widgets/news/NewsAiSummarySkeleton';
import { AnalystActions } from '@/widgets/news/sections/AnalystActions';
import { EventCalendar } from '@/widgets/news/sections/EventCalendar';
import { NewsList } from '@/widgets/news/sections/NewsList';
import { SymbolPageHeading } from '@/views/symbol';
import { CrossLinkCards } from '@/shared/ui/CrossLinkCards';
import { SectionSkeleton } from '@/views/symbol/SectionSkeleton';
import { JsonLd } from '@/shared/ui/JsonLd';
import {
    SymbolRouteParams,
    isAdmissibleSymbolShape,
} from '@/shared/config/market';
import { isUnresolvableDegraded } from '@/shared/lib/symbolGuard';
import {
    buildAssetAboutNode,
    buildDisplayName,
    getAssetInfoResilient,
} from '@/entities/ticker';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { SECONDS_PER_HALF_DAY } from '@/shared/config/time';
import { getTodayIsoDay } from '@/shared/lib/getTodayIsoDay';
import { todayKstIsoDate } from '@/shared/lib/dateKey';
import { getFmpUserFacingMessage } from '@/shared/api/fmp/fmpUserMessage';
import {
    buildBreadcrumbJsonLd,
    buildSymbolSeoContent,
    buildSymbolWebPageJsonLd,
    resolveSymbolNewsSeoContent,
    symbolMetadataFromSeo,
    NOINDEX_SYMBOL_METADATA,
    SITE_NAME,
    SITE_URL,
} from '@/shared/lib/seo';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getDescriptor, marketProfileOf } from '@/shared/config/marketProfile';

export const revalidate = 43200; // 12h — 신선도는 ensureNewsCardsAnalyzedAction의 on-demand revalidateTag('news:${symbol}', 'max')가 보장, 시간 기반은 상한만

// generateStaticParams가 없으면 동적 라우트는 매 요청 동적 렌더돼 revalidate가
// 무력화된다(Next.js). 빈 배열 = 빌드 시 prebuild 없이, 첫 요청에 렌더+캐시 후
// revalidate 주기로 재생성하는 on-demand ISR. (cacheComponents 비활성이라 빈 배열 허용)
export async function generateStaticParams(): Promise<SymbolRouteParams[]> {
    return [];
}

// JSON-LD ItemList 최대 노출 — Google ItemList 가이드라인의 "주요 항목"만 노출하라는 권고에 맞춤.
const JSON_LD_NEWS_MAX_ITEMS = 10;

interface Props {
    params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { symbol } = await params;
    const upper = symbol.toUpperCase();
    // 본문 notFound()와 일관: 잘못된 ticker는 메타데이터를 비우고 noindex로 응답한다.
    if (!isAdmissibleSymbolShape(upper)) {
        return NOINDEX_SYMBOL_METADATA;
    }
    const { assetInfo, degraded } = await getAssetInfoResilient(upper);
    if (degraded) {
        return NOINDEX_SYMBOL_METADATA;
    }
    // 본문 `if (!assetInfo) notFound()`와 일관: 실재하지 않는 ticker(assetInfo: null,
    // degraded: false)는 메타데이터도 noindex로 맞춘다. 가드가 없으면 본문 not-found(noindex)와
    // 메타데이터 index가 충돌하는 soft-404가 만들어진다.
    if (!assetInfo) {
        return NOINDEX_SYMBOL_METADATA;
    }
    const displayName = buildDisplayName(assetInfo, upper);
    const assetClass = getDescriptor(marketProfileOf(assetInfo)).assetClass;
    const seo = resolveSymbolNewsSeoContent(upper, assetClass, {
        displayName,
        koreanName: assetInfo.koreanName,
    });
    return symbolMetadataFromSeo(seo);
}

interface SymbolSectionProps {
    symbol: string;
}

async function NewsListSection({ symbol }: SymbolSectionProps) {
    const items = await staticSymbolCache(
        [NEWS_LIST_CACHE_KEY, symbol],
        symbol,
        () => getNewsList(symbol),
        [`news:${symbol}`],
        SECONDS_PER_HALF_DAY
    );
    return <NewsList items={items} symbol={symbol} />;
}

async function EventCalendarSection({ symbol }: SymbolSectionProps) {
    const today = todayKstIsoDate();
    let earningsReports: Awaited<
        ReturnType<typeof getEarningsReportComparison>
    >;
    try {
        earningsReports = await staticSymbolCache(
            ['news:earnings', symbol, today],
            symbol,
            () => getEarningsReportComparison(symbol, today),
            [`news:${symbol}`],
            SECONDS_PER_HALF_DAY
        );
    } catch (error) {
        const message = getFmpUserFacingMessage(error);
        if (message === null) throw error;
        return <NewsDataServerAlert title="실적 일정" message={message} />;
    }
    return <EventCalendar earningsReports={earningsReports} />;
}

async function AnalystActionsSection({ symbol }: SymbolSectionProps) {
    let events: Awaited<ReturnType<typeof getGradeEvents>>;
    try {
        events = await staticSymbolCache(
            ['news:grades', symbol],
            symbol,
            () => getGradeEvents(symbol),
            [`news:${symbol}`],
            SECONDS_PER_HALF_DAY
        );
    } catch (error) {
        const message = getFmpUserFacingMessage(error);
        if (message === null) throw error;
        return (
            <NewsDataServerAlert
                title="애널리스트 등급 변경"
                message={message}
            />
        );
    }
    return <AnalystActions events={events} />;
}

interface NewsDataServerAlertProps {
    title: string;
    message: string;
}

function NewsDataServerAlert({ title, message }: NewsDataServerAlertProps) {
    return (
        <section
            className="border-ui-danger/30 bg-secondary-800 rounded-xl border p-6"
            role="alert"
        >
            <h2 className="mb-2 text-lg font-semibold tracking-tight">
                {title}
            </h2>
            <p className="text-ui-danger text-sm">{message}</p>
        </section>
    );
}

export default async function NewsPage({ params }: Props) {
    const { symbol } = await params;
    const upper = symbol.toUpperCase();

    if (!isAdmissibleSymbolShape(upper)) {
        notFound();
    }

    const { assetInfo, degraded } = await getAssetInfoResilient(upper);
    // degraded + digit-first 심볼 = 두 데이터 소스가 동시 다운 중이고 resolve 불가
    // → 차트 페이지와 동일한 notFound 처리로 sibling 일관성 유지.
    if (isUnresolvableDegraded(upper, degraded)) notFound();
    if (!assetInfo) {
        notFound();
    }

    const displayName = buildDisplayName(assetInfo, upper);
    const marketProfile = marketProfileOf(assetInfo);
    const assetClass = getDescriptor(marketProfile).assetClass;
    const isEquity = assetClass === 'equity';
    const { fullTitle, description, url } = resolveSymbolNewsSeoContent(
        upper,
        assetClass,
        {
            displayName,
            koreanName: assetInfo.koreanName,
        }
    );

    // about 노드는 stock으로 분류된 경우만 채워지고, ETF/Index/모호한 종목과 crypto는
    // undefined로 자연 생략된다. crypto는 schema.org 표준 타입이 없어 about 노드 자체를 두지 않는다.
    const aboutNode = buildAssetAboutNode(
        upper,
        assetInfo.koreanName ?? assetInfo.name,
        assetInfo.fmpSymbol,
        assetClass
    );
    const jsonLd = buildSymbolWebPageJsonLd({
        url,
        name: fullTitle,
        description,
        about: aboutNode,
    });

    const breadcrumbJsonLd = buildBreadcrumbJsonLd([
        { name: upper, url: buildSymbolSeoContent(upper).url },
        { name: '뉴스 분석', url },
    ]);

    // datePublished는 의도적으로 생략한다 — ticker별 최초 뉴스 ingestion 시각
    // fetch 없이는 정확한 datePublished를 알 수 없어 SITE_BUILD_DATE를 쓰면 모든
    // ticker가 동일 시점으로 표기되는 오류 신호가 된다. Article schema에서
    // datePublished는 옵션이라 생략 가능. dateModified는 getTodayIsoDay()로
    // 일 단위 양자화 (rationale은 helper JSDoc 참고).
    const todayIsoDay = getTodayIsoDay();
    // headline/description은 자산 유형별로 분기한다 — 크립토 페이지에 주식 특유의
    // "어닝·실적·애널리스트" 문구가 등장하면 실제로 없는 콘텐츠를 약속하는 허위 신호가 된다.
    const aiArticleJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: isEquity
            ? `${displayName} 최근 뉴스 AI 요약`
            : `${displayName} 최근 코인 뉴스 AI 요약`,
        description: isEquity
            ? `${displayName} 최신 뉴스의 호재·악재 분위기와 핵심 이슈를 한국어로 정리합니다.`
            : `${displayName} 최신 크립토 뉴스의 호재·악재 분위기와 시장 이슈를 한국어로 정리합니다.`,
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

    const newsItems = await staticSymbolCache(
        [NEWS_LIST_CACHE_KEY, upper],
        upper,
        () => getNewsList(upper),
        [`news:${upper}`],
        SECONDS_PER_HALF_DAY
    );
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
                <SymbolPageHeading>
                    {isEquity
                        ? `${displayName} 최신 뉴스와 어닝 일정`
                        : `${displayName} 최신 코인 뉴스`}
                </SymbolPageHeading>
                <section className="sr-only">
                    <h2>{displayName} 뉴스 분석 개요</h2>
                    <p>
                        {isEquity
                            ? `${displayName}의 최신 뉴스 분위기, 다음 어닝 일정, 최근 실적 보고서, 애널리스트 등급 변경을 한국어로 정리합니다.`
                            : `${displayName}의 최신 뉴스 분위기와 핵심 이슈를 한국어로 정리합니다.`}
                    </p>
                </section>
                <NewsAiSummaryErrorBoundary>
                    <Suspense fallback={<NewsAiSummarySkeleton />}>
                        <NewsAiSummary
                            symbol={upper}
                            companyName={assetInfo.name}
                            hasEnrichedNews={hasEnrichedNews}
                        />
                    </Suspense>
                </NewsAiSummaryErrorBoundary>

                <Suspense fallback={<SectionSkeleton />}>
                    <NewsListSection symbol={upper} />
                </Suspense>

                {isEquity && (
                    <Suspense fallback={<SectionSkeleton />}>
                        <EventCalendarSection symbol={upper} />
                    </Suspense>
                )}

                {isEquity && (
                    <Suspense fallback={<SectionSkeleton />}>
                        <AnalystActionsSection symbol={upper} />
                    </Suspense>
                )}

                <CrossLinkCards
                    symbol={upper}
                    current="news"
                    marketProfile={marketProfile}
                />
            </main>
        </>
    );
}
