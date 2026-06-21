import { OptionsPageClient } from '@/widgets/options/OptionsPageClient';
import { SymbolPageHeading } from '@/widgets/symbol-page';
import { OptionsEmptyState } from '@/widgets/options/OptionsEmptyState';
import { JsonLd } from '@/shared/ui/JsonLd';
import {
    SymbolRouteParams,
    isAdmissibleSymbolShape,
} from '@/shared/config/market';
import { isUnresolvableDegraded } from '@/shared/lib/symbolGuard';
import {
    buildAssetAboutNode,
    buildDisplayName,
    getAssetInfoResilient,
} from '@/entities/ticker';
import { mapExpirationsToSlots } from '@y0ngha/siglens-core';
import {
    fetchOptionsSnapshot,
    hasOptionsMarket,
} from '@/entities/options-chain/lib/optionsDataCache';
import { QUERY_KEYS, QUERY_STALE_TIME_MS } from '@/shared/config/queryConfig';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { SECONDS_PER_HALF_DAY } from '@/shared/config/time';
import {
    buildBreadcrumbJsonLd,
    buildSymbolOptionsSeoContent,
    buildSymbolSeoContent,
    NOINDEX_SYMBOL_METADATA,
    SITE_NAME,
    SITE_URL,
} from '@/shared/lib/seo';
import {
    dehydrate,
    HydrationBoundary,
    QueryClient,
} from '@tanstack/react-query';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';

// 종목당 SEO 콘텐츠는 고정이고 동적 데이터는 클라가 재hydrate한다. 엣지 캐시로
// compute 호출을 줄인다. (일시 인프라 장애의 404 캐싱은 getAssetInfo strict로 차단)
export const revalidate = 43200; // 12h — SSR은 만기일뿐(Max Pain/IV/OI는 클라)

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
    const upper = symbol.toUpperCase();
    // 본문 notFound()와 일관: 잘못된 ticker는 메타데이터를 비우고 noindex로 응답한다.
    if (!isAdmissibleSymbolShape(upper)) {
        return NOINDEX_SYMBOL_METADATA;
    }
    const [{ assetInfo, degraded }, hasOptions] = await Promise.all([
        getAssetInfoResilient(upper),
        // hasOptionsMarket는 Yahoo 인프라 실패 시 throw한다. getAssetInfoResilient와
        // 함께 Promise.all로 묶여 있어, 여기서 흡수하지 않으면 throw가 degraded 조기 반환
        // 전에 Promise.all을 reject시켜 generateMetadata가 ISR cold-gen에서 500을 낸다.
        // 옵션 시장 여부를 모르면 false(노출 안 함)로 degrade → noindex로 안전하게 처리한다.
        // (이 fetch는 staticSymbolCache로 감싸져 DSU를 throw하지 않고, DSU가 발생하더라도
        // 같은 Promise.all의 getAssetInfoResilient가 rethrow하므로 제어 흐름은 보존된다.)
        staticSymbolCache(
            ['options:has', upper],
            upper,
            () => hasOptionsMarket(upper),
            [],
            SECONDS_PER_HALF_DAY
        ).catch((e: unknown) => {
            console.error(
                '[generateMetadata:options] hasOptionsMarket infra failure, degrading to false:',
                e
            );
            return false;
        }),
    ]);
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
    const { title, fullTitle, description, url, keywords } =
        buildSymbolOptionsSeoContent(upper, {
            displayName,
            koreanName: assetInfo.koreanName,
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
        // 옵션 없는 종목은 본문 OptionsEmptyState에서 sibling 분석 페이지
        // (차트/펀더멘털/뉴스 등)로 안내하므로, crawler가 그 internal link를
        // 따라갈 수 있도록 follow는 true를 유지한다. noindex이지만 follow:true는
        // "이 페이지는 색인 말고, 링크는 따라가라"는 정확한 의도 표현.
        ...(hasOptions ? {} : { robots: { index: false, follow: true } }),
    };
}

