import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
    dehydrate,
    HydrationBoundary,
    QueryClient,
} from '@tanstack/react-query';
import { DEFAULT_TIMEFRAME, isValidTimeframe } from '@/domain/constants/market';
import type { AnalysisResponse } from '@/domain/types';
import { fetchBarsWithIndicators } from '@/infrastructure/market/barsApi';
import { getAssetInfoAction } from '@/infrastructure/ticker/getAssetInfoAction';
import { countSkillFiles } from '@/infrastructure/skills/loader';
import { QUERY_KEYS, QUERY_STALE_TIME_MS } from '@/lib/queryConfig';
import {
    buildBreadcrumbJsonLd,
    buildSymbolDescription,
    buildSymbolKeywords,
    OG_IMAGE_HEIGHT,
    OG_IMAGE_WIDTH,
    SITE_NAME,
    SITE_URL,
} from '@/lib/seo';
import { buildDisplayName } from '@/domain/ticker';
import { SymbolPageClient } from '@/components/symbol-page/SymbolPageClient';
import { JsonLd } from '@/components/ui/JsonLd';

const FALLBACK_ANALYSIS: AnalysisResponse = {
    summary: 'AI 분석을 일시적으로 사용할 수 없습니다.',
    trend: 'neutral',
    indicatorResults: [],
    riskLevel: 'medium',
    keyLevels: { support: [], resistance: [] },
    priceTargets: {
        bullish: { targets: [], condition: '' },
        bearish: { targets: [], condition: '' },
    },
    patternSummaries: [],
    strategyResults: [],
    candlePatterns: [],
    trendlines: [],
};

interface Props {
    params: Promise<{ symbol: string }>;
    searchParams: Promise<{ tf?: string }>;
}

export async function generateMetadata({
    params,
}: Omit<Props, 'searchParams'>): Promise<Metadata> {
    const { symbol } = await params;
    const ticker = symbol.toUpperCase();

    const title = `${ticker} 주가 AI 분석`;
    const fullTitle = `${title} | ${SITE_NAME}`;
    const description = buildSymbolDescription(ticker);
    const url = `${SITE_URL}/${ticker}`;
    const keywords = buildSymbolKeywords(ticker, ticker);

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
            images: [
                {
                    url: '/og-image.png',
                    width: OG_IMAGE_WIDTH,
                    height: OG_IMAGE_HEIGHT,
                    alt: fullTitle,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title: fullTitle,
            description,
            images: ['/og-image.png'],
        },
    };
}

export default async function SymbolPage({ params, searchParams }: Props) {
    const { symbol } = await params;
    const { tf } = await searchParams;
    const initialTimeframe = isValidTimeframe(tf) ? tf : DEFAULT_TIMEFRAME;
    const ticker = symbol.toUpperCase();
    const [assetInfo, skillCounts] = await Promise.all([
        getAssetInfoAction(ticker),
        countSkillFiles(),
    ]);
    if (!assetInfo) return notFound();

    const displayName = buildDisplayName(assetInfo, ticker);

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: `${displayName} 주가 AI 분석 | ${SITE_NAME}`,
        description: buildSymbolDescription(displayName),
        url: `${SITE_URL}/${ticker}`,
        inLanguage: 'ko',
        about: {
            '@type': 'Corporation',
            name: displayName,
            tickerSymbol: ticker,
        },
    };

    const breadcrumbJsonLd = buildBreadcrumbJsonLd([
        {
            name: `${displayName} 주가 AI 분석`,
            url: `${SITE_URL}/${ticker}`,
        },
    ]);

    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: QUERY_STALE_TIME_MS,
            },
        },
    });

    queryClient.setQueryData(QUERY_KEYS.assetInfo(symbol), assetInfo);

    await queryClient.prefetchQuery({
        queryKey: QUERY_KEYS.bars(symbol, initialTimeframe),
        queryFn: () =>
            fetchBarsWithIndicators(
                symbol,
                initialTimeframe,
                assetInfo.fmpSymbol
            ),
    });

    return (
        <>
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <section className="sr-only">
                <h2>{displayName} 기술적 분석</h2>
                <p>
                    {displayName} 주가를 RSI·MACD·볼린저밴드 등{' '}
                    {skillCounts.indicators}종 보조지표로 해석하고, 도지·해머·
                    장악형 같은 주요 캔들 패턴과 차트 패턴을 자동으로
                    감지합니다. 주요 지지·저항 레벨과 매매 전략도 함께 확인할 수
                    있습니다.
                </p>
                <h2>AI와 대화로 분석 결과 확인</h2>
                <p>
                    분석된 차트 데이터를 근거로 AI와 대화할 수 있습니다. 추세
                    판단, 지표 의미, 진입 타이밍 등 궁금한 점을 질문하면{' '}
                    {displayName}의 현재 상황에 맞춰 답변합니다.
                </p>
            </section>
            <HydrationBoundary state={dehydrate(queryClient)}>
                <SymbolPageClient
                    symbol={symbol}
                    initialAnalysis={FALLBACK_ANALYSIS}
                    // SSR 단계에서 AI 분석을 의도적으로 생략하고 클라이언트로 위임한다.
                    // 마운트 시 useAnalysis가 자동으로 재분석을 트리거하도록 true로 설정한다.
                    initialAnalysisFailed={true}
                    indicatorCount={skillCounts.indicators}
                />
            </HydrationBoundary>
        </>
    );
}
