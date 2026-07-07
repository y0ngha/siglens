import { getCongressPageData } from '@/app/[symbol]/congress/congressData';
import { getBlockedSymbolMetadata } from '@/app/[symbol]/symbolIndexabilityMetadata';
import { getCongressTradesResilient } from '@/entities/congress-trades';
import { getProfileResilient } from '@/app/[symbol]/fundamental/getProfileResilient';
import { CongressDegraded } from '@/app/[symbol]/congress/CongressDegraded';
import { CongressTradesTable, CongressTrendSummary } from '@/widgets/congress';
import { SymbolPageHeading } from '@/views/symbol';
import { CrossLinkCards } from '@/shared/ui/CrossLinkCards';
import { JsonLd } from '@/shared/ui/JsonLd';
import {
    isAdmissibleSymbolShape,
    type SymbolRouteParams,
} from '@/shared/config/market';
import { isUnresolvableDegraded } from '@/shared/lib/symbolGuard';
import {
    buildAssetAboutNode,
    buildDisplayName,
    getAssetInfoResilient,
} from '@/entities/ticker';
import {
    buildBreadcrumbJsonLd,
    buildSymbolCongressSeoContent,
    buildSymbolSeoContent,
    buildSymbolWebPageJsonLd,
    symbolMetadataFromSeo,
    NOINDEX_SYMBOL_METADATA,
} from '@/shared/lib/seo';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';

// 의회 거래는 STOCK Act상 신고 마감(거래일 +30~45일) 이후 공시되므로
// 일 단위 갱신이 적절하다. 24h revalidate는 엣지 캐시를 최대한 활용하면서
// 새 공시를 다음 날 안에 반영하는 균형점이다.
// app/CLAUDE.md ISR 4축 규약 §4: route segment config must stay a literal for Next.js static analysis (the magic-number-extraction rule does not apply here).
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
    if (!isAdmissibleSymbolShape(upper)) {
        return NOINDEX_SYMBOL_METADATA;
    }
    // 본문 `isTabAllowedForSymbol` 가드와 일관: 크립토 심볼은 congress 탭이 없으므로
    // generateMetadata도 동일 조건에서 NOINDEX로 반환한다. 가드 없이 계속 진행하면
    // 본문은 notFound()(noindex)인데 메타데이터는 canonical + index:true인 soft-404가 만들어진다.
    if (!(await isTabAllowedForSymbol(upper, 'congress'))) {
        return NOINDEX_SYMBOL_METADATA;
    }
    const { assetInfo, degraded } = await getAssetInfoResilient(upper);
    const blockedMetadata = getBlockedSymbolMetadata({
        symbol: upper,
        assetInfo,
        degraded,
    });
    if (blockedMetadata) return blockedMetadata;

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
    const seo = buildSymbolCongressSeoContent(upper, {
        displayName,
        koreanName: assetInfo?.koreanName,
    });
    return symbolMetadataFromSeo(seo);
}

export default async function CongressPage({ params }: Props) {
    const { symbol } = await params;
    const upper = symbol.toUpperCase();

    if (!isAdmissibleSymbolShape(upper)) {
        notFound();
    }

    // Hard-404 crypto symbols — this tab is equity-only.
    if (!(await isTabAllowedForSymbol(upper, 'congress'))) notFound();

    // getProfileResilient uses ['fundamental:profile', upper] key, shared with
    // ProfileSection inside the fundamental page, so there is no extra FMP round-trip.
    const [{ profile, degraded: profileDegraded }, { assetInfo, degraded }] =
        await Promise.all([
            getProfileResilient(upper),
            getAssetInfoResilient(upper),
        ]);

    // degraded + digit-first 심볼 = crypto_assets DB와 FMP가 동시 다운 중이고 resolve 불가
    // → 차트 페이지와 동일한 notFound 처리로 sibling 일관성 유지.
    if (isUnresolvableDegraded(upper, degraded)) notFound();

    // assetInfo degraded → generateMetadata returns NOINDEX_SYMBOL_METADATA (above),
    // while the page body renders a 200 with `displayName = upper` as ticker fallback.
    // This mirrors the financials/fundamental pages: a soft-200 keeps the user-facing
    // page navigable while noindex prevents stale/degraded content from being indexed.
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

    const jsonLd = buildSymbolWebPageJsonLd({
        url,
        name: fullTitle,
        description,
        about: aboutNode,
    });

    const breadcrumbJsonLd = buildBreadcrumbJsonLd([
        { name: upper, url: buildSymbolSeoContent(upper).url },
        { name: '의회 거래', url },
    ]);

    const faqJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
            {
                '@type': 'Question',
                name: `${displayName}의 의회 거래는 어떤 의미가 있나요?`,
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: '미국 STOCK Act는 상원·하원 의원과 가족 구성원의 주식 매매를 45일 이내 공시하도록 의무화합니다. 의원의 매매는 산업·정책 정보 접근성 측면에서 시장 참여자들이 주목하는 신호 중 하나로, 정치인 거래 동향은 정량적 가치 평가가 아닌 시장 센티먼트 보조 지표로 활용됩니다.',
                },
            },
            {
                '@type': 'Question',
                name: '공시 지연이 약 45일인 이유는 무엇인가요?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'STOCK Act는 의원이 거래일로부터 30일 이내에 회계 사무소에 통지하고, 통지일로부터 45일 이내에 공시하도록 규정합니다. 따라서 공시 시점에 실제 거래는 이미 1–2개월 전에 일어났을 가능성이 높습니다. 거래 시점과 공시 시점이 다르므로 단기 매매 신호로 활용하기보다는 누적 동향을 해석하는 편이 안전합니다.',
                },
            },
            {
                '@type': 'Question',
                name: `${displayName}의 의회 거래가 매수 신호인가요?`,
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: '특정 종목에 대한 의원의 순매수 우세가 곧 강세 신호로 직결되는 것은 아닙니다. 공시 지연·구간 단위 금액·가족 명의 거래 같은 한계가 있어 보조 지표로 해석해야 합니다. 본 페이지의 AI 동향 해석은 거래 건수와 의원 분포를 결정론적으로 요약한 뒤 LLM 코멘트를 더한 결과로, 매수·매도 판단은 다른 펀더멘털·기술적 신호와 함께 종합 검토하시기 바랍니다.',
                },
            },
        ],
    };

    return (
        <>
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <JsonLd data={faqJsonLd} />
            <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
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
