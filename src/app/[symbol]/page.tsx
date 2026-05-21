import { OptionsSignalCards } from '@/components/symbol-page/cards/OptionsSignalCards';
import { SymbolPageClient } from '@/components/symbol-page/SymbolPageClient';
import { JsonLd } from '@/components/ui/JsonLd';
import { FALLBACK_ANALYSIS } from '@/domain/chat/fallbackAnalysis';
import { DEFAULT_TIMEFRAME, isValidTimeframe } from '@/domain/constants/market';
import { buildDisplayName } from '@/domain/ticker';
import { getBarsAction } from '@/infrastructure/market/getBarsAction';
import { countSkillFiles } from '@/infrastructure/skills/loader';
import { getAssetInfoCached } from '@/infrastructure/ticker/getAssetInfoCached';
import { QUERY_KEYS, QUERY_STALE_TIME_MS } from '@/lib/queryConfig';
import {
    buildBreadcrumbJsonLd,
    buildSymbolSeoContent,
    SITE_NAME,
} from '@/lib/seo';
import {
    dehydrate,
    HydrationBoundary,
    QueryClient,
} from '@tanstack/react-query';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

interface Props {
    params: Promise<{ symbol: string }>;
    searchParams: Promise<{ tf?: string }>;
}

export async function generateMetadata({
    params,
    searchParams,
}: Props): Promise<Metadata> {
    const { symbol } = await params;
    const { tf } = await searchParams;
    const ticker = symbol.toUpperCase();
    const assetInfo = await getAssetInfoCached(ticker);
    const displayName = assetInfo
        ? buildDisplayName(assetInfo, ticker)
        : ticker;
    const { title, fullTitle, description, url, keywords } =
        buildSymbolSeoContent(ticker, {
            displayName,
            koreanName: assetInfo?.koreanName,
        });

    const hasTfVariant = tf !== undefined;

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
        ...(hasTfVariant && {
            robots: { index: false, follow: true },
        }),
    };
}

export default async function SymbolPage({ params, searchParams }: Props) {
    const { symbol } = await params;
    const { tf } = await searchParams;
    const initialTimeframe = isValidTimeframe(tf) ? tf : DEFAULT_TIMEFRAME;
    const ticker = symbol.toUpperCase();
    const [assetInfo, skillCounts] = await Promise.all([
        getAssetInfoCached(ticker),
        countSkillFiles(),
    ]);
    if (!assetInfo) return notFound();

    const displayName = buildDisplayName(assetInfo, ticker);
    const { fullTitle, description, url } = buildSymbolSeoContent(ticker, {
        displayName,
        koreanName: assetInfo.koreanName,
    });

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

    const breadcrumbJsonLd = buildBreadcrumbJsonLd([{ name: fullTitle, url }]);

    const faqJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
            {
                '@type': 'Question',
                name: `${displayName} 차트 분석에서 무엇을 볼 수 있나요?`,
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: `RSI, MACD, 볼린저밴드 같은 보조지표 ${skillCounts.indicators}종으로 추세를 해석하고, 도지나 해머 같은 캔들 패턴, 헤드앤숄더 같은 차트 패턴, 주요 지지선과 저항선 레벨, 매매 신호까지 한 페이지에서 정리해 보여줍니다. AI가 추세 판단과 진입 후보 가격대를 따로 정리해 같이 읽기 좋습니다.`,
                },
            },
            {
                '@type': 'Question',
                name: '차트만으로 매매 판단을 해도 될까요?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: '차트는 추세와 매매 시점을 잡는 데 강하지만, 펀더멘털, 최근 뉴스, 단기 매수 분위기까지 같이 봐야 시나리오가 깨지는 위험 요인을 놓치지 않습니다. 종목 페이지의 다른 탭(/fundamental, /news, /fear-greed, /overall)을 함께 살펴보는 게 안전합니다.',
                },
            },
            {
                '@type': 'Question',
                name: '추세 판단과 진입 후보 가격대는 어떻게 만들어지나요?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'AI가 보조지표, 캔들 패턴, 차트 패턴을 종합해 추세 방향을 정리하고, 주요 지지선과 저항선을 기반으로 진입을 고려할 만한 가격대를 후보로 제시합니다. 화면에 표시된 분석 결과를 근거로 챗봇에게 후속 질문도 할 수 있습니다.',
                },
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
        queryFn: () =>
            getBarsAction(symbol, initialTimeframe, assetInfo.fmpSymbol),
    });

    return (
        <>
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <JsonLd data={faqJsonLd} />
            <section className="sr-only">
                <h2>{displayName} 기술적 분석</h2>
                <p>
                    {displayName} 주가를 RSI, MACD, 볼린저밴드 등{' '}
                    {skillCounts.indicators}종 보조지표로 해석하고, 도지나 해머,
                    장악형 같은 주요 캔들 패턴과 차트 패턴을 자동으로
                    감지합니다. 주요 지지선과 저항선 레벨, 매매 전략도 함께
                    확인할 수 있습니다.
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
                    companyName={assetInfo.name}
                    initialAnalysis={FALLBACK_ANALYSIS}
                    // SSR 단계에서 AI 분석을 의도적으로 생략하고 클라이언트로 위임한다.
                    // 마운트 시 useAnalysis가 자동으로 재분석을 트리거하도록 true로 설정한다.
                    initialAnalysisFailed={true}
                    indicatorCount={skillCounts.indicators}
                    bottomSlot={<OptionsSignalCards symbol={ticker} />}
                />
            </HydrationBoundary>
        </>
    );
}
