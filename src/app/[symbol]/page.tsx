import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
    QueryClient,
    dehydrate,
    HydrationBoundary,
} from '@tanstack/react-query';
import {
    DEFAULT_TIMEFRAME,
    isValidTimeframe,
} from '@/domain/constants/market';
import type { AnalysisResponse, AssetInfo } from '@/domain/types';
import { fetchBarsWithIndicators } from '@/infrastructure/market/barsApi';
import { getAssetInfoAction } from '@/infrastructure/ticker/getAssetInfoAction';
import { countSkillFiles } from '@/infrastructure/skills/loader';
import { QUERY_KEYS, QUERY_STALE_TIME_MS } from '@/lib/queryConfig';
import { buildSymbolKeywords, SITE_NAME, SITE_URL } from '@/lib/seo';
import { SymbolPageClient } from '@/components/symbol-page/SymbolPageClient';

const INDICATOR_NAMES =
    'RSI(상대강도지수), MACD(이동평균수렴확산), 볼린저밴드, 단순이동평균(SMA), 지수이동평균(EMA), 스토캐스틱, ATR(평균진폭), OBV(거래량균형지수), CCI(상품채널지수), 파라볼릭SAR, 슈퍼트렌드, 켈트너채널, VWAP(거래량가중평균가격)';

const CANDLESTICK_NAMES =
    '도지(Doji), 해머(Hammer), 역망치(Inverted Hammer), 교수형(Hanging Man), 유성형(Shooting Star), 불리시 인겔핑(Bullish Engulfing), 베어리시 인겔핑(Bearish Engulfing)';

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

export async function generateMetadata({
    params,
}: Omit<Props, 'searchParams'>): Promise<Metadata> {
    const { symbol } = await params;
    const ticker = symbol.toUpperCase();
    const assetInfo = await getAssetInfoAction(ticker);
    if (!assetInfo) return notFound();

    const displayName = buildDisplayName(assetInfo, ticker);
    const title = `${displayName} 기술적 분석`;
    const description = `${displayName} 실시간 주가 차트와 AI 분석. RSI, MACD, 볼린저밴드 등 보조지표 시그널과 캔들 패턴, 지지·저항 레벨을 자동으로 해석합니다. 무료로 바로 확인하세요.`;
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
        name: `${displayName} 기술적 분석 | ${SITE_NAME}`,
        description: `${displayName} 실시간 주가 차트와 AI 분석. RSI, MACD, 볼린저밴드 등 보조지표 시그널과 캔들 패턴, 지지·저항 레벨을 자동으로 해석합니다. 무료로 바로 확인하세요.`,
        url: `${SITE_URL}/${ticker}`,
        inLanguage: 'ko',
        about: {
            '@type': 'Corporation',
            name: displayName,
            tickerSymbol: ticker,
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
        queryKey: QUERY_KEYS.bars(symbol, initialTimeframe),
        queryFn: () => fetchBarsWithIndicators(symbol, initialTimeframe),
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
            <section className="sr-only" aria-hidden={'true'}>
                <p>{displayName} AI 기술적 분석 — 보조지표 및 캔들 패턴</p>
                <p>
                    {displayName}({ticker}) 종목의 실시간 차트를{' '}
                    {skillCounts.indicators}종 보조지표로 자동 분석합니다.{' '}
                    {INDICATOR_NAMES} 등 {skillCounts.indicators}종 지표를
                    분석합니다.
                </p>
                <p>
                    {skillCounts.candlesticks}종 캔들 패턴 분석:{' '}
                    {CANDLESTICK_NAMES} 등 주요 캔들 패턴을 자동 감지합니다.
                </p>
                <p>
                    {skillCounts.patterns}종 차트 패턴, {skillCounts.strategies}
                    종 전략 분석, {skillCounts.supportResistance}종 지지/저항
                    레벨 분석을 제공합니다.
                </p>
            </section>
            <HydrationBoundary state={dehydrate(queryClient)}>
                <SymbolPageClient
                    symbol={symbol}
                    initialTimeframe={initialTimeframe}
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
