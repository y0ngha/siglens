import { getFinancialsPageData } from '@/app/[symbol]/financials/financialData';
import { getProfileResilient } from '@/app/[symbol]/fundamental/getProfileResilient';
import { FinancialsDegraded } from './FinancialsDegraded';
import { FinancialsAiSummary } from '@/widgets/financials/FinancialsAiSummary';
import { FinancialsScorecard } from '@/widgets/financials/FinancialsScorecard';
import { FinancialsStatements } from '@/widgets/financials/FinancialsStatements';
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
    buildSymbolFinancialsSeoContent,
    buildSymbolSeoContent,
    NOINDEX_SYMBOL_METADATA,
    SITE_NAME,
    SITE_URL,
} from '@/shared/lib/seo';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

// 종목당 재무제표는 분기(약 45일) 단위로 갱신된다. 24h revalidate는 엣지 캐시를 최대한 활용하면서
// 다음 분기 공시 이전에 오래된 데이터를 서빙하지 않는 균형점이다.
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
    // 재무제표 페이지는 FMP profile이 있어야 렌더된다. profile을 본문/ProfileSection과
    // 동일한 정적 캐시 키로 미리 확인한다(같은 요청 내 React.cache + unstable_cache 공유라
    // 추가 FMP round-trip 없음). 그래서 본문 렌더 결과와 metadata noindex 판단이 일치한다:
    //   - profileDegraded(FMP 인프라 실패) → 본문은 degrade(200)를 렌더하므로 noindex.
    //   - profile === null(실존하지 않는 종목) → 본문은 notFound()이므로 noindex.
    const { profile, degraded: profileDegraded } =
        await getProfileResilient(upper);
    if (profileDegraded || profile === null) {
        return NOINDEX_SYMBOL_METADATA;
    }
    const displayName = assetInfo ? buildDisplayName(assetInfo, upper) : upper;
    const { title, fullTitle, description, url, keywords } =
        buildSymbolFinancialsSeoContent(upper, {
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

export default async function FinancialsPage({ params }: Props) {
    const { symbol } = await params;
    const upper = symbol.toUpperCase();

    if (!VALID_TICKER_RE.test(upper)) {
        notFound();
    }

    // Gate via profile — same pattern as the fundamental page.
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
        return <FinancialsDegraded displayName={displayName} symbol={upper} />;
    }

    // profile === null = FMP 200 + 빈 결과 = 실존하지 않는 종목 → 404.
    if (profile === null) {
        notFound();
    }

    // Fetch the annual snapshot + scorecard in a single call.
    const { snapshot, scorecard } = await getFinancialsPageData(upper);

    const { fullTitle, description, url } = buildSymbolFinancialsSeoContent(
        upper,
        {
            displayName,
            koreanName: assetInfo?.koreanName,
        }
    );

    // about 노드는 stock으로 분류된 경우만 채워지고, ETF/Index/모호한 종목은
    // undefined로 자연 생략된다. financials 페이지도 fundamental과 동일하게 assetInfo가
    // optional이라 ticker를 fallback name으로 사용한다.
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
        {
            name: '재무제표',
            url: buildSymbolFinancialsSeoContent(upper).url,
        },
    ]);

    const faqJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
            {
                '@type': 'Question',
                name: `${displayName}의 재무는 건전한가요?`,
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: '안정성 점수는 부채비율과 유동비율을 기반으로 산출됩니다. 점수가 높을수록 부채 부담이 낮고 단기 상환 능력이 우수하다는 신호입니다. 재무상태표의 총자산 대비 총부채 비율도 함께 확인하면 재무 건전성을 더 정확히 파악할 수 있습니다.',
                },
            },
            {
                '@type': 'Question',
                name: `${displayName}의 성장 추세는 어떤가요?`,
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: '성장성 점수는 매출과 영업이익의 연간 성장률을 5년 추이로 평가합니다. 매출 성장이 지속되면서 영업이익 마진이 함께 늘어난다면 질적 성장으로 볼 수 있습니다. 손익계산서 차트에서 연도별 추이를 직접 확인할 수 있습니다.',
                },
            },
            {
                '@type': 'Question',
                name: `${displayName}의 현금 창출력은 충분한가요?`,
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: '현금창출력 점수는 영업활동현금흐름과 잉여현금흐름(FCF)을 기준으로 산출됩니다. 순이익보다 영업현금흐름이 크면 이익의 질이 높다는 의미이며, 꾸준한 FCF는 배당·자사주매입·투자 여력을 나타냅니다.',
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
                {/* Visible h1 — one per page, SEO contract (matches fundamental page pattern) */}
                <SymbolPageHeading>{upper} 재무제표</SymbolPageHeading>

                <FinancialsScorecard scorecard={scorecard} />

                <FinancialsAiSummary symbol={upper} />

                <FinancialsStatements
                    symbol={upper}
                    annualSnapshot={snapshot}
                />

                <CrossLinkCards symbol={upper} current="financials" />
            </main>
        </>
    );
}
