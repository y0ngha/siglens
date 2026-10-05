import { getTranslations } from 'next-intl/server';
import { FearGreedPage } from '@/widgets/fear-greed/FearGreedPage';
import { resolveLocale } from '@/shared/i18n/locales';
import { getBlockedSymbolMetadata } from '@/app/[locale]/[symbol]/symbolIndexabilityMetadata';
import { ErrorBoundary } from 'react-error-boundary';
import { FearGreedPageError } from '@/widgets/fear-greed/FearGreedPageError';
import { FearGreedFactsSummary } from '@/views/symbol/fearGreed/FearGreedFactsSummary';
import { hasFearGreedScore } from '@/views/symbol/fearGreed/utils/hasFearGreedScore';
import { SymbolPageHeading } from '@/views/symbol/ui/SymbolPageHeading';
import { CrossLinkCards } from '@/shared/ui/CrossLinkCards';
import { JsonLd } from '@/shared/ui/JsonLd';
import { DEFAULT_TIMEFRAME, SymbolRouteParams } from '@/shared/config/market';
import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
import { isUnresolvableDegraded } from '@/shared/lib/symbolGuard';
import { buildAssetAboutNode } from '@/entities/ticker/lib/assetClassification';
import { buildDisplayName, pickAssetName } from '@/entities/ticker/lib/ticker';
import { getAssetInfoResilient } from '@/entities/ticker/lib/getAssetInfoResilient';
import { getSeedBarsStatic } from '@/entities/bars/lib/barsStaticCache';
import { getMarketFearGreedReading } from '@/entities/market-fear-greed/api/marketFearGreedReading';
import {
    getDescriptor,
    marketProfileOf,
} from '@/shared/config/marketProfile/registry';
import { QUERY_KEYS, QUERY_STALE_TIME_MS } from '@/shared/config/queryConfig';
import { assetInfoSeedUpdatedAt } from '@/shared/config/assetInfoSeed';
import { MS_PER_SECOND } from '@/shared/config/time';
import {
    buildBreadcrumbJsonLd,
    buildSymbolSeoContent,
    resolveSymbolFearGreedSeoContent,
    symbolMetadataFromSeo,
    NOINDEX_SYMBOL_METADATA,
    noindexSymbolMetadata,
} from '@/shared/lib/seo';
import { buildSymbolWebPageJsonLd } from '@/app/[locale]/[symbol]/symbolWebPageJsonLd';
import {
    dehydrate,
    HydrationBoundary,
    QueryClient,
} from '@tanstack/react-query';
import type { BarsData } from '@y0ngha/siglens-core';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { enterLocale } from '@/shared/lib/enterLocale';

// 종목당 SEO 콘텐츠는 고정이고 동적 데이터는 클라가 재hydrate한다. 엣지 캐시로
// compute 호출을 줄인다. (일시 인프라 장애의 404 캐싱은 getAssetInfo strict로 차단)
/**
 * 종목이 속한 시장의 상위 공포·탐욕 지수 링크.
 *
 * 암호화폐는 예전에 전용 시장 지수가 없어 미국 페이지를 가리켰다. 이제
 * `/fear-greed/crypto`가 있으므로 세 시장 모두 자기 지수로 간다.
 */
/**
 * 라벨은 **카탈로그 키**로 들고 있는다. 문자열을 그대로 두면 영어 페이지에서도
 * 한국어 링크 문구와 한국어 시장명이 그대로 나간다(`/en/AAPL/fear-greed`에서
 * "시장 전체 공포·탐욕 지수"가 영어 문장 한가운데 박혀 있었다).
 */
const MARKET_FEAR_GREED_LINK: Record<
    ReturnType<typeof marketProfileOf>,
    { href: string; labelKey: string; marketLabelKey: string }
