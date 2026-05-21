import { FearGreedPage } from '@/components/fear-greed/FearGreedPage';
import { CrossLinkCards } from '@/components/symbol-page/CrossLinkCards';
import { JsonLd } from '@/components/ui/JsonLd';
import { DEFAULT_TIMEFRAME, VALID_TICKER_RE } from '@/domain/constants/market';
import { FEAR_GREED_SCORE_BOUNDARIES } from '@/domain/fearGreed/classifier';
import { buildDisplayName } from '@/domain/ticker';
import { getBarsAction } from '@/infrastructure/market/getBarsAction';
import { getAssetInfoCached } from '@/infrastructure/ticker/getAssetInfoCached';
import { QUERY_KEYS, QUERY_STALE_TIME_MS } from '@/lib/queryConfig';
import {
    buildBreadcrumbJsonLd,
    buildSymbolFearGreedSeoContent,
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
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { symbol } = await params;
    const ticker = symbol.toUpperCase();
    const assetInfo = await getAssetInfoCached(ticker);
    const displayName = assetInfo
        ? buildDisplayName(assetInfo, ticker)
        : ticker;
    const { title, fullTitle, description, url, keywords } =
        buildSymbolFearGreedSeoContent(ticker, {
            displayName,
            koreanName: assetInfo?.koreanName,
        });
    return {
        title,
        description,
        keywords,
        alternates: { canonical: url },
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

export default async function SymbolFearGreedPage({ params }: Props) {
    const { symbol } = await params;
    const ticker = symbol.toUpperCase();

    if (!VALID_TICKER_RE.test(ticker)) {
        notFound();
    }

    const assetInfo = await getAssetInfoCached(ticker);
    if (!assetInfo) {
        notFound();
    }

    const displayName = buildDisplayName(assetInfo, ticker);

    const { fullTitle, description, url } = buildSymbolFearGreedSeoContent(
        ticker,
        {
            displayName,
            koreanName: assetInfo.koreanName,
        }
    );

    // `about` block intentionally omitted: hardcoding `@type: 'Corporation'`
    // misrepresents ETF/Index tickers (e.g. SPY, QQQ, SPXUSD). Re-adding it
    // requires an AssetInfo discriminator that distinguishes Stock/ETF/Index.
    const webPageJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: fullTitle,
        description,
        url,
        inLanguage: 'ko',
    };

    const breadcrumbJsonLd = buildBreadcrumbJsonLd([
        { name: ticker, url: buildSymbolSeoContent(ticker).url },
        { name: '공포 탐욕 지수', url },
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
                    text: `${displayName}(${ticker}) 한 종목의 단기 매매 심리를 0~100 점수로 측정합니다. CNN의 시장 전체 Fear & Greed Index와 달리 종목별 자체 분포(self-normalization)로 산출하므로, 다른 종목과 점수를 직접 비교하기보다는 같은 종목의 시간 흐름 변화를 보는 데 적합합니다.`,
                },
            },
            {
                '@type': 'Question',
                name: '점수는 어떤 5가지 요인으로 계산되나요?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Volume z-score, Buy/Sell volume 불균형, Volume Profile POC 거리, MA200 이격, 52주 최고가 대비 위치 — 5개 factor 각각을 200영업일 분포 안에서 percentile로 환산한 뒤 가중 평균합니다. 각 factor가 Flow 그룹과 Trend 그룹으로 묶여 별도 점수로도 표시됩니다.',
                },
            },
            {
                '@type': 'Question',
                name: '5단계 분위기 라벨은 어떻게 구분되나요?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: `0~${FEAR_GREED_SCORE_BOUNDARIES.EXTREME_FEAR_MAX} 극심한 공포, ${FEAR_GREED_SCORE_BOUNDARIES.EXTREME_FEAR_MAX}~${FEAR_GREED_SCORE_BOUNDARIES.FEAR_MAX} 공포, ${FEAR_GREED_SCORE_BOUNDARIES.FEAR_MAX}~${FEAR_GREED_SCORE_BOUNDARIES.NEUTRAL_MAX} 중립, ${FEAR_GREED_SCORE_BOUNDARIES.NEUTRAL_MAX}~${FEAR_GREED_SCORE_BOUNDARIES.GREED_MAX} 탐욕, ${FEAR_GREED_SCORE_BOUNDARIES.GREED_MAX}~100 극심한 탐욕입니다. 표본 수가 60일 미만이면 신뢰도 "제한"으로 표시되며, 라벨은 데이터가 더 쌓인 뒤 다시 확인하는 게 안전합니다.`,
                },
            },
        ],
    };

    const queryClient = new QueryClient({
        defaultOptions: { queries: { staleTime: QUERY_STALE_TIME_MS } },
    });
    queryClient.setQueryData(QUERY_KEYS.assetInfo(ticker), assetInfo);
    await queryClient.prefetchQuery({
        queryKey: QUERY_KEYS.bars(ticker, DEFAULT_TIMEFRAME),
        queryFn: () =>
            getBarsAction(ticker, DEFAULT_TIMEFRAME, assetInfo.fmpSymbol),
    });

    return (
        <>
            <JsonLd data={webPageJsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <JsonLd data={faqJsonLd} />
            <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
                <h1 className="sr-only">
                    {displayName} ({ticker}) 공포 탐욕 지수와 단기 매수 분위기
                </h1>
                <section
                    aria-labelledby="fear-greed-guide-heading"
                    className="border-secondary-800 bg-secondary-800/30 space-y-3 rounded-lg border p-5"
                >
                    <h2
                        id="fear-greed-guide-heading"
                        className="text-secondary-300 text-base font-semibold"
                    >
                        {displayName} 공포 탐욕 지수는 어떻게 봐야 할까
                    </h2>
                    <p className="text-secondary-400 text-sm leading-relaxed">
                        {displayName}({ticker}) 한 종목의 단기 매매 심리를 0~100
                        점수로 나타냅니다. CNN의 시장 전체 Fear &amp; Greed
                        Index가 여러 자산을 합쳐 시장 감정을 보여 준다면, 이
                        페이지는 한 종목의 거래량 흐름과 체결 흐름, 가격 위치를
                        그 종목의 자체 분포 안에서 환산해 점수로 만듭니다.
                    </p>
                    <p className="text-secondary-400 text-sm leading-relaxed">
                        Volume z-score, Buy/Sell volume 불균형, Volume Profile
                        POC 거리, MA200 이격, 52주 최고가 대비 위치 — 5개
                        factor를 200 영업일 분포 안에서 percentile로 환산한 뒤
                        가중 평균합니다. Flow 그룹과 Trend 그룹으로 나뉘어 어느
                        축이 점수를 끌고 있는지도 같이 볼 수 있습니다.
                    </p>
                    <p className="text-secondary-400 text-sm leading-relaxed">
                        종목별 자체 분포로 산출하므로 다른 종목과 점수를 직접
                        비교하기보다는, 같은 종목의 시간 흐름 변화를 추적하는 데
                        적합합니다. 표본이 60일 미만일 때는 신뢰도
                        &ldquo;제한&rdquo; 배지가 붙으니 참고만 하는 게
                        안전합니다.
                    </p>
                </section>
                <HydrationBoundary state={dehydrate(queryClient)}>
                    <FearGreedPage
                        symbol={ticker}
                        fmpSymbol={assetInfo.fmpSymbol}
                    />
                </HydrationBoundary>
                <CrossLinkCards symbol={ticker} current="fear-greed" />
            </main>
        </>
    );
}
