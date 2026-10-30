import type { BarsData } from '@y0ngha/siglens-core';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import {
    dehydrate,
    HydrationBoundary,
    QueryClient,
} from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';

import { buildSymbolTabBreadcrumbJsonLd } from '@/app/[locale]/[symbol]/_lib/symbolTabBreadcrumb';
import {
    enterSymbolTabMetadata,
    enterSymbolTabPage,
    type SymbolTabParams,
} from '@/app/[locale]/[symbol]/_lib/symbolTabEntry';
import { requireResolvableAsset } from '@/app/[locale]/[symbol]/requireResolvableAsset';
import { getBlockedSymbolMetadata } from '@/app/[locale]/[symbol]/symbolIndexabilityMetadata';
import { buildSymbolWebPageJsonLd } from '@/app/[locale]/[symbol]/symbolWebPageJsonLd';
import { getSessionBarsStatic } from '@/entities/bars/lib/sessionBarsStaticCache';
import {
    clientSymbolFearGreed,
    symbolFearGreedInputs,
} from '@/entities/bars/lib/symbolFearGreed';
import { getMarketFearGreedReading } from '@/entities/market-fear-greed/api/marketFearGreedReading';
import { buildAssetAboutNode } from '@/entities/ticker/lib/assetClassification';
import { buildDisplayName, pickAssetName } from '@/entities/ticker/lib/ticker';
import { shortenRevalidateForRuntimeDegrade } from '@/shared/cache/buildDegradedRevalidate';
import { assetInfoSeedUpdatedAt } from '@/shared/config/assetInfoSeed';
import { SymbolRouteParams } from '@/shared/config/market';
import {
    getDescriptor,
    marketProfileOf,
} from '@/shared/config/marketProfile/registry';
import { QUERY_KEYS, QUERY_STALE_TIME_MS } from '@/shared/config/queryConfig';
import { MS_PER_SECOND } from '@/shared/config/time';
import { resolveSymbolFearGreedSeoContent } from '@/shared/lib/seo';
import { symbolMetadataFromSeo } from '@/shared/lib/symbolMetadata';
import { CrossLinkCards } from '@/shared/ui/CrossLinkCards';
import { JsonLd } from '@/shared/ui/JsonLd';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { FearGreedFactsSummary } from '@/views/symbol/fearGreed/FearGreedFactsSummary';
import { fearGreedDateModified } from '@/views/symbol/fearGreed/utils/fearGreedDateModified';
import {
    buildFearGreedMetaFactsFromBars,
    lastScoredDateFromBars,
} from '@/views/symbol/fearGreed/utils/fearGreedFromBars';
import { composeFearGreedDescription } from '@/views/symbol/fearGreed/utils/fearGreedMetaDescription';
import { hasFearGreedScore } from '@/views/symbol/fearGreed/utils/hasFearGreedScore';
import { SymbolPageHeading } from '@/views/symbol/ui/SymbolPageHeading';
import { symbolFactsSubject } from '@/views/symbol/utils/factsSubject';
import { FearGreedPage } from '@/widgets/fear-greed/FearGreedPage';
import { FearGreedPageError } from '@/widgets/fear-greed/FearGreedPageError';

import { MARKET_FEAR_GREED_LINK } from './_lib/marketFearGreedLink';

/**
 * ISR 상한. SSR이 점수·요인·시계열 요약까지 텍스트로 렌더하므로(`FearGreedFactsSummary`) 이 값이
 * **크롤러가 보는 수치의 신선도**를 직접 정한다 — 줄이면 ISR 재생성 비용이 오른다.
 */
export const revalidate = 86400; // 24h

/**
 * 빈 배열 = 빌드 시 prebuild 없이 첫 요청에 렌더+캐시하는 on-demand ISR. 없으면 동적 세그먼트가
 * 매 요청 동적 렌더돼 `revalidate`가 무력화된다.
 */
export async function generateStaticParams(): Promise<SymbolRouteParams[]> {
    return [];
}

interface Props {
    params: SymbolTabParams;
}

