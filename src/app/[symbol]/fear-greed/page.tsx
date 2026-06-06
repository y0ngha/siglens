import { FearGreedPage } from '@/widgets/fear-greed/FearGreedPage';
import { ErrorBoundary } from 'react-error-boundary';
import { FearGreedPageError } from '@/widgets/fear-greed';
import { CrossLinkCards, SymbolPageHeading } from '@/widgets/symbol-page';
import { JsonLd } from '@/shared/ui/JsonLd';
import {
    DEFAULT_TIMEFRAME,
    SymbolRouteParams,
    VALID_TICKER_RE,
} from '@/shared/config/market';
import {
    buildAssetAboutNode,
    buildDisplayName,
    getAssetInfoResilient,
} from '@/entities/ticker';
import { getBarsStatic } from '@/entities/bars';
import { QUERY_KEYS, QUERY_STALE_TIME_MS } from '@/shared/config/queryConfig';
import {
    buildBreadcrumbJsonLd,
    buildSymbolFearGreedSeoContent,
    buildSymbolSeoContent,
    NOINDEX_SYMBOL_METADATA,
    SITE_NAME,
    SITE_URL,
} from '@/shared/lib/seo';
import {
    dehydrate,
    HydrationBoundary,
    QueryClient,
} from '@tanstack/react-query';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

// 종목당 SEO 콘텐츠는 고정이고 동적 데이터는 클라가 재hydrate한다. 엣지 캐시로
// compute 호출을 줄인다. (일시 인프라 장애의 404 캐싱은 getAssetInfo strict로 차단)
export const revalidate = 86400; // 24h — SSR은 정적 가이드뿐(점수는 클라가 bars로 계산)

// generateStaticParams가 없으면 동적 라우트는 매 요청 동적 렌더돼 revalidate가
// 무력화된다(Next.js). 빈 배열 = 빌드 시 prebuild 없이, 첫 요청에 렌더+캐시 후
// revalidate 주기로 재생성하는 on-demand ISR. (cacheComponents 비활성이라 빈 배열 허용)
export async function generateStaticParams(): Promise<SymbolRouteParams[]> {
    return [];
}

