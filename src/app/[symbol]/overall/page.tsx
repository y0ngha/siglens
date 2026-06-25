import { OverallContent } from '@/widgets/overall/OverallContent';
import { OverallFactsSummary } from '@/widgets/overall';
import { CrossLinkCards, SymbolPageHeading } from '@/widgets/symbol-page';
import { JsonLd } from '@/shared/ui/JsonLd';
import {
    DEFAULT_TIMEFRAME,
    SymbolRouteParams,
    isAdmissibleSymbolShape,
} from '@/shared/config/market';
import { isUnresolvableDegraded } from '@/shared/lib/symbolGuard';
import { Suspense } from 'react';
import {
    buildAssetAboutNode,
    buildDisplayName,
    getAssetInfoResilient,
} from '@/entities/ticker';
import { getNewsList } from '@/entities/news-article/api';
import { NEWS_LIST_CACHE_KEY } from '@/entities/news-article';
import {
    buildBreadcrumbJsonLd,
    buildSymbolSeoContent,
    resolveSymbolOverallSeoContent,
    NOINDEX_SYMBOL_METADATA,
    SITE_NAME,
    SITE_URL,
} from '@/shared/lib/seo';
import { getDescriptor, marketProfileOf } from '@/shared/config/marketProfile';
import {
    GEMINI_2_5_FLASH_LITE_MODEL,
    peekOverallAnalysisCache,
} from '@y0ngha/siglens-core';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { SECONDS_PER_HALF_DAY } from '@/shared/config/time';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const revalidate = 43200; // 12h — ISR. AI 분석은 느리게 변하고 클라가 마운트 시 재요청

// generateStaticParams가 없으면 동적 라우트는 매 요청 동적 렌더돼 revalidate가
// 무력화된다(Next.js). 빈 배열 = 빌드 prebuild 없이 첫 요청에 렌더+캐시하는 on-demand
// ISR. (cacheComponents 비활성이라 빈 배열 허용)
export async function generateStaticParams(): Promise<SymbolRouteParams[]> {
    return [];
}