/**
 * 종목별 공포·탐욕 탭 메타데이터 — 이 탭은 **색인한다**(종목별 색인 탭은 차트·뉴스·공포탐욕 셋).
 * 이 탭의 롱테일이 실제 클릭을 만들어 온 수요가 근거다. 대신 템플릿 비중을 낮추려고 종목 탭 FAQ를
 * 걷어냈다. 크롤 후 미색인이 쌓이거나 게재순위가 나빠지면 noindex로 되돌리는 것이 롤백 신호다.
 *
 * 점수를 낼 수 있으면 description을 점수에서 만든 종목별 문장으로 바꾼다.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale, ticker, tSeo, assetInfo, degraded } =
        await enterSymbolTabMetadata(params);
    // 콘텐츠 게이트 — 본문의 `FearGreedFactsSummary`와 **같은 입력·같은 술어**(`hasFearGreedScore`)로
    // 판정한다(CONVENTIONS.md#CP-2). 본문과 같은 인자라 요청 스코프 메모가 접혀 왕복이 늘지 않는다.
    //   - 조회 **실패**(`null`) → degraded. 이 탭에는 스냅샷이 없어(`tab: 'fear-greed'`는 제목 카피용)
    //     degraded는 곧 noindex다 — 장애 중 빈 껍데기가 색인되지 않는다.
    //   - 조회는 됐는데 **점수가 안 나오면**(봉·표본 부족, 상장폐지·신규 상장) 본문이 도입 문단뿐이라
    //     `no-price-data`로 noindex. 봉 2개 기준(`buildTechnicalFacts`)으로는 봉은 있고 점수가 없는
    //     종목이 색인된다.
    const metadataBars = await getSessionBarsStatic(
        ticker,
        marketProfileOf(assetInfo),
        assetInfo.fmpSymbol
    ).catch((e: unknown) => {
        console.error(
            '[SymbolFearGreedPage] generateMetadata getSessionBarsStatic failed:',
            e
        );
        return null;
    });
    const blockedMetadata = await getBlockedSymbolMetadata({
        locale,
        symbol: ticker,
        assetInfo,
        degraded: degraded || metadataBars === null,
        revalidateSeconds: revalidate,
        hasPriceData:
            metadataBars === null ? undefined : hasFearGreedScore(metadataBars),
        // 차단될 때도 이 탭의 제목을 쓴다 — 없으면 차트 탭 제목으로 떨어져 한 종목에
        // 같은 title이 두 개가 된다. 스냅샷 탭이 아니라 DB는 읽지 않는다.
        tab: 'fear-greed',
    });
    if (blockedMetadata) return blockedMetadata;

    const displayName = buildDisplayName(assetInfo, ticker, locale);
    const assetClass = getDescriptor(marketProfileOf(assetInfo)).assetClass;
    const seo = resolveSymbolFearGreedSeoContent(ticker, assetClass, tSeo, {
        displayName,
        koreanName: assetInfo.koreanName,
        englishName: assetInfo.name,
        locale,
    });
    const metadata = symbolMetadataFromSeo(seo, locale);

    // 점수에서 만든 종목별 설명 — 본문과 같은 봉·같은 계산이고(`computeSymbolFearGreedSeries`는 요청 안에서
    // `React.cache`), 점수를 못 내면 템플릿 설명을 그대로 둔다.
    const metaFacts =
        metadataBars === null
            ? null
            : buildFearGreedMetaFactsFromBars(metadataBars);
    if (metaFacts === null) return metadata;
    const tLabel = await getTranslations({
        locale,
        namespace: 'shared.enumLabel',
    });
    return {
        ...metadata,
        description: composeFearGreedDescription(
            metaFacts,
            symbolFactsSubject(ticker, assetInfo.koreanName, locale),
            tSeo,
            tLabel
        ),
    };
}

/**
 * 종목별 공포·탐욕 탭 본문 — 시장 허브 안내 문단, 게이지(서버 계산 결과를 seed해 SSR), 서버 계산
 * 요인 요약(`FearGreedFactsSummary`, 점수가 없으면 생략).
 */