> = {
    'us-equity': {
        href: '/fear-greed',
        labelKey: 'page.marketFearGreedLinkAll',
        marketLabelKey: 'page.marketLabelUs',
    },
    'kr-equity': {
        href: '/fear-greed/kr',
        labelKey: 'page.marketFearGreedLinkKr',
        marketLabelKey: 'page.marketLabelKr',
    },
    crypto: {
        href: '/fear-greed/crypto',
        labelKey: 'page.marketFearGreedLinkCrypto',
        marketLabelKey: 'page.marketLabelCrypto',
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
    params: Promise<{ locale: string; symbol: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale: rawLocale, symbol } = await params;
    const locale = resolveLocale(rawLocale);
    const tSeo = await getTranslations({ locale, namespace: 'shared.seo' });
    const ticker = symbol.toUpperCase();
    // 본문 notFound()와 일관: 잘못된 ticker는 메타데이터를 비우고 noindex로 응답한다.
    if (!isAdmissibleSymbolShape(ticker)) {
        return NOINDEX_SYMBOL_METADATA;
    }
    const { assetInfo, degraded } = await getAssetInfoResilient(ticker);
    // 콘텐츠 게이트 — 본문의 `FearGreedFactsSummary`와 **같은 입력·같은 술어**
    // (`hasFearGreedScore`)로 판정한다(MISTAKES §2). 본문이 쓰는 `getSeedBarsStatic`과
    // 같은 인자라 요청 스코프 메모가 접혀 왕복이 늘지 않는다. 차트 라우트
    // (`[symbol]/page.tsx`)와 같은 모양이다:
    //   - 조회 **실패**(`null`) → degraded로 넘긴다. 이 탭에는 스냅샷이 없으므로
    //     (`tab: 'fear-greed'`는 제목 카피용이라 스냅샷을 읽지 않는다) degraded는 곧
    //     noindex — 장애 중 빈 껍데기가 색인되지 않는다.
    //   - 조회는 됐는데 **점수가 안 나오면**(봉 부족·점수 표본 부족, 상장폐지·신규
    //     상장 종목 등) 요약이 그려지지 않아 본문이 도입 문단뿐이다 → `no-price-data`로
    //     noindex. 예전에는 `buildTechnicalFacts`(봉 2개 이상)로 판정해 봉은 있으나
    //     점수가 없는 종목(`/TOSCF`·`/SLROF`, 2026-10-04)이 색인돼 있었다.
    const metadataBars = assetInfo
        ? await getSeedBarsStatic(
              ticker,
              DEFAULT_TIMEFRAME,
              marketProfileOf(assetInfo),
              assetInfo.fmpSymbol
          ).catch((e: unknown) => {
              console.error(
                  '[SymbolFearGreedPage] generateMetadata getSeedBarsStatic failed:',
                  e
              );
              return null;
          })
        : null;
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
    if (!assetInfo) return noindexSymbolMetadata(ticker, tSeo, locale);

    const displayName = buildDisplayName(assetInfo, ticker, locale);
    const assetClass = getDescriptor(marketProfileOf(assetInfo)).assetClass;
    const seo = resolveSymbolFearGreedSeoContent(ticker, assetClass, tSeo, {
        displayName,
        koreanName: assetInfo.koreanName,
        englishName: assetInfo.name,
        locale,
    });
    /*
     * 종목별 공포·탐욕 탭은 **색인한다** (2026-10-01 사용자 결정,
     * `SEO_RECOVERY_2026_09.md` §10).
     *
     * 2026-09-17 운영 렌더 감사는 이 탭을 항상 noindex로 돌렸다 — 본문의 92%(중앙값)가
     * 숫자만 바뀌는 공통 문장이었다(차트 30%, 뉴스 26%). 그 판단을 되돌리는 근거는
     * **수요**다: 2026-06에 실제 클릭을 만든 것은 거의 전부 이 탭의 롱테일이었고,
     * 노출 회복 전략이 "산문 있는 탭만 색인"으로 좁혀 둔 뒤 그 수요를 받을 페이지가
     * 사라졌다. 대신 템플릿 비중을 낮추려고 같은 날 종목 탭 FAQ를 걷어냈고(FAQ는
     * 이 페이지 공통 문장의 큰 덩어리였다), 다른 탭 다섯 개를 noindex로 빼 종목당
     * 색인 페이지를 세 개(차트·뉴스·공포탐욕)로 줄였다.
     *
     * 되돌림 신호: GSC `크롤링됨-현재 색인 생성되지 않음`에 `/fear-greed` URL이
     * 쌓이거나, 사이트 평균 게재순위가 나빠지면 이 탭을 다시 noindex로 돌린다.
     */
    return symbolMetadataFromSeo(seo, locale);
}

export default async function SymbolFearGreedPage({ params }: Props) {
    const { locale: rawLocale, symbol } = await params;
    const locale = enterLocale(rawLocale);
    const t = await getTranslations('app.symbol');
    const tSeo = await getTranslations('shared.seo');
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

    // about 노드는 stock으로 분류된 경우만 채워지고, ETF/Index/모호한 종목과 crypto는
    // undefined로 자연 생략된다. crypto는 schema.org 표준 타입이 없어 about 노드 자체를 두지 않는다.
    const aboutNode = buildAssetAboutNode(
        ticker,
        pickAssetName(assetInfo, ticker, locale),
        assetInfo.fmpSymbol,
        assetClass
    );
    const webPageJsonLd = buildSymbolWebPageJsonLd({
        url,
        name: fullTitle,
        description,
        about: aboutNode,
        locale,
    });

    const breadcrumbJsonLd = buildBreadcrumbJsonLd(
        [
            { name: displayName, url: buildSymbolSeoContent(ticker, tSeo).url },
            { name: t('page.f9482c'), url },
        ],
        locale
    );

    const queryClient = new QueryClient({
        defaultOptions: { queries: { staleTime: QUERY_STALE_TIME_MS } },
    });
    queryClient.setQueryData(QUERY_KEYS.assetInfo(symbol), assetInfo, {
        updatedAt: assetInfoSeedUpdatedAt(degraded),
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
    // 시장 판독은 봉 조회와 독립이라 병렬로 받는다. 시장 허브와 같은 정적 캐시를 읽으며,
    // 실패는 `getMarketFearGreedReading` 안에서 `null`로 삼킨다(보조 문장 하나뿐이다).
    const [quantizedFromHelper, marketReading] = await Promise.all([
        getSeedBarsStatic(
            ticker,
            DEFAULT_TIMEFRAME,
            marketProfileOf(assetInfo),
            assetInfo.fmpSymbol
        ).catch((e: unknown) => {
            console.error('[FearGreedPage] getSeedBarsStatic failed:', e);
            return null;
        }),
        getMarketFearGreedReading(marketProfile),
    ]);
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

    // 요약 여부는 `FearGreedFactsSummary`가 정한다(점수가 없으면 null). 게이트의
    // `hasFearGreedScore`와 같은 core 계산·같은 입력이라 색인과 화면이 갈리지 않는다.

    return (
        <>
            <JsonLd data={webPageJsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
                <SymbolPageHeading>
                    {t('page.6cd32e', { v0: displayName })}
                </SymbolPageHeading>
                {/* 종목 탭 FAQ(지표 설명 3문항)는 2026-10-01에 걷어냈다 — 종목명만
                    바뀌는 템플릿이라 이 탭의 공통 문장 비율(92%)을 끌어올리던 덩어리였다
                    (`SEO_RECOVERY_2026_09.md` §10). 지표 일반 설명은 사이트 단위
                    `/fear-greed` 허브가 맡고, 아래 문단이 그 허브로 보낸다. */}
                <p className="text-sm leading-relaxed text-secondary-400">
                    {/* 상위 지수 링크는 이 종목이 속한 시장을 가리켜야 한다.
                        `/fear-greed/kr`이 생기기 전에는 둘 다 미국뿐이라
                        하드코딩이 맞았지만, 지금은 한국 종목 페이지가
                        "미국 증시 전반"을 참조하게 된다. */}
                    {t.rich('page.4e7e6f', {
                        v0: t(marketFearGreedLink.marketLabelKey),
                        v1: t(marketFearGreedLink.labelKey),
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
                {/* 서버 계산 factor 요약 — crawler는 JS 미실행이라 아래 클라 게이지
                    (FearGreedPage)의 점수·factor 수치를 절대 못 본다. 여기서
                    이미 로드된 quantizedFgBars(bars+indicators)로 동일 수치를
                    SSR HTML에 박아 크롤 가능하게 한다(결정적, AI/pre-warm 무관).
                    사용자에게도 동일하게 보이므로 클로킹 아님. */}
                {quantizedFgBars !== null && (
                    <FearGreedFactsSummary
                        symbol={ticker}
                        marketProfile={marketProfile}
                        bars={quantizedFgBars.bars}
                        buySellVolume={quantizedFgBars.indicators.buySellVolume}
                        market={
                            marketReading === null
                                ? null
                                : {
                                      reading: marketReading,
                                      label: t(
                                          marketFearGreedLink.marketLabelKey
                                      ),
                                  }
                        }
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
                <CrossLinkCards
                    symbol={ticker}
                    current="fear-greed"
                    marketProfile={marketProfile}
                />
            </main>
        </>
    );
}
