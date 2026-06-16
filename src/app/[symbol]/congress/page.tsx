import { getCongressPageData } from '@/app/[symbol]/congress/congressData';
import { getCongressTradesResilient } from '@/entities/congress-trades';
import { getProfileResilient } from '@/app/[symbol]/fundamental/getProfileResilient';
import { CongressDegraded } from '@/app/[symbol]/congress/CongressDegraded';
import { CongressTradesTable, CongressTrendSummary } from '@/widgets/congress';
import { CrossLinkCards, SymbolPageHeading } from '@/widgets/symbol-page';
import { JsonLd } from '@/shared/ui/JsonLd';
import {
    VALID_TICKER_RE,
    type SymbolRouteParams,
} from '@/shared/config/market';
import {
    buildAssetAboutNode,
    buildDisplayName,
    getAssetInfoResilient,
} from '@/entities/ticker';
import {
    buildBreadcrumbJsonLd,
    buildSymbolCongressSeoContent,
    buildSymbolSeoContent,
    NOINDEX_SYMBOL_METADATA,
    SITE_NAME,
    SITE_URL,
} from '@/shared/lib/seo';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

// 의회 거래는 STOCK Act상 신고 마감(거래일 +30~45일) 이후 공시되므로
// 일 단위 갱신이 적절하다. 24h revalidate는 엣지 캐시를 최대한 활용하면서
// 새 공시를 다음 날 안에 반영하는 균형점이다.
// MISTAKES §15: route segment config must be a literal constant, not an imported value.
export const revalidate = 86400; // 24h

// generateStaticParams가 없으면 revalidate가 무력화된다(Next.js). 빈 배열 = 빌드 시 prebuild
// 없이, 첫 요청에 렌더+캐시 후 revalidate 주기로 재생성하는 on-demand ISR.
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
    if (!VALID_TICKER_RE.test(upper)) {
        return NOINDEX_SYMBOL_METADATA;
    }
    const { assetInfo, degraded } = await getAssetInfoResilient(upper);
    if (degraded) {
        return NOINDEX_SYMBOL_METADATA;
    }
    // 의회 거래 페이지는 종목이 실존해야 의미가 있다 — fundamental/financials와
    // 동일한 profile 게이트로 존재성을 확인한다(같은 요청 내 React.cache + unstable_cache
    // 공유라 추가 FMP round-trip 없음). 본문과 메타의 source-of-truth가 일치한다:
    //   - profileDegraded(FMP 인프라 실패) → 본문은 degrade(200)를 렌더하므로 noindex.
    //   - profile === null(실존하지 않는 종목) → 본문은 notFound()이므로 noindex.
    const { profile, degraded: profileDegraded } =
        await getProfileResilient(upper);
    if (profileDegraded || profile === null) {
        return NOINDEX_SYMBOL_METADATA;
    }
    // **financials와의 의도적 차이점**: 0건은 정상(sparse 종목)이라 색인 가능.
    // `degraded === true`(FMP 인프라 실패)만 noindex로 떨어뜨린다.
    // getCongressTradesResilient는 React.cache로 메모이즈되므로 본문과 동일한 호출이 즉시 반환된다.
    const { degraded: tradesDegraded } =
        await getCongressTradesResilient(upper);
    if (tradesDegraded) {
        return NOINDEX_SYMBOL_METADATA;
    }
    const displayName = assetInfo ? buildDisplayName(assetInfo, upper) : upper;
    const { title, fullTitle, description, url, keywords } =
        buildSymbolCongressSeoContent(upper, {
            displayName,
            koreanName: assetInfo?.koreanName,
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

export default async function CongressPage({ params }: Props) {
    const { symbol } = await params;
    const upper = symbol.toUpperCase();

    if (!VALID_TICKER_RE.test(upper)) {
        notFound();
    }

    // getProfileResilient uses ['fundamental:profile', upper] key, shared with
    // ProfileSection inside the fundamental page, so there is no extra FMP round-trip.
    const [{ profile, degraded: profileDegraded }, { assetInfo }] =
        await Promise.all([
            getProfileResilient(upper),
            getAssetInfoResilient(upper),
        ]);

    const displayName = assetInfo ? buildDisplayName(assetInfo, upper) : upper;

    // FMP 인프라 일시 실패: 500 대신 degrade 안내(200)를 렌더한다. 다음 revalidate에
    // 인프라가 복구되면 정상 데이터로 자동 갱신된다.
    if (profileDegraded) {
        return <CongressDegraded displayName={displayName} symbol={upper} />;
    }

    // profile === null = FMP 200 + 빈 결과 = 실존하지 않는 종목 → 404.
    if (profile === null) {
        notFound();
    }

    // `degraded` semantically differs from financials: ONLY FMP infra failure
    // is degrade. `trades.length === 0` is a normal indexable state — sparse
    // tickers legitimately have no congress trades on record.
    const { trades, degraded: tradesDegraded } =
        await getCongressPageData(upper);

    if (tradesDegraded) {
        return <CongressDegraded displayName={displayName} symbol={upper} />;
    }

    const { fullTitle, description, url } = buildSymbolCongressSeoContent(
        upper,
        {
            displayName,
            koreanName: assetInfo?.koreanName,
        }
    );

    // about 노드는 stock으로 분류된 경우만 채워지고, ETF/Index/모호한 종목은
    // undefined로 자연 생략된다.
    const aboutNode = buildAssetAboutNode(
        upper,
        assetInfo?.koreanName ?? assetInfo?.name ?? upper,
        assetInfo?.fmpSymbol
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
        { name: '의회 거래', url },
    ]);

    return (
        <>
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
                <SymbolPageHeading>{displayName} 의회 거래</SymbolPageHeading>
                <section className="sr-only">
                    <h2>{displayName} 의회 의원 매매 공시 개요</h2>
                    <p>
                        미국 상원·하원 의원이 STOCK Act에 따라 공시한{' '}
                        {displayName} 매매 내역을 정리합니다.
                        거래일·공시일·매수/매도 구분· 예상 금액 범위를 함께
                        보여주고, 공시지연 약 45일을 감안해 AI가 최근 의회 매매
                        동향을 한국어로 요약합니다.
                    </p>
                </section>

                <CongressTrendSummary symbol={upper} />

                <CongressTradesTable trades={trades} />

                <CrossLinkCards symbol={upper} current="congress" />
            </main>
        </>
    );
}