export default async function SymbolFearGreedPage({ params }: Props) {
    const { locale, ticker, segment } = await enterSymbolTabPage(params);
    // 번역과 존재 판정은 서로 독립이다(존재하지 않으면 `notFound()`로 함께 끊긴다).
    const [t, tSeo, { assetInfo, degraded }] = await Promise.all([
        getTranslations('app.symbol'),
        getTranslations('shared.seo'),
        requireResolvableAsset(ticker),
    ]);

    const displayName = buildDisplayName(assetInfo, ticker, locale);
    const marketProfile = marketProfileOf(assetInfo);
    const assetClass = getDescriptor(marketProfile).assetClass;
    const marketFearGreedLink = MARKET_FEAR_GREED_LINK[marketProfile];

    const { fullTitle, description, url } = resolveSymbolFearGreedSeoContent(
        ticker,
        assetClass,
        tSeo,
        {
            displayName,
            koreanName: assetInfo.koreanName,
            englishName: assetInfo.name,
            locale,
        }
    );

    // about 노드는 stock으로 분류된 경우만 채워지고, ETF·지수·모호한 종목과 crypto(schema.org 표준
    // 타입 없음)는 undefined로 생략된다.
    const aboutNode = buildAssetAboutNode(
        ticker,
        pickAssetName(assetInfo, ticker, locale),
        assetInfo.fmpSymbol,
        assetClass
    );
    const breadcrumbJsonLd = await buildSymbolTabBreadcrumbJsonLd({
        ticker,
        displayName,
        tab: 'fear-greed',
        tabUrl: url,
        tSeo,
        locale,
    });

    const queryClient = new QueryClient({
        defaultOptions: { queries: { staleTime: QUERY_STALE_TIME_MS } },
    });
    queryClient.setQueryData(QUERY_KEYS.assetInfo(segment), assetInfo, {
        updatedAt: assetInfoSeedUpdatedAt(degraded),
    });
    // **세션 키 축소 봉(`getSessionBarsStatic`)을 쓴다** — 5년 일봉을 담고 키가 마지막 마감 세션
    // 날짜라 revalidate가 24h다. 6h 봉 캐시를 읽으면 이 탭(24h 선언)이 6h로 clamp된다
    // (`sessionBarsStaticCache.ts` JSDoc). 메타데이터 게이트와 같은 인자라 조회도 5년 계산도 한 번이고,
    // 헤더 칩(레이아웃)도 같은 세션 키라 이 본문 요약과 같은 점수다.
    //
    // **봉을 seed하지 않는다.** 게이지는 서버가 계산한 결과(`useFearGreedFromSymbol` →
    // `getSymbolFearGreedAction`)를 쓰므로 그 결과만 seed한다 — 일봉 500개 + 지표 대신 점수와 최근 2년
    // history라 RSC가 가볍다.
    //
    // 시장 판독은 봉 조회와 독립이라 병렬로 받는다. 허브의 1h 캐시를 직접 읽으면 이 탭이 1h로
    // clamp되므로 세션 키 24h 캐시로 감싼 로더를 읽고, 실패는 그 안에서 `null`로 삼킨다.
    const [quantizedFgBars, marketReading] = await Promise.all([
        getSessionBarsStatic(
            ticker,
            marketProfileOf(assetInfo),
            assetInfo.fmpSymbol
        ).catch((e: unknown): BarsData | null => {
            console.error('[FearGreedPage] getSessionBarsStatic failed:', e);
            return null;
        }),
        getMarketFearGreedReading(marketProfile),
    ]);
    const fearGreedInput =
        quantizedFgBars === null
            ? null
            : symbolFearGreedInputs(quantizedFgBars);
    if (quantizedFgBars === null) {
        // 봉 조회 실패 — 게이지는 seed 없이 브라우저에서 조회하고(`hasSeed`), 요약 문단도 빠진다. 이
        // degraded 렌더가 24h 굳지 않게 5분으로 낮춘다. `getSessionBarsStatic`은 큐레이션 종목에서만
        // 낮추므로 롱테일의 빈 게이지가 하루 동안 남는 것을 여기서 막는다.
        await shortenRevalidateForRuntimeDegrade();
    } else {
        // updatedAt 명시(AP-2): 기본값 Date.now()는 재생성마다 HTML을 바꾼다. 마지막 완료 봉의 시각으로
        // 고정한다(Bar.time은 초, dataUpdatedAt은 밀리초).
        const lastBarSec = quantizedFgBars.bars.at(-1)?.time ?? 0;
        queryClient.setQueryData(
            QUERY_KEYS.symbolFearGreed(segment, assetInfo.fmpSymbol),
            clientSymbolFearGreed(quantizedFgBars),
            { updatedAt: lastBarSec * MS_PER_SECOND }
        );
    }

    // `dateModified`는 마지막 점수 봉의 세션 마감 — sitemap `lastmod`와 같은 정의다
    // (`fearGreedDateModified`). 점수가 없으면 신선도를 주장하지 않는다(필드 생략).
    const lastScoredDate =
        quantizedFgBars === null
            ? undefined
            : lastScoredDateFromBars(quantizedFgBars);
    const webPageJsonLd = buildSymbolWebPageJsonLd({
        url,
        name: fullTitle,
        description,
        about: aboutNode,
        locale,
        generatedAt:
            lastScoredDate === undefined
                ? null
                : fearGreedDateModified(lastScoredDate, marketProfile),
    });

    return (
        <>
            <JsonLd data={webPageJsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
                <SymbolPageHeading>
                    {t('page.6cd32e', { v0: displayName })}
                </SymbolPageHeading>
                {/* 지표 일반 설명은 사이트 단위 `/fear-greed` 허브가 맡고, 이 문단이 종목이 속한 시장의
                    허브로 보낸다(종목명만 바뀌는 FAQ는 두지 않는다 — 공통 문장 비중을 끌어올린다). */}
                <p className="text-sm leading-relaxed text-secondary-400">
                    {t.rich('page.ddc932', {
                        v0: marketFearGreedLink.marketLabel(t),
                        v1: marketFearGreedLink.label(t),
                        v2: displayName,
                        link: chunks => (
                            <Link
                                href={marketFearGreedLink.href}
                                className="text-primary-400 underline-offset-4 hover:text-primary-300 hover:underline"
                            >
                                {chunks}
                            </Link>
                        ),
                    })}
                </p>
                {/* 게이지를 먼저 보여준다 — 사용자는 점수를 보러 왔고, 서버 계산 요약은
                    그 아래에서 근거를 풀어 쓴다. 게이지·칩·그룹도 아래 seed로 SSR된다
                    (하이드레이션 게이트 없음 — `FearGreedPage` 본문 주석). */}
                <HydrationBoundary state={dehydrate(queryClient)}>
                    <ErrorBoundary FallbackComponent={FearGreedPageError}>
                        <FearGreedPage
                            symbol={ticker}
                            fmpSymbol={assetInfo.fmpSymbol}
                            displayName={displayName}
                            hasSeed={quantizedFgBars !== null}
                            // 아래 `FearGreedFactsSummary`가 같은 경고 문구와 표본 수
                            // 안내를 이미 서버 렌더한다 — 둘 다 그리면 중복이다.
                            hideSelfNormWarning
                            hideSampleFooter
                        />
                    </ErrorBoundary>
                </HydrationBoundary>
                {/* 서버 계산 factor 요약 — 위 게이지(FearGreedPage)는 점수·그룹 막대만
                    그린다. 여기서 이미 로드된 5년 일봉(`symbolFearGreedInputs`)으로 factor
                    수치와 근거 문장을 SSR HTML에 풀어 쓴다(결정적, AI/pre-warm 무관).
                    사용자에게도 동일하게 보이므로 클로킹 아님. */}
                {fearGreedInput !== null && (
                    <FearGreedFactsSummary
                        symbol={ticker}
                        marketProfile={marketProfile}
                        bars={fearGreedInput.bars}
                        buySellVolume={fearGreedInput.buySellVolume}
                        market={
                            marketReading === null
                                ? null
                                : {
                                      reading: marketReading,
                                      label: marketFearGreedLink.marketLabel(t),
                                  }
                        }
                    />
                )}
                <CrossLinkCards
                    symbol={ticker}
                    current="fear-greed"
                    marketProfile={marketProfile}
                    indexableOnly
                />
            </main>
        </>
    );
}