interface Props {
    params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { symbol } = await params;
    const ticker = symbol.toUpperCase();
    // 본문 notFound()와 일관: 잘못된 ticker는 메타데이터를 비우고 noindex로 응답한다.
    if (!VALID_TICKER_RE.test(ticker)) {
        return NOINDEX_SYMBOL_METADATA;
    }
    const { assetInfo, degraded } = await getAssetInfoResilient(ticker);
    if (degraded) {
        return NOINDEX_SYMBOL_METADATA;
    }
    // 본문 `if (!assetInfo) notFound()`와 일관: 실재하지 않는 ticker(assetInfo: null,
    // degraded: false)는 메타데이터도 noindex로 맞춘다. 가드가 없으면 본문 not-found(noindex)와
    // 메타데이터 index가 충돌하는 soft-404가 만들어진다.
    if (!assetInfo) {
        return NOINDEX_SYMBOL_METADATA;
    }
    const displayName = buildDisplayName(assetInfo, ticker);
    const { title, fullTitle, description, url, keywords } =
        buildSymbolFearGreedSeoContent(ticker, {
            displayName,
            koreanName: assetInfo.koreanName,
        });
    return {
        title,
        description,
        keywords,
        alternates: { canonical: url },
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

export default async function SymbolFearGreedPage({ params }: Props) {
    const { symbol } = await params;
    const ticker = symbol.toUpperCase();

    if (!VALID_TICKER_RE.test(ticker)) {
        notFound();
    }

    const { assetInfo } = await getAssetInfoResilient(ticker);
    if (!assetInfo) {
        notFound();
    }

    const displayName = buildDisplayName(assetInfo, ticker);

    const { fullTitle, description, url } = buildSymbolFearGreedSeoContent(
        ticker,
        {
            displayName,
            koreanName: assetInfo.koreanName,
        }
    );

    // about 노드는 stock으로 분류된 경우만 채워지고, ETF/Index/모호한 종목은
    // undefined로 자연 생략된다 (assetClassification 모듈 doc 참고).
    const aboutNode = buildAssetAboutNode(
        ticker,
        assetInfo.koreanName ?? assetInfo.name,
        assetInfo.fmpSymbol
    );
    const webPageJsonLd = {
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
        { name: ticker, url: buildSymbolSeoContent(ticker).url },
        { name: '공포 탐욕 지수', url },
    ]);

    const faqJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
            {
                '@type': 'Question',
                name: `${displayName} 공포 탐욕 지수는 무엇을 측정하나요?`,
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: `${displayName} 한 종목의 단기 매매 심리를 0~100 점수로 측정합니다. CNN의 시장 전체 Fear & Greed Index와 달리 종목별 자체 분포(self-normalization)로 산출하므로, 다른 종목과 점수를 직접 비교하기보다는 같은 종목의 시간 흐름 변화를 보는 데 적합합니다.`,
                },
            },
            {
                '@type': 'Question',
                name: '점수는 어떤 5가지 요인으로 계산되나요?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Volume z-score, Buy/Sell volume 불균형, Volume Profile POC 거리, MA200 이격, 52주 최고가 대비 위치 — 5개 factor 각각을 200영업일 분포 안에서 percentile로 환산한 뒤 가중 평균합니다. 각 factor가 Flow 그룹과 Trend 그룹으로 묶여 별도 점수로도 표시됩니다.',
                },
            },
            {
                '@type': 'Question',
                name: '5단계 분위기 라벨은 어떻게 구분되나요?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    // FAQ JSON-LD는 경계값 상수 변경에 따른 schema 회귀를 막기 위해
                    // 구체 숫자(0~25, 25~45 등) 대신 질적 표현으로만 정리한다.
                    // 실제 경계값은 페이지 본문 가이드(공포 탐욕 지수 가이드 섹션)에서 노출.
                    text: '극심한 공포부터 극심한 탐욕까지 5단계(극심한 공포 · 공포 · 중립 · 탐욕 · 극심한 탐욕)로 구분됩니다. 표본 수가 60일 미만이면 신뢰도 "제한"으로 표시되며, 라벨은 데이터가 더 쌓인 뒤 다시 확인하는 게 안전합니다.',
                },
            },
        ],
    };

    const queryClient = new QueryClient({
        defaultOptions: { queries: { staleTime: QUERY_STALE_TIME_MS } },
    });
    queryClient.setQueryData(QUERY_KEYS.assetInfo(symbol), assetInfo);
    await queryClient.prefetchQuery({
        queryKey: QUERY_KEYS.bars(
            symbol,
            DEFAULT_TIMEFRAME,
            assetInfo.fmpSymbol
        ),
        queryFn: () =>
            getBarsStatic(symbol, DEFAULT_TIMEFRAME, assetInfo.fmpSymbol),
    });

    return (
        <>
            <JsonLd data={webPageJsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <JsonLd data={faqJsonLd} />
            <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
                <SymbolPageHeading>
                    {displayName} 공포 탐욕 지수와 단기 매수 분위기
                </SymbolPageHeading>
                <section className="sr-only">
                    <h2>{displayName} 공포 탐욕 지수 개요</h2>
                    <p>
                        {displayName}의 단기 매수 분위기를 0~100 점수와 5단계(극
                        공포 / 공포 / 중립 / 탐욕 / 극탐욕)로 표시합니다. 거래량
                        흐름과 가격 위치를 종목 자체 분포 안에서 환산해
                        산출합니다.
                    </p>
                </section>
                <section
                    aria-labelledby="fear-greed-guide-heading"
                    className="border-secondary-800 bg-secondary-800/30 space-y-3 rounded-lg border p-5"
                >
                    <h2
                        id="fear-greed-guide-heading"
                        className="text-secondary-300 text-base font-semibold"
                    >
                        {displayName} 공포 탐욕 지수는 어떻게 봐야 할까
                    </h2>
                    <p className="text-secondary-400 text-sm leading-relaxed">
                        {displayName} 한 종목의 단기 매매 심리를 0~100 점수로
                        나타냅니다. CNN의 시장 전체 Fear &amp; Greed Index가
                        여러 자산을 합쳐 시장 감정을 보여 준다면, 이 페이지는 한
                        종목의 거래량 흐름과 체결 흐름, 가격 위치를 그 종목의
                        자체 분포 안에서 환산해 점수로 만듭니다.
                    </p>
                    <p className="text-secondary-400 text-sm leading-relaxed">
                        Volume z-score, Buy/Sell volume 불균형, Volume Profile
                        POC 거리, MA200 이격, 52주 최고가 대비 위치 — 5개
                        factor를 200 영업일 분포 안에서 percentile로 환산한 뒤
                        가중 평균합니다. Flow 그룹과 Trend 그룹으로 나뉘어 어느
                        축이 점수를 끌고 있는지도 같이 볼 수 있습니다.
                    </p>
                    <p className="text-secondary-400 text-sm leading-relaxed">
                        종목별 자체 분포로 산출하므로 다른 종목과 점수를 직접
                        비교하기보다는, 같은 종목의 시간 흐름 변화를 추적하는 데
                        적합합니다. 표본이 60일 미만일 때는 신뢰도
                        &ldquo;제한&rdquo; 배지가 붙으니 참고만 하는 게
                        안전합니다.
                    </p>
                </section>
                <HydrationBoundary state={dehydrate(queryClient)}>
                    <ErrorBoundary FallbackComponent={FearGreedPageError}>
                        <FearGreedPage
                            symbol={ticker}
                            fmpSymbol={assetInfo.fmpSymbol}
                        />
                    </ErrorBoundary>
                </HydrationBoundary>
                <CrossLinkCards symbol={ticker} current="fear-greed" />
            </main>
        </>
    );
}
