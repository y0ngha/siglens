import { OptionsPageClient } from '@/components/options/OptionsPageClient';
import { OptionsEmptyState } from '@/components/options/OptionsEmptyState';
import { JsonLd } from '@/components/ui/JsonLd';
import { VALID_TICKER_RE } from '@/domain/constants/market';
import { buildDisplayName } from '@/domain/ticker';
import { getAssetInfoCached } from '@/infrastructure/ticker/getAssetInfoCached';
import { mapExpirationsToSlots } from '@y0ngha/siglens-core';
import {
    fetchOptionsSnapshot,
    hasOptionsMarket,
} from '@/infrastructure/options/optionsDataCache';
import { QUERY_KEYS, QUERY_STALE_TIME_MS } from '@/lib/queryConfig';
import {
    buildBreadcrumbJsonLd,
    buildSymbolOptionsSeoContent,
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
    const upper = symbol.toUpperCase();
    const assetInfo = await getAssetInfoCached(upper);
    const displayName = assetInfo ? buildDisplayName(assetInfo, upper) : upper;
    const hasOptions = await hasOptionsMarket(upper);
    const { title, fullTitle, description, url, keywords } =
        buildSymbolOptionsSeoContent(upper, {
            displayName,
            koreanName: assetInfo?.koreanName,
            hasOptions,
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
        ...(hasOptions ? {} : { robots: { index: false, follow: true } }),
    };
}

export default async function OptionsPage({ params }: Props) {
    const { symbol } = await params;
    const upper = symbol.toUpperCase();

    if (!VALID_TICKER_RE.test(upper)) notFound();

    const [assetInfo, hasOptions] = await Promise.all([
        getAssetInfoCached(upper),
        hasOptionsMarket(upper),
    ]);

    if (!assetInfo) notFound();
    if (!hasOptions) return <OptionsEmptyState symbol={upper} />;

    const displayName = buildDisplayName(assetInfo, upper);
    const snapshot = await fetchOptionsSnapshot(upper);
    if (snapshot === null) return <OptionsEmptyState symbol={upper} />;

    const expirations = snapshot.chains.map(c => c.expirationDate);
    const slots = mapExpirationsToSlots(expirations, new Date());

    const queryClient = new QueryClient({
        defaultOptions: { queries: { staleTime: QUERY_STALE_TIME_MS } },
    });
    queryClient.setQueryData(QUERY_KEYS.optionsSnapshot(upper), snapshot);

    const { fullTitle, description, url } = buildSymbolOptionsSeoContent(
        upper,
        {
            displayName,
            koreanName: assetInfo.koreanName,
            hasOptions: true,
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
        { name: upper, url: buildSymbolSeoContent(upper).url },
        { name: '옵션 분석', url },
    ]);

    const faqJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
            {
                '@type': 'Question',
                name: `${displayName} 옵션 시장 분석에서 무엇을 볼 수 있나요?`,
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'AI가 옵션 시장 데이터를 분석해 주요 만기별로 어디에 돈이 쌓이고 있는지, 시장이 어떤 변동성을 예상하는지 한국어로 설명해줍니다. Max Pain, Put/Call Ratio, ATM IV, Implied Move 같은 핵심 지표와 Strike별 OI 분포 차트도 함께 보여줍니다.',
                },
            },
            {
                '@type': 'Question',
                name: 'Max Pain과 Open Interest는 어떻게 해석하나요?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Max Pain은 옵션 만기일이 가까워질 때 주가가 끌리는 가격입니다. Open Interest는 현재 살아있는 옵션 계약 수로, 두꺼운 가격대에 많은 사람이 베팅하고 있다는 뜻입니다.',
                },
            },
            {
                '@type': 'Question',
                name: '제 종목에 옵션이 없으면 어떻게 되나요?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: '옵션 시장이 형성되지 않은 종목은 옵션 분석 페이지에 빈 안내가 표시되며, 차트/펀더멘털/뉴스 같은 다른 분석 페이지로 안내됩니다.',
                },
            },
        ],
    };

    return (
        <>
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <JsonLd data={faqJsonLd} />
            <section className="sr-only">
                <h2>{displayName} 옵션 시장 풍경</h2>
                <p>
                    {displayName} 옵션 시장을 AI가 한국어로 해석합니다. 만기별
                    Max Pain, Put/Call Ratio, ATM IV, Implied Move 등 핵심
                    지표와 Strike별 Open Interest 분포를 함께 살펴볼 수
                    있습니다.
                </p>
            </section>
            <HydrationBoundary state={dehydrate(queryClient)}>
                <OptionsPageClient
                    symbol={upper}
                    companyName={displayName}
                    snapshot={snapshot}
                    slots={slots}
                />
            </HydrationBoundary>
        </>
    );
}
