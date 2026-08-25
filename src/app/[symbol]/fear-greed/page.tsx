import { FearGreedPage } from '@/widgets/fear-greed/FearGreedPage';
import { getBlockedSymbolMetadata } from '@/app/[symbol]/symbolIndexabilityMetadata';
import { ErrorBoundary } from 'react-error-boundary';
import { FearGreedPageError } from '@/widgets/fear-greed';
import { FearGreedFactsSummary, SymbolPageHeading } from '@/views/symbol';
import { CrossLinkCards } from '@/shared/ui/CrossLinkCards';
import { FaqSection } from '@/shared/ui/FaqSection';
import { JsonLd } from '@/shared/ui/JsonLd';
import {
    DEFAULT_TIMEFRAME,
    SymbolRouteParams,
    isAdmissibleSymbolShape,
} from '@/shared/config/market';
import { isUnresolvableDegraded } from '@/shared/lib/symbolGuard';
import {
    buildAssetAboutNode,
    buildDisplayName,
    getAssetInfoResilient,
} from '@/entities/ticker';
import { getSeedBarsStatic } from '@/entities/bars';
import { getDescriptor, marketProfileOf } from '@/shared/config/marketProfile';
import { QUERY_KEYS, QUERY_STALE_TIME_MS } from '@/shared/config/queryConfig';
import { MS_PER_SECOND } from '@/shared/config/time';
import {
    buildBreadcrumbJsonLd,
    buildFaqJsonLd,
    buildSymbolSeoContent,
    buildSymbolWebPageJsonLd,
    resolveSymbolFearGreedSeoContent,
    symbolMetadataFromSeo,
    NOINDEX_SYMBOL_METADATA,
    noindexSymbolMetadata,
    type FaqItem,
} from '@/shared/lib/seo';
import {
    dehydrate,
    HydrationBoundary,
    QueryClient,
} from '@tanstack/react-query';
import type { BarsData } from '@y0ngha/siglens-core';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';

// 종목당 SEO 콘텐츠는 고정이고 동적 데이터는 클라가 재hydrate한다. 엣지 캐시로
// compute 호출을 줄인다. (일시 인프라 장애의 404 캐싱은 getAssetInfo strict로 차단)
/**
 * 종목이 속한 시장의 상위 공포·탐욕 지수 링크.
 *
 * 암호화폐는 전용 시장 지수가 없어 미국 페이지를 가리킨다 — 상위 개념을 설명하는
 * 용도라 시장이 정확히 일치하지 않아도 문장이 성립한다(라벨로 그렇게 말한다).
 */
const MARKET_FEAR_GREED_LINK: Record<
    ReturnType<typeof marketProfileOf>,
    { href: string; label: string; marketLabel: string }
> = {
    'us-equity': {
        href: '/fear-greed',
        label: '시장 전체 공포·탐욕 지수',
        marketLabel: '미국 증시',
    },
    'kr-equity': {
        href: '/fear-greed/kr',
        label: '한국 시장 공포·탐욕 지수',
        marketLabel: '한국 증시',
    },
    crypto: {
        href: '/fear-greed',
        label: '시장 전체 공포·탐욕 지수',
        marketLabel: '미국 증시',
    },
};

export const revalidate = 86400; // 24h — SSR이 점수·요인·시계열 요약까지 텍스트로 렌더한다(FearGreedFactsSummary).
// 예전엔 "정적 가이드뿐"이었으나 2026-08 thin-content 대응으로 바뀌었다. 즉 이 TTL은
// **크롤러가 보는 수치의 신선도**를 직접 정한다 — 줄이면 ISR 재생성 비용이 오른다.

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
    const blockedMetadata = await getBlockedSymbolMetadata({
        symbol: ticker,
        assetInfo,
        degraded,
        revalidateSeconds: revalidate,
    });
    if (blockedMetadata) return blockedMetadata;
    if (!assetInfo) return noindexSymbolMetadata(ticker);

    const displayName = buildDisplayName(assetInfo, ticker);
    const assetClass = getDescriptor(marketProfileOf(assetInfo)).assetClass;
    const seo = resolveSymbolFearGreedSeoContent(ticker, assetClass, {
        displayName,
        koreanName: assetInfo.koreanName,
    });
    return symbolMetadataFromSeo(seo);
}

