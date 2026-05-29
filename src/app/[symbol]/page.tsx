import { SymbolPageClient } from '@/widgets/symbol-page/SymbolPageClient';
import { JsonLd } from '@/shared/ui/JsonLd';
import { FALLBACK_ANALYSIS } from '@/entities/chat-message';
import {
    GEMINI_2_5_FLASH_LITE_MODEL,
    peekAnalysisCache,
} from '@y0ngha/siglens-core';
import {
    DEFAULT_TIMEFRAME,
    isValidTimeframe,
    VALID_TICKER_RE,
} from '@/shared/config/market';
import {
    buildAssetAboutNode,
    buildDisplayName,
    getAssetInfoCached,
} from '@/entities/ticker';
import { getBarsAction } from '@/entities/bars/actions';
import { countSkillFiles } from '@/entities/skill';
import { QUERY_KEYS, QUERY_STALE_TIME_MS } from '@/shared/config/queryConfig';
import {
    buildBreadcrumbJsonLd,
    buildSymbolSeoContent,
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
    // 본문 notFound()와 일관: 잘못된 ticker는 메타데이터를 비우고 noindex로 응답한다.
    if (!VALID_TICKER_RE.test(ticker)) {
        return { robots: { index: false, follow: false } };
    }
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
    // 다른 5개 sibling 페이지(news/fundamental/options/overall/fear-greed)와 일관:
    // 잘못된 ticker 형식은 본문에서도 notFound로 즉시 차단한다 (generateMetadata 가드와 짝).
    if (!VALID_TICKER_RE.test(ticker)) notFound();
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

    // about 노드는 classifyAsset 결과가 stock일 때만 Corporation으로 채워지고,
    // ETF/Index/모호한 종목은 undefined를 반환해 spread로 자연 생략된다.
    // 이전에는 ETF/Index 오분류 위험으로 about 자체를 두지 않았으나, 분류 안전망
    // 도입 후엔 분류 가능한 종목만 안전하게 Corporation 노드를 노출한다.
    const aboutNode = buildAssetAboutNode(
        ticker,
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

    // 차트 페이지는 ticker landing이므로 [Siglens, ticker] 2단계로 통일한다.
    // (sibling 페이지들은 [Siglens, ticker, 섹션명] 3단계 — buildBreadcrumbJsonLd가 Siglens를 자동 prepend.)
    const breadcrumbJsonLd = buildBreadcrumbJsonLd([{ name: ticker, url }]);

    const faqJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
            {
                '@type': 'Question',
                name: `${displayName} 차트 분석에서 무엇을 볼 수 있나요?`,
                acceptedAnswer: {
                    '@type': 'Answer',
                    // FAQ JSON-LD는 동적 숫자(보조지표 개수)를 빼고 질적 표현으로
                    // 유지해 Skills 카운트 변화 시 schema 회귀를 막는다.
                    text: `RSI, MACD, 볼린저밴드 같은 다양한 보조지표로 추세를 해석하고, 도지나 해머 같은 캔들 패턴, 헤드앤숄더 같은 차트 패턴, 주요 지지선과 저항선 레벨, 매매 신호까지 한 페이지에서 정리해 보여줍니다. AI가 추세 판단과 진입 후보 가격대를 따로 정리해 같이 읽기 좋습니다.`,
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

    const barsQueryFn = ({
        queryKey: [, qSymbol, qTimeframe, qFmpSymbol],
    }: {
        queryKey: ReturnType<typeof QUERY_KEYS.bars>;
    }) => getBarsAction(qSymbol, qTimeframe, qFmpSymbol);

    // SEO: 캐시 HIT면 봇이 LLM 비용 0으로 분석 서사를 초기 HTML에서 받는다.
    // peek은 읽기 전용 — enqueue/생성 없음. MISS·corrupt·read 실패는 .catch(()=>null)로
    // 모두 MISS로 degrade해 FALLBACK_ANALYSIS로 폴백한다(렌더를 절대 깨지 않음).
    //
    // modelId: 익명/SSR 기본 방문자가 캐시를 쓰는 키와 정렬한다. SymbolModelContext의
    // DEFAULT_MODEL이 GEMINI_2_5_FLASH_LITE_MODEL이고, useAnalysis가 그 값을
    // submitAnalysisAction에 그대로 전달하므로 writer는 lite 모델 키로 캐시한다.
    // peek도 동일 모델을 넘겨야 HIT한다.
    // bars prefetch와 독립이므로 함께 await해 병렬화한다.
    const [, cachedAnalysis] = await Promise.all([
        Promise.all([
            queryClient.prefetchQuery({
                queryKey: QUERY_KEYS.bars(
                    symbol,
                    initialTimeframe,
                    assetInfo.fmpSymbol
                ),
                queryFn: barsQueryFn,
            }),
            ...(initialTimeframe !== DEFAULT_TIMEFRAME
                ? [
                      queryClient.prefetchQuery({
                          queryKey: QUERY_KEYS.bars(
                              symbol,
                              DEFAULT_TIMEFRAME,
                              assetInfo.fmpSymbol
                          ),
                          queryFn: barsQueryFn,
                      }),
                  ]
                : []),
        ]),
        peekAnalysisCache(
            ticker,
            initialTimeframe,
            assetInfo.fmpSymbol,
            GEMINI_2_5_FLASH_LITE_MODEL
        ).catch(() => null),
    ]);
    const initialAnalysis = cachedAnalysis ?? FALLBACK_ANALYSIS;

    return (
        <>
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <JsonLd data={faqJsonLd} />
            {/* main 랜드마크: 다른 5개 sibling 페이지는 본문에 <main>이 있는데
                차트 페이지만 빠져 있어 의미론적 일관성이 깨졌었다. SymbolPageClient
                outer div는 flex-1로 viewport를 채우는 구조라 그 위 한 단을 main으로
                감싸 sr-only h1과 chart 본문을 하나의 랜드마크로 묶는다. */}
            {/* 차트 페이지는 CrossLinkCards를 본문에 두지 않는다 — SymbolLayout의
                sticky-footer jail이 main(flex-1) 안에서 chart+AI가 첫 viewport를
                채우게 하므로, 카드를 추가하면 jail 안 flex 분배가 깨져 chart 가시
                영역이 침범된다. cross-link 역할은 layout header의 SymbolTabs가
                충분히 수행 (탭으로 sibling 페이지 전환 가능). SEO internal-link
                측면에서도 SymbolTabs는 anchor 기반이라 crawler가 follow 가능. */}
            <main className="flex min-h-0 flex-1 flex-col">
                <section className="sr-only">
                    <h1>{displayName} 차트 분석과 매매 신호</h1>
                    <p>
                        {displayName}({ticker})의 기술적 분석 페이지입니다.
                        보조지표 {skillCounts.indicators}종, 캔들 패턴{' '}
                        {skillCounts.candlesticks}종, 차트 패턴{' '}
                        {skillCounts.patterns}종을 활용해 추세, 진입 구간,
                        지지선과 저항선을 분석합니다.
                    </p>
                    <p>
                        {displayName} 주가를 RSI, MACD, 볼린저밴드 등 보조지표로
                        해석하고, 도지나 해머, 장악형 같은 주요 캔들 패턴과 차트
                        패턴을 자동으로 감지합니다. 주요 지지선과 저항선 레벨,
                        매매 전략도 함께 확인할 수 있습니다.
                    </p>
                    <h2>AI와 대화로 분석 결과 확인</h2>
                    <p>
                        분석된 차트 데이터를 근거로 AI와 대화할 수 있습니다.
                        추세 판단, 지표 의미, 진입 타이밍 등 궁금한 점을
                        질문하면 {displayName}의 현재 상황에 맞춰 답변합니다.
                    </p>
                </section>
                <HydrationBoundary state={dehydrate(queryClient)}>
                    <SymbolPageClient
                        symbol={symbol}
                        companyName={assetInfo.name}
                        // 캐시 HIT면 서버에서 미리 읽은 AI 분석 서사를, MISS면
                        // FALLBACK_ANALYSIS를 초기 분석으로 주입한다.
                        initialAnalysis={initialAnalysis}
                        // 순수 additive: 캐시 seed 여부와 무관하게 클라이언트는
                        // 마운트 시 useAnalysis가 자동으로 재분석을 트리거하도록
                        // 항상 true를 유지한다(봇은 enqueue가 skip되어 생성 안 됨).
                        initialAnalysisFailed={true}
                        indicatorCount={skillCounts.indicators}
                    />
                </HydrationBoundary>
            </main>
        </>
    );
}
