import { OverallContent } from '@/components/overall/OverallContent';
import { CrossLinkCards } from '@/components/symbol-page/CrossLinkCards';
import { JsonLd } from '@/components/ui/JsonLd';
import {
    DEFAULT_TIMEFRAME,
    isValidTimeframe,
    VALID_TICKER_RE,
} from '@/domain/constants/market';
import { buildDisplayName } from '@/domain/ticker';
import { getAssetInfoCached } from '@/infrastructure/ticker/getAssetInfoCached';
import {
    buildBreadcrumbJsonLd,
    buildSymbolOverallSeoContent,
    buildSymbolSeoContent,
    SITE_NAME,
} from '@/lib/seo';
import type { Timeframe } from '@y0ngha/siglens-core';
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
    const upper = symbol.toUpperCase();
    // 본문 notFound()와 일관: 잘못된 ticker는 메타데이터를 비우고 noindex로 응답한다.
    if (!VALID_TICKER_RE.test(upper)) {
        return { robots: { index: false, follow: false } };
    }
    const assetInfo = await getAssetInfoCached(upper);
    const displayName = assetInfo ? buildDisplayName(assetInfo, upper) : upper;
    const { title, fullTitle, description, url, keywords } =
        buildSymbolOverallSeoContent(upper, {
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

// `?tf=` is read into a Client prop; canonical URL excludes it so search engines see one URL per page.
export default async function OverallPage({ params, searchParams }: Props) {
    const { symbol } = await params;
    const upper = symbol.toUpperCase();

    if (!VALID_TICKER_RE.test(upper)) {
        notFound();
    }

    const assetInfo = await getAssetInfoCached(upper);
    if (!assetInfo) {
        notFound();
    }

    const { tf } = await searchParams;
    const timeframe: Timeframe = isValidTimeframe(tf) ? tf : DEFAULT_TIMEFRAME;

    const displayName = buildDisplayName(assetInfo, upper);
    const { fullTitle, description, url } = buildSymbolOverallSeoContent(
        upper,
        {
            displayName,
            koreanName: assetInfo.koreanName,
        }
    );

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

    const breadcrumbJsonLd = buildBreadcrumbJsonLd([
        { name: upper, url: buildSymbolSeoContent(upper).url },
        { name: 'AI 종합 분석', url: buildSymbolOverallSeoContent(upper).url },
    ]);

    const faqJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
            {
                '@type': 'Question',
                name: `${displayName} 종합 분석에서는 어떤 축을 같이 보나요?`,
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: `${displayName} 주가의 차트 추세, 분기 실적과 펀더멘털, 최근 뉴스 분위기, 그리고 단기 매수 분위기(공포 탐욕 지수)까지 네 축을 묶어 강세와 약세 시나리오, 진입을 고려할 만한 가격대, 시나리오가 깨지는 위험 요인을 함께 정리합니다.`,
                },
            },
            {
                '@type': 'Question',
                name: '강세 시나리오와 약세 시나리오는 어떤 기준으로 나뉘나요?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: '차트 추세, 실적과 가이던스 흐름, 뉴스 분위기, 단기 매수세를 종합해 상승 압력이 우세한지 하방 압력이 우세한지 판단합니다. 각 시나리오마다 어떤 가격대에서 진입을 고려할 만한지, 어떤 신호가 나오면 시나리오가 깨지는지를 같이 정리합니다.',
                },
            },
            {
                '@type': 'Question',
                name: '어떤 신호가 나오면 시나리오가 깨졌다고 봐야 하나요?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: '실적 발표 결과나 가이던스 변화, 매크로 이벤트, 분위기 급반전 같은 위험 요인이 시나리오 판단의 핵심 가정과 어긋나면 시나리오가 깨졌다고 봅니다. 위험 요인 항목에 따로 표시되어 있어 매수 전에 한 번 확인하기 좋습니다.',
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
                <h1 className="sr-only">
                    {displayName} 차트와 실적, 뉴스, 공포 탐욕 지수 종합 분석
                </h1>
                <section className="sr-only">
                    <h2>{displayName} AI 종합 분석 개요</h2>
                    <p>
                        {displayName}의 AI 종합 분석. 기술적 분석, 펀더멘털,
                        뉴스, 옵션, 공포 탐욕 지수의 5축을 통합한 결론과
                        강세·약세 시나리오, 위험 요인을 정리합니다.
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
                    <p className="text-secondary-400 text-sm leading-relaxed">
                        {displayName} 주가가 지금 어디쯤 와 있는지 한 페이지에서
                        정리해 봅니다. 차트의 추세와 주요 지지선과 저항선, 분기
                        실적 흐름, 최근 뉴스에서 시장이 무엇에 반응하고 있는지,
                        그리고 단기 매수 분위기까지 네 가지 축을 같이
                        살펴봅니다.
                    </p>
                    <p className="text-secondary-400 text-sm leading-relaxed">
                        네 축을 합쳐 강세와 약세 시나리오를 각각 정리하고, 어떤
                        가격대에서 진입을 고려해 볼 만한지, 어떤 신호가 나오면
                        시나리오가 깨지는지를 함께 짚습니다.
                    </p>
                    <p className="text-secondary-400 text-sm leading-relaxed">
                        실적 발표, 가이던스 변화, 매크로 이벤트처럼 시나리오를
                        뒤집을 수 있는 위험 요인도 따로 표시해 두니, 매수 전에
                        한 번 훑어보면 도움이 됩니다.
                    </p>
                </section>
                <OverallContent
                    symbol={upper}
                    companyName={assetInfo.name}
                    timeframe={timeframe}
                />
                <CrossLinkCards symbol={upper} current="overall" />
            </main>
        </>
    );
}