export default async function OptionsPage({ params }: Props) {
    const { symbol } = await params;
    const upper = symbol.toUpperCase();

    if (!isAdmissibleSymbolShape(upper)) notFound();

    // Hard-404 crypto symbols before the hasOptionsMarket call — this tab is equity-only.
    if (!(await isTabAllowedForSymbol(upper, 'options'))) notFound();

    const [{ assetInfo, degraded }, hasOptions] = await Promise.all([
        getAssetInfoResilient(upper),
        staticSymbolCache(
            ['options:has', upper],
            upper,
            () => hasOptionsMarket(upper),
            [],
            SECONDS_PER_HALF_DAY
        ),
    ]);

    // degraded + digit-first 심볼 = 두 데이터 소스가 동시 다운 중이고 resolve 불가
    // → 차트 페이지와 동일한 notFound 처리로 sibling 일관성 유지.
    if (isUnresolvableDegraded(upper, degraded)) notFound();
    if (!assetInfo) notFound();
    if (!hasOptions) return <OptionsEmptyState symbol={upper} />;

    const displayName = buildDisplayName(assetInfo, upper);
    const snapshot = await staticSymbolCache(
        ['options:snapshot', upper],
        upper,
        () => fetchOptionsSnapshot(upper),
        [],
        SECONDS_PER_HALF_DAY
    );
    if (snapshot === null) return <OptionsEmptyState symbol={upper} />;

    const expirations = snapshot.chains.map(c => c.expirationDate);
    const slots = mapExpirationsToSlots(expirations, new Date());

    const queryClient = new QueryClient({
        defaultOptions: { queries: { staleTime: QUERY_STALE_TIME_MS } },
    });
    // updatedAt 명시: RQ dehydrate 기본은 Date.now()라 매 ISR 재생성마다 다른 timestamp가
    // HTML에 박혀 ISR write churn 발생. snapshot의 capturedAt(provider 시점)로 고정 —
    // staticSymbolCache 윈도우 안에서는 동일 snapshot이라 capturedAt도 동일.
    const stableUpdatedAt = new Date(snapshot.capturedAt).getTime();
    queryClient.setQueryData(QUERY_KEYS.optionsSnapshot(upper), snapshot, {
        updatedAt: stableUpdatedAt,
    });

    // hasOptions: true 하드코딩은 의도적 — 위 OptionsEmptyState 분기(line 79, 83)를
    // 통과한 시점이라 옵션 시장이 존재함이 보장된다. generateMetadata와 달리 본문
    // 렌더 경로에서는 false 분기로 빠질 수 없으므로 재조회 없이 상수로 둔다.
    const { fullTitle, description, url } = buildSymbolOptionsSeoContent(
        upper,
        {
            displayName,
            koreanName: assetInfo.koreanName,
            hasOptions: true,
        }
    );

    // about 노드는 stock으로 분류된 경우만 채워지고, ETF/Index/모호한 종목은
    // undefined로 자연 생략된다 (assetClassification 모듈 doc 참고).
    const aboutNode = buildAssetAboutNode(
        upper,
        assetInfo.koreanName ?? assetInfo.name,
        assetInfo.fmpSymbol
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
            {/* main 랜드마크: 다른 5개 sibling 페이지와 일관성. options-empty
                상태(OptionsEmptyState)는 자체적으로 <main>을 가지지만, 옵션
                데이터가 있는 정상 path도 동일하게 main으로 감싸야 sibling 일관성
                과 a11y landmark navigation이 유지된다. */}
            <main className="mx-auto w-full max-w-5xl px-4 py-8">
                <SymbolPageHeading>
                    {displayName} 옵션 시장 분석
                </SymbolPageHeading>
                <section className="sr-only">
                    <h2>{displayName} 옵션 분석 개요</h2>
                    <p>
                        {displayName} 옵션 시장을 AI가 한국어로 해석합니다.
                        만기별 Max Pain, Put/Call Ratio, ATM IV, Implied Move 등
                        핵심 지표와 Strike별 Open Interest 분포를 함께 살펴볼 수
                        있습니다.
                    </p>
                    {expirations.length > 0 ? (
                        <p>
                            현재 거래 가능한 만기일은 총 {expirations.length}
                            개이며, 가장 가까운 만기는 {expirations[0]}입니다.
                        </p>
                    ) : null}
                </section>
                <HydrationBoundary state={dehydrate(queryClient)}>
                    <OptionsPageClient
                        symbol={upper}
                        companyName={displayName}
                        snapshot={snapshot}
                        slots={slots}
                    />
                </HydrationBoundary>
            </main>
        </>
    );
}
