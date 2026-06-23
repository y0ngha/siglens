import { SymbolPageClient } from '@/widgets/symbol-page/SymbolPageClient';
import {
    TechnicalFactsSummary,
    buildChartPageHeading,
} from '@/widgets/symbol-page';
import { JsonLd } from '@/shared/ui/JsonLd';
import { FALLBACK_ANALYSIS } from '@/entities/chat-message';
import { GEMINI_2_5_FLASH_LITE_MODEL } from '@y0ngha/siglens-core';
import { peekAnalysisStatic } from '@/entities/analysis';
import {
    DEFAULT_TIMEFRAME,
    SymbolRouteParams,
    isAdmissibleSymbolShape,
} from '@/shared/config/market';
import { isUnresolvableDegraded } from '@/shared/lib/symbolGuard';
import { getDescriptor, marketProfileOf } from '@/shared/config/marketProfile';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import {
    buildAssetAboutNode,
    buildDisplayName,
    getAssetInfoResilient,
} from '@/entities/ticker';
import { getBarsStatic, quantizeBarsDataToLastClosed } from '@/entities/bars';
import { countSkillFiles } from '@/entities/skill';
import { QUERY_KEYS, QUERY_STALE_TIME_MS } from '@/shared/config/queryConfig';
import { MS_PER_SECOND } from '@/shared/config/time';
import {
    buildBreadcrumbJsonLd,
    resolveSymbolSeoContent,
    SITE_NAME,
    SITE_URL,
    NOINDEX_SYMBOL_METADATA,
} from '@/shared/lib/seo';
import {
    dehydrate,
    HydrationBoundary,
    QueryClient,
} from '@tanstack/react-query';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

export const revalidate = 21600; // 6h — ISR. 사용자 신선도는 클라 refetch(useBars 30s)가 보장하므로 상한만 길게

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
    if (!isAdmissibleSymbolShape(ticker)) {
        return NOINDEX_SYMBOL_METADATA;
    }
    const { assetInfo, degraded } = await getAssetInfoResilient(ticker);
    if (degraded) {
        return NOINDEX_SYMBOL_METADATA;
    }
    // 본문 `if (!assetInfo) notFound()`와 일관: 형식은 유효하나 실재하지 않는 ticker
    // (FMP 빈 결과 → assetInfo: null, degraded: false)는 메타데이터도 noindex로 맞춘다.
    // 이 가드가 없으면 본문은 not-found(noindex)를 렌더하는데 메타데이터는 index,follow +
    // canonical을 생성해, 한 페이지에 robots 태그가 충돌(index + noindex)하고 존재하지 않는
    // URL을 canonical로 자기참조하는 soft-404가 만들어진다.
    if (!assetInfo) {
        return NOINDEX_SYMBOL_METADATA;
    }
    const displayName = buildDisplayName(assetInfo, ticker);
    const profile = marketProfileOf(assetInfo);
    const seo = resolveSymbolSeoContent(
        ticker,
        getDescriptor(profile).assetClass,
        {
            displayName,
            koreanName: assetInfo.koreanName,
        }
    );
    const { title, fullTitle, description, url, keywords } = seo;

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

