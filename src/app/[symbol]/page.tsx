import type { Metadata } from 'next';
import {
    QueryClient,
    dehydrate,
    HydrationBoundary,
} from '@tanstack/react-query';
import { DEFAULT_TIMEFRAME } from '@/domain/constants/market';
import type { AnalysisResponse } from '@/domain/types';
import { fetchBarsWithIndicators } from '@/infrastructure/market/barsApi';
import { QUERY_KEYS, QUERY_STALE_TIME_MS } from '@/lib/queryConfig';
import { SITE_NAME, SITE_URL } from '@/lib/seo';
import { SymbolPageClient } from '@/components/symbol-page/SymbolPageClient';

const FALLBACK_ANALYSIS: AnalysisResponse = {
    summary: 'AI 분석을 일시적으로 사용할 수 없습니다.',
    trend: 'neutral',
    signals: [],
    skillSignals: [],
    riskLevel: 'medium',
    keyLevels: { support: [], resistance: [] },
    priceTargets: {
        bullish: { targets: [], condition: '' },
        bearish: { targets: [], condition: '' },
    },
    patternSummaries: [],
    skillResults: [],
    candlePatterns: [],
    trendlines: [],
};

interface Props {
    params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { symbol } = await params;
    const ticker = symbol.toUpperCase();
    const title = `${ticker} 기술적 분석`;
    const description = `${ticker} 실시간 차트와 AI 기반 기술적 분석 — 보조지표, 캔들 패턴, 지지/저항 레벨을 한 번에 확인하세요.`;
    const url = `${SITE_URL}/${ticker}`;

    return {
        title,
        description,
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

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: `${ticker} 기술적 분석 | ${SITE_NAME}`,
        description: `${ticker} 실시간 차트와 AI 기반 기술적 분석`,
        url: `${SITE_URL}/${ticker}`,
        about: {
            '@type': 'FinancialProduct',
            name: ticker,
            category: 'Stock',
        },
    };

    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: QUERY_STALE_TIME_MS,
            },
        },
    });

    await queryClient.prefetchQuery({
        queryKey: QUERY_KEYS.bars(symbol, DEFAULT_TIMEFRAME),
        queryFn: () => fetchBarsWithIndicators(symbol, DEFAULT_TIMEFRAME),
    });

    return (
        <>
            <script
                type="application/ld+json"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
