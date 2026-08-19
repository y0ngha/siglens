import { getTranslations } from 'next-intl/server';
import { FearGreedPage } from '@/widgets/fear-greed/FearGreedPage';
import { setRequestLocale } from 'next-intl/server';
import { DEFAULT_LOCALE, isLocale } from '@/shared/i18n/locales';
import { getBlockedSymbolMetadata } from '@/app/[locale]/[symbol]/symbolIndexabilityMetadata';
import { ErrorBoundary } from 'react-error-boundary';
import { FearGreedPageError } from '@/widgets/fear-greed';
import { FearGreedFactsSummary, SymbolPageHeading } from '@/views/symbol';
import { CrossLinkCards } from '@/shared/ui/CrossLinkCards';
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
import { getQuantizedBarsStatic } from '@/entities/bars';
import { getDescriptor, marketProfileOf } from '@/shared/config/marketProfile';
import { QUERY_KEYS, QUERY_STALE_TIME_MS } from '@/shared/config/queryConfig';
import { MS_PER_SECOND } from '@/shared/config/time';
import {
    buildBreadcrumbJsonLd,
    buildSymbolSeoContent,
    buildSymbolWebPageJsonLd,
    resolveSymbolFearGreedSeoContent,
    symbolMetadataFromSeo,
    NOINDEX_SYMBOL_METADATA,
} from '@/shared/lib/seo';
import {
    dehydrate,
    HydrationBoundary,
    QueryClient,
} from '@tanstack/react-query';
import type { BarsData } from '@y0ngha/siglens-core';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';

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

export const revalidate = 86400; // 24h — SSR은 정적 가이드뿐(점수는 클라가 bars로 계산)

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
    const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
    const ticker = symbol.toUpperCase();
    // 본문 notFound()와 일관: 잘못된 ticker는 메타데이터를 비우고 noindex로 응답한다.
    if (!isAdmissibleSymbolShape(ticker)) {
        return NOINDEX_SYMBOL_METADATA;
    }
    const { assetInfo, degraded } = await getAssetInfoResilient(ticker);
    const blockedMetadata = await getBlockedSymbolMetadata({
        locale,
        symbol: ticker,
        assetInfo,
        degraded,
        revalidateSeconds: revalidate,
    });
    if (blockedMetadata) return blockedMetadata;
    if (!assetInfo) return NOINDEX_SYMBOL_METADATA;

    const displayName = buildDisplayName(assetInfo, ticker);
    const assetClass = getDescriptor(marketProfileOf(assetInfo)).assetClass;
    const seo = resolveSymbolFearGreedSeoContent(ticker, assetClass, {
        displayName,
        koreanName: assetInfo.koreanName,
    });
    return symbolMetadataFromSeo(seo, locale);
}

export default async function SymbolFearGreedPage({ params }: Props) {
    const { locale, symbol } = await params;
    // 정적 렌더 활성화. 이 호출이 없으면 next-intl의 서버 API가 `headers()`로
    // 폴백해 **이 라우트의 ISR이 통째로 꺼진다**(빌드 route 표에서 `●` → `ƒ`).
    // 실측으로 확인했다 — Next 16.2는 `next/root-params` 미지원이라 이 경로가 유일하다.
    setRequestLocale(locale);
    const t = await getTranslations('app.symbol');
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
        { name: ticker, url: buildSymbolSeoContent(ticker).url },
        { name: t('page.f9482c'), url },
    ]);

    const faqJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
            {
                '@type': 'Question',
                name: `${displayName} 공포 탐욕 지수는 무엇을 측정하나요?`,
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: `${displayName} 한 종목의 단기 매매 심리를 0~100 점수로 측정합니다. CNN의 시장 전체 Fear & Greed Index와 달리 종목별 자체 분포(self-normalization)로 산출하므로, 다른 종목과 점수를 직접 비교하기보다는 같은 종목의 시간 흐름 변화를 보는 데 적합합니다.`,
                },
            },
            {
                '@type': 'Question',
                name: t('page.7fcfc0'),
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: t('page.7ed747'),
                },
            },
            {
                '@type': 'Question',
                name: t('page.dc8a6d'),
                acceptedAnswer: {
                    '@type': 'Answer',
                    // FAQ JSON-LD는 경계값 상수 변경에 따른 schema 회귀를 막기 위해
                    // 구체 숫자(0~25, 25~45 등) 대신 질적 표현으로만 정리한다.
                    // 실제 경계값은 페이지 본문 가이드(공포 탐욕 지수 가이드 섹션)에서 노출.
                    text: t('page.094886'),
                },
            },
        ],
    };

    const queryClient = new QueryClient({
        defaultOptions: { queries: { staleTime: QUERY_STALE_TIME_MS } },
    });
    queryClient.setQueryData(QUERY_KEYS.assetInfo(symbol), assetInfo, {
        updatedAt: 0,
    });
    // layout.tsx와 같은 인자(대문자 ticker)로 호출 — 요청 스코프 메모가 접혀야
    // 지표가 한 벌만 직렬화된다(getQuantizedBarsStatic JSDoc).
    const quantizedFromHelper = await getQuantizedBarsStatic(
        ticker,
        DEFAULT_TIMEFRAME,
        marketProfileOf(assetInfo),
        assetInfo.fmpSymbol
    ).catch((e: unknown) => {
        console.error('[FearGreedPage] getQuantizedBarsStatic failed:', e);
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
                    {displayName} {t('page.784707')}
                </SymbolPageHeading>
                <section className="sr-only">
                    <h2>
                        {displayName} {t('page.8fe673')}
                    </h2>
                    <p>
                        {displayName}
                        {t('page.6d13a8')}
                    </p>
                </section>
                <section
                    aria-labelledby="fear-greed-guide-heading"
                    className="space-y-3 rounded-lg border border-secondary-800 bg-secondary-800/30 p-5"
                >
                    <h2
                        id="fear-greed-guide-heading"
                        className="text-base font-semibold text-secondary-300"
                    >
                        {displayName} {t('page.1f6e4c')}
                    </h2>
                    <p className="text-sm leading-relaxed text-secondary-400">
                        {displayName} {t('page.70235a')}{' '}
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
                        {t('page.719df0')} {marketFearGreedLink.marketLabel}{' '}
                        {t('page.652c52')}
                    </p>
                    <p className="text-sm leading-relaxed text-secondary-400">
                        {t('page.348851')}
                    </p>
                    <p className="text-sm leading-relaxed text-secondary-400">
                        {t('page.e8075f')}
                    </p>
                </section>
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