export default async function SymbolFearGreedPage({ params }: Props) {
    const { symbol } = await params;
    const ticker = symbol.toUpperCase();

    if (!isAdmissibleSymbolShape(ticker)) {
        notFound();
    }

    const { assetInfo, degraded } = await getAssetInfoResilient(ticker);
    // degraded + digit-first 심볼 = 두 데이터 소스가 동시 다운 중이고 resolve 불가
    // → 차트 페이지와 동일한 notFound 처리로 sibling 일관성 유지.
    if (isUnresolvableDegraded(ticker, degraded)) notFound();
    if (!assetInfo) {
        notFound();
    }

    const displayName = buildDisplayName(assetInfo, ticker);
    const marketProfile = marketProfileOf(assetInfo);
    const assetClass = getDescriptor(marketProfile).assetClass;
    const marketFearGreedLink = MARKET_FEAR_GREED_LINK[marketProfile];

    const { fullTitle, description, url } = resolveSymbolFearGreedSeoContent(
        ticker,
        assetClass,
        {
            displayName,
            koreanName: assetInfo.koreanName,
        }
    );

    // about 노드는 stock으로 분류된 경우만 채워지고, ETF/Index/모호한 종목과 crypto는
    // undefined로 자연 생략된다. crypto는 schema.org 표준 타입이 없어 about 노드 자체를 두지 않는다.
    const aboutNode = buildAssetAboutNode(
        ticker,
        assetInfo.koreanName ?? assetInfo.name,
        assetInfo.fmpSymbol,
        assetClass
    );
    const webPageJsonLd = buildSymbolWebPageJsonLd({
        url,
        name: fullTitle,
        description,
        about: aboutNode,
    });

    const breadcrumbJsonLd = buildBreadcrumbJsonLd([
        { name: displayName, url: buildSymbolSeoContent(ticker).url },
        { name: '공포 탐욕 지수', url },
    ]);

    /**
     * FAQ — 화면 `FaqSection`과 FAQPage 구조화데이터의 단일 소스.
     *
     * 예전에는 같은 내용이 화면에 보이지 않는 마크업 전용 FAQ 답변 3개와, 화면에만
     * 보이는 "가이드" 안내 섹션(문단 3개) 두 벌로 있었다 — 구글이 요구하는 "마크업한
     * Q&A가 페이지에 보일 것"을 어기면서 동시에 같은 말을 두 번 하는 중복 콘텐츠이기도
     * 했다. 안내 섹션의 5-factor 설명과 60일 신뢰도 문턱은 이미 아래 답변 2·3과
     * 사실상 같은 문장이라 답변으로 흡수했다. 시장 전체 지수로 가는 내부 링크
     * (`marketFearGreedLink`)만은 텍스트로 옮길 수 없는 실제 이동 수단이라 아래
     * `<FaqSection>` 위에 별도 문단으로 남겨 둔다(하단 참고).
     *
     * 경계값 라벨(3번 답변)은 경계값 상수 변경에 따른 schema 회귀를 막기 위해
     * 구체 숫자(0~25, 25~45 등) 대신 질적 표현으로만 정리한다.
     */
    const faq: readonly FaqItem[] = [
        {
            question: `${displayName} 공포 탐욕 지수는 무엇을 측정하나요?`,
            answer: `${displayName} 한 종목의 단기 매매 심리를 0~100 점수로 측정합니다. CNN의 시장 전체 Fear & Greed Index와 달리 종목별 자체 분포(self-normalization)로 산출하므로, 다른 종목과 점수를 직접 비교하기보다는 같은 종목의 시간 흐름 변화를 보는 데 적합합니다.`,
        },
        {
            question: '점수는 어떤 5가지 요인으로 계산되나요?',
            answer: 'Volume z-score, Buy/Sell volume 불균형, Volume Profile POC 거리, MA200 이격, 52주 최고가 대비 위치 — 5개 factor 각각을 200영업일 분포 안에서 percentile로 환산한 뒤 가중 평균합니다. 각 factor가 Flow 그룹과 Trend 그룹으로 묶여 별도 점수로도 표시됩니다.',
        },
        {
            question: '5단계 분위기 라벨은 어떻게 구분되나요?',
            answer: '극심한 공포부터 극심한 탐욕까지 5단계(극심한 공포 · 공포 · 중립 · 탐욕 · 극심한 탐욕)로 구분됩니다. 표본 수가 60일 미만이면 신뢰도 "제한"으로 표시되며, 라벨은 데이터가 더 쌓인 뒤 다시 확인하는 게 안전합니다.',
        },
    ];
    const faqJsonLd = buildFaqJsonLd(faq);

    const queryClient = new QueryClient({
        defaultOptions: { queries: { staleTime: QUERY_STALE_TIME_MS } },
    });
    queryClient.setQueryData(QUERY_KEYS.assetInfo(symbol), assetInfo, {
        updatedAt: 0,
    });
    // **`getSeedBarsStatic`을 쓴다** — layout.tsx와 같은 헬퍼·같은 인자(대문자 ticker)여야
    // 요청 스코프 메모가 접혀 지표가 한 벌만 직렬화된다.
    //
    // 이전에는 이 페이지만 `getQuantizedBarsStatic`(전체 지표)을 seed했다. layout은
    // 축소판을 seed하므로 참조가 갈려 **지표가 두 벌** 실렸다 — 2026-08 프로덕션 실측:
    // `/AAPL/fear-greed`의 flight 630KB 중 441KB가 44개 지표를 전부 채운 두 번째 블록이었고,
    // 첫 번째 블록(53KB, 축소판)과 별개였다. 이 라우트는 gzip 149.9KB로 사이트 최대였다.
    //
    // 축소판으로 충분한 근거: 이 페이지에서 지표를 읽는 유일한 소비자는 아래
    // `FearGreedFactsSummary`이고, 그 props는 `bars`와 `buySellVolume` 둘뿐이다
    // (`computeFearGreedIndex(bars, buySellVolume)`). `getSeedBarsStatic`이 `buySellVolume`을
    // 유지하므로 SSR 출력은 입력이 같아 **바이트 동일**하다 — SEO·hydration 영향 없음.
    // 클라이언트는 마운트 직후 `useBars`가 전체를 다시 받는다(seed의 updatedAt이 마지막 봉
    // 시각이라 30초 staleTime 기준 항상 stale).
    const quantizedFromHelper = await getSeedBarsStatic(
        ticker,
        DEFAULT_TIMEFRAME,
        marketProfileOf(assetInfo),
        assetInfo.fmpSymbol
    ).catch((e: unknown) => {
        console.error('[FearGreedPage] getSeedBarsStatic failed:', e);
        return null;
    });
    // quantizedFgBars also feeds FearGreedFactsSummary (SSR factor summary below) —
    // hoisted out of the if-block so both the RQ seed and the SSR fact layer share
    // the same lockstep-quantized bars/indicators.
    let quantizedFgBars: BarsData | null = null;
    if (quantizedFromHelper !== null) {
        // updatedAt 명시: RQ dehydrate 기본은 Date.now()라 매 ISR 재생성마다 다른 timestamp가
        // HTML에 박혀 ISR write churn 발생. 마지막 완료 봉의 time으로 고정.
        // Session arg mirrors the chart page pattern: crypto (always-open) must strip
        // the forming bar with CRYPTO_SESSION, not US_EQUITY_SESSION (the default).
        // 헬퍼가 이미 quantize까지 마쳤다 — 여기서 다시 감싸면 새 객체가 생겨
        // layout seed와 참조가 갈리고 지표가 두 벌 실린다.
        quantizedFgBars = quantizedFromHelper;
        // Bar.time은 seconds (epoch) — RQ dataUpdatedAt은 milliseconds.
        const lastBarSec = quantizedFgBars.bars.at(-1)?.time ?? 0;
        const stableUpdatedAt = lastBarSec * MS_PER_SECOND;
        queryClient.setQueryData(
            QUERY_KEYS.bars(symbol, DEFAULT_TIMEFRAME, assetInfo.fmpSymbol),
            quantizedFgBars,
            { updatedAt: stableUpdatedAt }
        );
    }

    return (
        <>
            <JsonLd data={webPageJsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <JsonLd data={faqJsonLd} />
            <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
                <SymbolPageHeading>
                    {displayName} 공포 탐욕 지수와 단기 매수 분위기
                </SymbolPageHeading>
                {/* sr-only 개요 문단(구 시안)은 삭제했다 — 0~100 점수·5단계 라벨·factor
                    근거를 그대로 되풀이했고, 그 내용은 지금 아래 `FaqSection`의
                    답변 3개가 화면에 보이는 텍스트로 이미 커버한다(크롤러에게 같은
                    말을 두 번 하지 않는다). 화면에 실제로 보이던 "가이드" 카드도 같은
                    이유로 지웠다 — 5-factor 설명·60일 신뢰도 문턱은 아래 답변 2·3과
                    사실상 같은 문장이었다. 유일하게 답변으로 옮길 수 없던 내용(시장
                    전체 지수로 가는 실제 이동 링크)만 아래 문단으로 남겨 둔다. */}
                <p className="text-sm leading-relaxed text-secondary-400">
                    {/* 상위 지수 링크는 이 종목이 속한 시장을 가리켜야 한다.
                        `/fear-greed/kr`이 생기기 전에는 둘 다 미국뿐이라
                        하드코딩이 맞았지만, 지금은 한국 종목 페이지가
                        "미국 증시 전반"을 참조하게 된다. */}
                    <Link
                        href={marketFearGreedLink.href}
                        className="text-primary-400 underline-offset-4 hover:text-primary-300 hover:underline"
                    >
                        {marketFearGreedLink.label}
                    </Link>
                    가 여러 자산을 합쳐 {marketFearGreedLink.marketLabel} 전반의
                    감정을 보여 준다면, 이 페이지는 {displayName} 한 종목의
                    거래량 흐름과 체결 흐름, 가격 위치를 그 종목의 자체 분포
                    안에서 환산해 점수로 만듭니다.
                </p>
                {/* 서버 계산 factor 요약 — crawler는 JS 미실행이라 아래 클라 게이지
                    (FearGreedPage)의 점수·factor 수치를 절대 못 본다. 여기서
                    이미 로드된 quantizedFgBars(bars+indicators)로 동일 수치를
                    SSR HTML에 박아 크롤 가능하게 한다(결정적, AI/pre-warm 무관).
                    사용자에게도 동일하게 보이므로 클로킹 아님. */}
                {quantizedFgBars && quantizedFgBars.bars.length > 0 && (
                    <FearGreedFactsSummary
                        symbol={ticker}
                        bars={quantizedFgBars.bars}
                        buySellVolume={quantizedFgBars.indicators.buySellVolume}
                    />
                )}
                <HydrationBoundary state={dehydrate(queryClient)}>
                    <ErrorBoundary FallbackComponent={FearGreedPageError}>
                        <FearGreedPage
                            symbol={ticker}
                            fmpSymbol={assetInfo.fmpSymbol}
                            // 위 `FearGreedFactsSummary`가 같은 경고 문구를 이미
                            // 서버 렌더한다 — 둘 다 그리면 중복이다.
                            hideSelfNormWarning
                        />
                    </ErrorBoundary>
                </HydrationBoundary>
                <FaqSection
                    heading={`${displayName} 공포 탐욕 지수 자주 묻는 질문`}
                    items={faq}
                />
                <CrossLinkCards
                    symbol={ticker}
                    current="fear-greed"
                    marketProfile={marketProfile}
                />
            </main>
        </>
    );
}