export default async function SymbolPage({ params }: Props) {
    const { symbol } = await params;
    const ticker = symbol.toUpperCase();
    // 다른 5개 sibling 페이지(news/fundamental/options/overall/fear-greed)와 일관:
    // 잘못된 ticker 형식은 본문에서도 notFound로 즉시 차단한다 (generateMetadata 가드와 짝).
    if (!isAdmissibleSymbolShape(ticker)) notFound();
    const [{ assetInfo, degraded }, skillCounts] = await Promise.all([
        getAssetInfoResilient(ticker),
        countSkillFiles(),
    ]);
    // 확장된 게이트(SYMBOL_EDGE_RE)는 crypto 심볼을 수용하기 위해 이전 VALID_TICKER_RE보다
    // 넓다. 정상 조건에서 crypto 심볼은 crypto_assets DB에서 직접 해결된다(degrade 없음).
    // crypto_assets DB와 FMP가 동시에 다운된 경우에만 예외적으로 degrade 가능하며, 이는
    // 허용된 한시적 제약이다. degraded + TICKER_RE 불합격 = DB에도 crypto_assets에도 없는
    // 심볼이 FMP 없이 resolve 실패한 것 → 실재하지 않는 종목으로 취급해 notFound.
    // (MSFT 같은 정상 종목이 FMP 일시 장애 중 degrade되는 경우는 TICKER_RE를 통과하므로
    // 기존 degrade 200+noindex 동작을 유지한다.)
    if (isUnresolvableDegraded(ticker, degraded)) notFound();
    if (!assetInfo) return notFound();

    // Compute marketProfile once here so both TechnicalFactsSummary (Suspense fallback)
    // and SymbolPageClient receive the same value without recomputing on the client.
    const marketProfile = marketProfileOf(assetInfo);
    const { assetClass } = getDescriptor(marketProfile);

    // default-tf bars를 정적화로 가져온다. 실패(인프라 다운 등)는 null로 degrade해
    // 페이지가 깨지지 않도록 한다. 이 bars는 Suspense fallback의 FactLayer SSR에만 쓰이며,
    // 클라이언트 hydration 후에는 SymbolPageClient가 인터랙티브 상태로 교체된다.
    //
    // SSR seed에 forming 봉을 박으면 ISR write churn 유발 — quantize로 마지막 완료 봉까지만.
    // new Date()는 ISR-safe: quantize는 isRegularSessionOpen(session, now) boolean으로만
    // 분기하므로 정규장 안에서는 분/초 차이가 결과에 영향 없음(cache content 동일).
    // crypto(CRYPTO_SESSION)은 24/7 always-open이라 isRegularSessionOpen이 항상 true를
    // 반환 → forming 봉을 항상 제거해 ISR write churn을 방지한다.
    const factBars = await getBarsStatic(
        ticker,
        DEFAULT_TIMEFRAME,
        assetInfo.fmpSymbol
    ).catch((e: unknown) => {
        console.error('[SymbolPage] getBarsStatic failed:', e);
        return null;
    });
    const quantizedFactBars =
        factBars === null
            ? null
            : quantizeBarsDataToLastClosed(
                  factBars,
                  new Date(),
                  sessionSpecFor(marketProfile)
              );

    const displayName = buildDisplayName(assetInfo, ticker);
    const pageSeo = resolveSymbolSeoContent(ticker, assetClass, {
        displayName,
        koreanName: assetInfo.koreanName,
    });
    const { fullTitle, description, url } = pageSeo;

    // about 노드는 classifyAsset 결과가 stock일 때만 Corporation으로 채워지고,
    // ETF/Index/모호한 종목은 undefined를 반환해 spread로 자연 생략된다.
    // crypto는 schema.org 표준 타입이 없어 about 노드를 생략한다.
    const aboutNode = buildAssetAboutNode(
        ticker,
        assetInfo.koreanName ?? assetInfo.name,
        assetInfo.fmpSymbol,
        assetClass
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

    queryClient.setQueryData(QUERY_KEYS.assetInfo(symbol), assetInfo, {
        updatedAt: 0,
    });

    // prefetchQuery(getBarsStatic 재호출)는 제거 — forming 봉이 포함된 라이브 bars가
    // dehydrate seed로 박히면 ISR write churn이 발생하므로, quantize 후 동기 주입으로 대체.
    // 차트 페이지는 ISR로 캐시되므로 기본 timeframe만 seed한다.
    // ?tf= 딥링크는 클라(useTimeframeChange→useSearchParams)가 마운트 시 읽어
    // 해당 timeframe bars를 fetch한다.
    //
    // null guard: getBarsStatic 실패 시 quantizedFactBars는 null이다. null을 setQueryData에
    // 넘기면 null "success" 값이 dehydrate 캐시에 박혀 클라 useSuspenseQuery가 data.bars를
    // null에서 읽으려다 crash하고, null은 stale 트리거가 아니므로 재fetch도 안 된다.
    // null인 경우는 seed를 생략해 클라 useBars/getBarsAction이 라이브로 fetch하게 한다.
    if (quantizedFactBars !== null) {
        // updatedAt 명시: RQ dehydrate 기본은 Date.now()라 매 ISR 재생성마다 다른 timestamp가
        // HTML에 박혀 ISR write churn 발생(2026-06-06 실측). 마지막 완료 봉의 time으로 고정해
        // 같은 봉이 계속 마지막인 한 dehydrated state 결정성 보장.
        // Bar.time은 seconds (epoch) — RQ dataUpdatedAt은 milliseconds.
        const lastBarSec = quantizedFactBars.bars.at(-1)?.time ?? 0;
        const stableUpdatedAt = lastBarSec * MS_PER_SECOND;
        queryClient.setQueryData(
            QUERY_KEYS.bars(symbol, DEFAULT_TIMEFRAME, assetInfo.fmpSymbol),
            quantizedFactBars,
            { updatedAt: stableUpdatedAt }
        );
    }

    // peek은 읽기 전용 — enqueue/생성 없음. MISS·corrupt·read 실패는 모두 MISS로
    // degrade해 FALLBACK_ANALYSIS로 폴백한다(렌더를 절대 깨지 않음). read 실패는
    // 삼키지 않고 로깅한 뒤 degrade한다.
    //
    // modelId: 익명/SSR 기본 방문자가 캐시를 쓰는 키와 정렬한다. SymbolModelContext의
    // DEFAULT_MODEL이 GEMINI_2_5_FLASH_LITE_MODEL이고, useAnalysis가 그 값을
    // submitAnalysisAction에 그대로 전달하므로 writer는 lite 모델 키로 캐시한다.
    // peek도 동일 모델을 넘겨야 HIT한다.
    const cachedAnalysis = await peekAnalysisStatic(
        ticker,
        DEFAULT_TIMEFRAME,
        assetInfo.fmpSymbol,
        GEMINI_2_5_FLASH_LITE_MODEL
    ).catch((error: unknown) => {
        console.error('[SymbolPage] peekAnalysisStatic failed:', error);
        return null;
    });
    const initialAnalysis = cachedAnalysis ?? FALLBACK_ANALYSIS;

    return (
        <>
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <JsonLd data={faqJsonLd} />
            {/* main 랜드마크: 다른 5개 sibling 페이지는 본문에 <main>이 있는데
                차트 페이지만 빠져 있어 의미론적 일관성이 깨졌었다. SymbolPageClient
                outer div는 flex-1로 viewport를 채우는 구조라 그 위 한 단을 main으로
                감싸 sr-only 보조 설명과 chart 본문을 하나의 랜드마크로 묶는다.
                가시 h1은 jail 제약상 SymbolPageClient의 timeframe bar 안에 둔다. */}
            {/* 차트 페이지는 CrossLinkCards를 본문에 두지 않는다 — SymbolLayout의
                sticky-footer jail이 main(flex-1) 안에서 chart+AI가 첫 viewport를
                채우게 하므로, 카드를 추가하면 jail 안 flex 분배가 깨져 chart 가시
                영역이 침범된다. cross-link 역할은 layout header의 SymbolTabs가
                충분히 수행 (탭으로 sibling 페이지 전환 가능). SEO internal-link
                측면에서도 SymbolTabs는 anchor 기반이라 crawler가 follow 가능. */}
            <main className="flex min-h-0 flex-1 flex-col">
                <section className="sr-only">
                    {/* 차트 h1은 SymbolPageClient(이 section보다 DOM 뒤)에 있어,
                        여기에 heading을 두면 h1보다 먼저 나와 위계가 역전된다
                        (WCAG 1.3.1). 보조 설명은 heading 없이 p로만 노출한다. */}
                    <p>{displayName} 차트 분석 개요</p>
                    <p>
                        {displayName}의 기술적 분석 페이지입니다. 보조지표{' '}
                        {skillCounts.indicators}종, 캔들 패턴{' '}
                        {skillCounts.candlesticks}종, 차트 패턴{' '}
                        {skillCounts.patterns}종을 활용해 추세, 진입 구간,
                        지지선과 저항선을 분석합니다.
                    </p>
                    <p>
                        {`${displayName} ${assetClass === 'crypto' ? '시세' : '주가'}를 RSI, MACD, 볼린저밴드 등 보조지표로 해석하고, 도지나 해머, 장악형 같은 주요 캔들 패턴과 차트 패턴을 자동으로 감지합니다. 주요 지지선과 저항선 레벨, 매매 전략도 함께 확인할 수 있습니다.`}
                    </p>
                    <p>AI와 대화로 분석 결과 확인</p>
                    <p>
                        분석된 차트 데이터를 근거로 AI와 대화할 수 있습니다.
                        추세 판단, 지표 의미, 진입 타이밍 등 궁금한 점을
                        질문하면 {displayName}의 현재 상황에 맞춰 답변합니다.
                    </p>
                </section>
                <HydrationBoundary state={dehydrate(queryClient)}>
                    {/* fallback은 두 역할을 겸한다:
                        1. CLS 방지 — 차트 영역(flex-1)을 미리 차지해 useSearchParams
                           CSR-bailout 서브트리가 hydration 전 비어 보이는 flash를 막는다.
                        2. FactLayer SSR — bars가 있으면 TechnicalFactsSummary를 fallback으로
                           렌더해 크롤러(JS 미실행)가 기술적 지표 요약 텍스트를 SSR HTML로
                           받는다. 사용자는 hydration 후 인터랙티브 SymbolPageClient로 교체된다. */}
                    <Suspense
                        fallback={
                            <>
                                {/* SSR 크롤용 h1: 가시 h1은 SymbolPageClient(useSearchParams
                                    CSR-bailout)에 있어 SSR HTML에 박히지 않는다. hydration 후
                                    그 가시 h1으로 교체되는 이 fallback에 동일 텍스트의 sr-only
                                    h1을 둬, JS 미실행 크롤러(Naver Yeti 등)가 메인 페이지 h1을
                                    받게 한다(나머지 5라우트의 SymbolPageHeading h1과 정합). fallback이
                                    hydration 시 교체되므로 가시 클라 h1과 동시 존재하지 않아 h1 중복은
                                    없고, 텍스트가 동일해 cloaking도 아니다. */}
                                <h1 className="sr-only">
                                    {buildChartPageHeading(displayName)}
                                </h1>
                                {quantizedFactBars &&
                                quantizedFactBars.bars.length > 0 ? (
                                    <TechnicalFactsSummary
                                        symbol={ticker}
                                        bars={quantizedFactBars.bars}
                                        indicators={
                                            quantizedFactBars.indicators
                                        }
                                        marketProfile={marketProfile}
                                    />
                                ) : (
                                    <div
                                        className="bg-secondary-900 flex min-h-0 flex-1 flex-col overflow-hidden"
                                        aria-hidden="true"
                                    />
                                )}
                            </>
                        }
                    >
                        <SymbolPageClient
                            symbol={symbol}
                            companyName={assetInfo.name}
                            displayName={displayName}
                            initialAnalysis={initialAnalysis}
                            // 순수 additive: 캐시 seed 여부와 무관하게 클라이언트는
                            // 마운트 시 useAnalysis가 자동으로 재분석을 트리거하도록
                            // 항상 true를 유지한다(봇은 enqueue가 skip되어 생성 안 됨).
                            initialAnalysisFailed={true}
                            indicatorCount={skillCounts.indicators}
                            marketProfile={marketProfile}
                        />
                    </Suspense>
                </HydrationBoundary>
            </main>
        </>
    );
}
