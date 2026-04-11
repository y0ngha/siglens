import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
    QueryClient,
    dehydrate,
    HydrationBoundary,
} from '@tanstack/react-query';
import { DEFAULT_TIMEFRAME } from '@/domain/constants/market';
import type { AnalysisResponse, AssetInfo } from '@/domain/types';
import { fetchBarsWithIndicators } from '@/infrastructure/market/barsApi';
import { getAssetInfoAction } from '@/infrastructure/ticker/getAssetInfoAction';
import { QUERY_KEYS, QUERY_STALE_TIME_MS } from '@/lib/queryConfig';
import { buildSymbolKeywords, SITE_NAME, SITE_URL } from '@/lib/seo';
import { SymbolPageClient } from '@/components/symbol-page/SymbolPageClient';

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
}

function buildDisplayName(assetInfo: AssetInfo, ticker: string): string {
    const namePart = assetInfo.name !== ticker ? assetInfo.name : null;
    if (assetInfo.koreanName && namePart) {
        return `${assetInfo.koreanName}, ${namePart} (${ticker})`;
    }
    if (assetInfo.koreanName) {
        return `${assetInfo.koreanName} (${ticker})`;
    }
    if (namePart) {
        return `${namePart} (${ticker})`;
    }
    return ticker;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { symbol } = await params;
    const ticker = symbol.toUpperCase();
    const assetInfo = await getAssetInfoAction(ticker);
    if (!assetInfo) return notFound();

    const displayName = buildDisplayName(assetInfo, ticker);
    const title = `${displayName} 기술적 분석`;
    const description = `${displayName} 실시간 차트와 AI 기반 기술적 분석 — 보조지표, 캔들 패턴, 지지/저항 레벨을 한 번에 확인하세요.`;
    const url = `${SITE_URL}/${ticker}`;
    const keywords = buildSymbolKeywords(
        ticker,
        displayName,
        assetInfo.koreanName
    );

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
            title: `${title} | ${SITE_NAME}`,
            description,
            url,
            locale: 'ko_KR',
        },
        twitter: {
            card: 'summary_large_image',
            title: `${title} | ${SITE_NAME}`,
            description,
        },
    };
}

export default async function SymbolPage({ params }: Props) {
    const { symbol } = await params;
    const ticker = symbol.toUpperCase();
    const assetInfo = await getAssetInfoAction(ticker);
    if (!assetInfo) return notFound();

    const displayName = buildDisplayName(assetInfo, ticker);

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: `${displayName} 기술적 분석 | ${SITE_NAME}`,
        description: `${displayName} 실시간 차트와 AI 기반 기술적 분석 — 보조지표, 캔들 패턴, 지지/저항 레벨을 한 번에 확인하세요.`,
        url: `${SITE_URL}/${ticker}`,
        inLanguage: 'ko',
        about: {
            '@type': 'FinancialProduct',
            name: displayName,
            identifier: ticker,
            category: 'Stock',
        },
    };

    const breadcrumbJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            {
                '@type': 'ListItem',
                position: 1,
                name: SITE_NAME,
                item: SITE_URL,
            },
            {
                '@type': 'ListItem',
                position: 2,
                name: `${displayName} 기술적 분석`,
                item: `${SITE_URL}/${ticker}`,
            },
        ],
    };

    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: QUERY_STALE_TIME_MS,
            },
        },
    });

    queryClient.setQueryData(QUERY_KEYS.assetInfo(symbol), assetInfo);

    await queryClient.prefetchQuery({
        queryKey: QUERY_KEYS.bars(symbol, DEFAULT_TIMEFRAME),
        queryFn: () => fetchBarsWithIndicators(symbol, DEFAULT_TIMEFRAME),
    });

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
                }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(breadcrumbJsonLd).replace(
                        /</g,
                        '\\u003c'
                    ),
                }}
            />
            <HydrationBoundary state={dehydrate(queryClient)}>
                <SymbolPageClient
                    symbol={symbol}
                    initialAnalysis={FALLBACK_ANALYSIS}
                    // SSR 단계에서 AI 분석을 의도적으로 생략하고 클라이언트로 위임한다.
                    // 마운트 시 useAnalysis가 자동으로 재분석을 트리거하도록 true로 설정한다.
                    initialAnalysisFailed={true}
                />
            </HydrationBoundary>
        </>
    );
}