// Suspense fallback 스켈레톤 박스 개수 (CLS 방지용 placeholder).
const SUSPENSE_SKELETON_COUNT = 3;

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
    const { title, fullTitle, description, url, keywords } =
        resolveSymbolOverallSeoContent(upper, assetClass, {
            displayName,
            koreanName: assetInfo.koreanName,
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

// `?tf=` is read by the client component (useSearchParams); canonical URL excludes it so search engines see one URL per page.
export default async function OverallPage({ params }: Props) {
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

    // peek은 읽기 전용 — enqueue/생성 없음. MISS·corrupt·read 실패는 모두 null로
    // degrade하므로 OverallContent는 idle CTA로 자연 폴백한다(렌더를 깨지 않음).
    // read 실패는 삼키지 않고 로깅한 뒤 degrade한다.
    //
    // modelId: chart 페이지와 동일하게 익명/SSR 기본 방문자가 캐시를 쓰는 키와
    // 정렬한다. OverallContent → useDefaultModelId → SymbolModelContext의 DEFAULT_MODEL
    // (GEMINI_2_5_FLASH_LITE_MODEL)이 submitOverallAnalysisAction에 그대로 전달되므로
    // writer는 lite 모델 키로 캐시한다. peek도 동일 모델을 넘겨야 HIT한다.
    //
    // 시그니처가 chart의 peekAnalysisCache(symbol, timeframe, fmpSymbol?, modelId?)와
    // 다른 건 의도적이다 — overall은 2번째 인자로 companyName을 받는다. 각 core peek
    // 함수가 자기 캐시 키 구성에 맞춰 서로 다른 시그니처를 갖는다.
    //
    // ISR: tf는 client가 URL에서 읽으므로 서버는 DEFAULT_TIMEFRAME으로 peek한다.
    // assetInfo.name은 symbol에 종속(1:1)이므로 캐시 키에서 제외한다 — symbol 태그
    // 무효화로 name 변동 시에도 갱신된다.
    // 종합 분석은 enriched news cards가 1개라도 있을 때만 의미가 있다 —
    // `/news`와 동일하게 SSR 시점 enrichment 여부를 prop으로 전달해 client에서
    // 폴링 게이트(useWaitForNewsCards)를 즉시 통과시키거나 폴링 시작하도록 한다.
    //
    // ISR safety: 캐시/DB 실패는 false/null로 degrade해 페이지 자체가 throw하지 않게 한다 —
    // 그 경우 client의 useWaitForNewsCards가 폴링으로 ready 상태를 회복한다.
    //
    // Promise.all로 병렬화 — 두 호출은 서로 독립이라 직렬 await할 이유가 없다.
    // cold path(둘 다 캐시 miss)에서 TTFB가 ~max(t1, t2) 수준으로 줄어든다.
    const [newsItems, cachedOverall] = await Promise.all([
        staticSymbolCache(
            [NEWS_LIST_CACHE_KEY, upper],
            upper,
            () => getNewsList(upper),
            [`news:${upper}`],
            SECONDS_PER_HALF_DAY
        ).catch((error: unknown) => {
            console.error('[OverallPage] getNewsList failed:', error);
            // safe: 빈 배열은 NewsRow[]와 구조적 호환(`.some` 호출 가능). TS는 []의 element
            // type을 never로 추론하므로 staticSymbolCache 반환 타입에 맞추기 위한 cast.
            return [] as Awaited<ReturnType<typeof getNewsList>>;
        }),
        staticSymbolCache(
            ['peek:overall', upper, GEMINI_2_5_FLASH_LITE_MODEL],
            upper,
            () =>
                peekOverallAnalysisCache(
                    upper,
                    assetInfo.name,
                    DEFAULT_TIMEFRAME,
                    GEMINI_2_5_FLASH_LITE_MODEL
                ),
            [],
            SECONDS_PER_HALF_DAY
        ).catch((error: unknown) => {
            console.error(
                '[OverallPage] peekOverallAnalysisCache failed:',
                error
            );
            return null;
        }),
    ]);
    const hasEnrichedNews = newsItems.some(item => item.sentiment !== null);

    const displayName = buildDisplayName(assetInfo, upper);
    const marketProfile = marketProfileOf(assetInfo);
    const assetClass = getDescriptor(marketProfile).assetClass;
    const isEquity = assetClass === 'equity';
    const { fullTitle, description, url } = resolveSymbolOverallSeoContent(
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
        { name: 'AI 종합 분석', url },
    ]);

    // FAQ 답변은 자산 유형별로 분기한다 — 크립토에는 옵션 시장·분기 실적·펀더멘털이 없으므로
    // 해당 문구가 포함된 주식 전용 답변을 그대로 노출하면 실재하지 않는 콘텐츠를 약속하게 된다.
    const faqJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
            {
                '@type': 'Question',
                name: `${displayName} 종합 분석에서는 어떤 축을 같이 보나요?`,
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: isEquity
                        ? `${displayName} 주가의 차트 추세, 옵션 시장이 평가하는 단기 방향성, 분기 실적과 펀더멘털, 최근 뉴스 분위기까지 네 가지 분석 축에 시장 분위기(공포 탐욕 지수)를 더해 강세와 약세 시나리오, 진입을 고려할 만한 가격대, 시나리오가 깨지는 위험 요인을 함께 정리합니다.`
                        : `${displayName} 시세의 차트 추세, 최근 뉴스 분위기, 매수 분위기(공포 탐욕 지수)를 묶어 강세와 약세 시나리오, 진입을 고려할 만한 가격대, 시나리오가 깨지는 위험 요인을 함께 정리합니다.`,
                },
            },
            {
                '@type': 'Question',
                name: '강세 시나리오와 약세 시나리오는 어떤 기준으로 나뉘나요?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: isEquity
                        ? '차트 추세, 옵션 시장의 콜·풋 베팅 분위기, 실적과 가이던스 흐름, 뉴스 분위기를 종합해 상승 압력이 우세한지 하방 압력이 우세한지 판단합니다. 각 시나리오마다 어떤 가격대에서 진입을 고려할 만한지, 어떤 신호가 나오면 시나리오가 깨지는지를 같이 정리합니다.'
                        : '차트 추세, 최근 뉴스 흐름, 매수 분위기를 종합해 상승 압력이 우세한지 하방 압력이 우세한지 판단합니다. 각 시나리오마다 어떤 가격대에서 진입을 고려할 만한지, 어떤 신호가 나오면 시나리오가 깨지는지를 같이 정리합니다.',
                },
            },
            {
                '@type': 'Question',
                name: '어떤 신호가 나오면 시나리오가 깨졌다고 봐야 하나요?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: isEquity
                        ? '실적 발표 결과나 가이던스 변화, 매크로 이벤트, 분위기 급반전 같은 위험 요인이 시나리오의 전제를 무너뜨리면 그 시나리오는 깨졌다고 봅니다. 위험 요인 항목에 따로 표시되어 있어 매수 전에 한 번 확인하기 좋습니다.'
                        : '매크로 이벤트, 규제 이슈, 대형 뉴스, 분위기 급반전 같은 위험 요인이 시나리오의 전제를 무너뜨리면 그 시나리오는 깨졌다고 봅니다. 위험 요인 항목에 따로 표시되어 있어 매수 전에 한 번 확인하기 좋습니다.',
                },
            },
        ],
    };

    return (
        <>
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <JsonLd data={faqJsonLd} />
            <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
                <SymbolPageHeading>
                    {isEquity
                        ? `${displayName} 차트와 옵션 시장, 실적, 뉴스 종합 분석`
                        : `${displayName} 차트와 뉴스, 매수 분위기 종합 분석`}
                </SymbolPageHeading>
                <section className="sr-only">
                    <h2>{displayName} AI 종합 분석 개요</h2>
                    <p>
                        {isEquity
                            ? `${displayName}의 AI 종합 분석. 기술적 분석, 펀더멘털, 뉴스, 옵션, 공포 탐욕 지수의 5축을 통합한 결론과 강세·약세 시나리오, 위험 요인을 정리합니다.`
                            : `${displayName}의 AI 종합 분석. 기술적 분석, 뉴스, 공포 탐욕 지수를 통합한 결론과 강세·약세 시나리오, 위험 요인을 정리합니다.`}
                    </p>
                </section>
                <section
                    aria-labelledby="overall-guide-heading"
                    className="border-secondary-800 bg-secondary-800/30 space-y-3 rounded-lg border p-5"
                >
                    <h2
                        id="overall-guide-heading"
                        className="text-secondary-300 text-base font-semibold"
                    >
                        {displayName} 종합 분석은 어떻게 봐야 할까
                    </h2>
                    {isEquity ? (
                        <>
                            <p className="text-secondary-400 text-sm leading-relaxed">
                                {displayName} 주가가 지금 어디쯤 와 있는지 한
                                페이지에서 정리해 봅니다. 차트의 추세와 주요
                                지지선과 저항선, 옵션 시장이 평가하는 단기
                                방향성, 분기 실적 흐름, 최근 뉴스에서 시장이
                                무엇에 반응하고 있는지까지 네 가지 분석 축에
                                시장 분위기를 더해 살펴봅니다.
                            </p>
                            <p className="text-secondary-400 text-sm leading-relaxed">
                                옵션 시장이 가까운 만기에서 콜과 풋 어느 쪽에 더
                                큰 베팅을 걸고 있는지도 한 줄로 짚어 줍니다. 네
                                축을 합쳐 강세와 약세 시나리오를 각각 정리하고,
                                어떤 가격대에서 진입을 고려해 볼 만한지, 어떤
                                신호가 나오면 시나리오가 깨지는지를 함께
                                짚습니다.
                            </p>
                            <p className="text-secondary-400 text-sm leading-relaxed">
                                실적 발표, 가이던스 변화, 매크로 이벤트처럼
                                시나리오를 뒤집을 수 있는 위험 요인도 따로
                                표시해 두니, 매수 전에 한 번 훑어보면 도움이
                                됩니다.
                            </p>
                        </>
                    ) : (
                        <>
                            <p className="text-secondary-400 text-sm leading-relaxed">
                                {displayName} 시세가 지금 어디쯤 와 있는지 한
                                페이지에서 정리해 봅니다. 차트의 추세와 주요
                                지지선과 저항선, 최근 뉴스에서 시장이 무엇에
                                반응하고 있는지, 매수 분위기(공포 탐욕 지수)를
                                세 축으로 묶어 살펴봅니다.
                            </p>
                            <p className="text-secondary-400 text-sm leading-relaxed">
                                세 축을 합쳐 강세와 약세 시나리오를 각각
                                정리하고, 어떤 가격대에서 진입을 고려해 볼
                                만한지, 어떤 신호가 나오면 시나리오가 깨지는지를
                                함께 짚습니다.
                            </p>
                            <p className="text-secondary-400 text-sm leading-relaxed">
                                매크로 이벤트, 규제 이슈, 대형 뉴스처럼
                                시나리오를 뒤집을 수 있는 위험 요인도 따로
                                표시해 두니, 매수 전에 한 번 훑어보면 도움이
                                됩니다.
                            </p>
                        </>
                    )}
                </section>
                {/* fallback은 두 역할을 겸한다: (1) useSearchParams CSR-bailout 서브트리가
                    hydration 전 비어 보이는 flash/CLS 방지, (2) cached 종합 분석이 있으면
                    크롤러가 JS 없이도 분석 텍스트를 읽을 수 있도록 SSR HTML에 박는다.
                    캐시 MISS 시에는 기존 스켈레톤으로 폴백한다. */}
                <Suspense
                    fallback={
                        cachedOverall ? (
                            <OverallFactsSummary
                                symbol={upper}
                                analysis={cachedOverall}
                            />
                        ) : (
                            <div className="space-y-6" aria-hidden="true">
                                {Array.from(
                                    { length: SUSPENSE_SKELETON_COUNT },
                                    (_, i) => (
                                        <div
                                            key={i}
                                            className="bg-secondary-700 h-32 animate-pulse rounded-xl"
                                        />
                                    )
                                )}
                            </div>
                        )
                    }
                >
                    <OverallContent
                        symbol={upper}
                        companyName={assetInfo.name}
                        initialAnalysis={cachedOverall ?? undefined}
                        hasEnrichedNews={hasEnrichedNews}
                        assetClass={assetClass}
                    />
                </Suspense>
                <CrossLinkCards
                    symbol={upper}
                    current="overall"
                    marketProfile={marketProfile}
                />
            </main>
        </>
    );
}
