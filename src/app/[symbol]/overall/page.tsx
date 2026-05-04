import { cache } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
    DEFAULT_TIMEFRAME,
    isValidTimeframe,
    VALID_TICKER_RE,
} from '@/domain/constants/market';
import type { Timeframe } from '@y0ngha/siglens-core';
import { buildDisplayName } from '@/domain/ticker';
import { getAssetInfoAction } from '@/infrastructure/ticker/getAssetInfoAction';
import { OverallContent } from '@/components/overall/OverallContent';
import { CrossLinkCards } from '@/components/symbol-page/CrossLinkCards';
import { JsonLd } from '@/components/ui/JsonLd';
import {
    buildBreadcrumbJsonLd,
    buildSymbolOverallSeoContent,
    SITE_NAME,
} from '@/lib/seo';

// React.cache로 generateMetadata와 page body의 중복 fetch를 동일 render pass 안에서 dedupe.
const getAssetInfoCached = cache(getAssetInfoAction);

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

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: fullTitle,
        description,
        url,
        inLanguage: 'ko',
        about: {
            '@type': 'Corporation',
            name: displayName,
            tickerSymbol: upper,
        },
    };

    const breadcrumbJsonLd = buildBreadcrumbJsonLd([
        { name: upper, url: `/${upper}` },
        { name: 'AI 종합 분석', url: `/${upper}/overall` },
    ]);

    return (
        <>
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
                <h1 className="sr-only">
                    {displayName} 차트·실적·뉴스 종합 분석
                </h1>
                <section className="border-secondary-800 bg-secondary-800/30 space-y-3 rounded-lg border p-5">
                    <h2 className="text-secondary-300 text-base font-semibold">
                        {displayName} 종합 분석은 어떻게 봐야 할까
                    </h2>
                    <p className="text-secondary-400 text-sm leading-relaxed">
                        {displayName} 주가가 지금 어디쯤 와 있는지 한 페이지에서
                        정리해 봅니다. 차트의 추세와 주요 지지·저항, 분기 실적
                        흐름, 그리고 최근 뉴스에서 시장이 무엇에 반응하고 있는지
                        세 가지 축을 같이 살펴봅니다.
                    </p>
                    <p className="text-secondary-400 text-sm leading-relaxed">
                        세 축을 합쳐 강세 시나리오와 약세 시나리오를 각각
                        정리하고, 어떤 가격대에서 진입을 고려해 볼 만한지, 어떤
                        신호가 나오면 시나리오가 깨지는지를 함께 짚습니다.
                    </p>
                    <p className="text-secondary-400 text-sm leading-relaxed">
                        실적 발표, 가이던스 변화, 매크로 이벤트처럼 시나리오를
                        뒤집을 수 있는 위험 요인도 따로 표시해 두니, 매수 전에
                        한 번 훑어보면 도움이 됩니다.
                    </p>
                </section>
                <OverallContent symbol={upper} timeframe={timeframe} />
                <CrossLinkCards symbol={upper} current="overall" />
            </main>
        </>
    );
}
