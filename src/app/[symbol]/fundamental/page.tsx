import {
    getAnalystEstimates,
    getCashFlowStatement,
    getFinancialScores,
    getGradesConsensus,
    getIncomeStatementGrowth,
    getKeyMetricsTtm,
    getPriceTargetConsensus,
    getPriceTargetSummary,
    getProfile,
    getProfileDescriptionKo,
    getRatiosTtm,
    getStockPeers,
} from '@/app/[symbol]/fundamental/fundamentalData';

import { FundamentalAiSummary } from '@/components/fundamental/FundamentalAiSummary';
import { FundamentalAiSummaryError } from '@/components/fundamental/FundamentalAiSummaryError';
import { FundamentalAiSummarySkeleton } from '@/components/fundamental/FundamentalAiSummarySkeleton';
import { FinancialHealthCard } from '@/components/fundamental/sections/FinancialHealthCard';
import { FutureDirectionCard } from '@/components/fundamental/sections/FutureDirectionCard';
import { GrowthChart } from '@/components/fundamental/sections/GrowthChart';
import { PeersTable } from '@/components/fundamental/sections/PeersTable';
import { ProfileCard } from '@/components/fundamental/sections/ProfileCard';
import { ProfitabilityCard } from '@/components/fundamental/sections/ProfitabilityCard';
import { ValuationCard } from '@/components/fundamental/sections/ValuationCard';
import { CrossLinkCards } from '@/components/symbol-page/CrossLinkCards';
import { SectionSkeleton } from '@/components/symbol-page/SectionSkeleton';
import { JsonLd } from '@/components/ui/JsonLd';
import { VALID_TICKER_RE } from '@/domain/constants/market';
import { buildDisplayName } from '@/domain/ticker';
import { getAssetInfoCached } from '@/infrastructure/ticker/getAssetInfoCached';
import {
    buildBreadcrumbJsonLd,
    buildSymbolFundamentalSeoContent,
    buildSymbolSeoContent,
    SITE_NAME,
} from '@/lib/seo';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

interface Props {
    params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { symbol } = await params;
    const upper = symbol.toUpperCase();
    const assetInfo = await getAssetInfoCached(upper);
    const displayName = assetInfo ? buildDisplayName(assetInfo, upper) : upper;
    // sector는 의도적으로 generateMetadata에서 사용하지 않는다. sector는 FMP getProfile 응답에만 있고
    // generateMetadata에서 별도 fetch하면 페이지 본문과 합쳐 round-trip이 두 배가 된다(SEO 메타에 sector 한 줄 더
    // 넣는 비용이 비대칭으로 큼). 결과적으로 <meta description>은 sector 없는 base 카피, 페이지 본문 JSON-LD는
    // sector 보강 카피라는 차이가 있지만, 두 description 모두 동일 함수에서 파생되므로 핵심 의미는 일치한다.
    const { title, fullTitle, description, url, keywords } =
        buildSymbolFundamentalSeoContent(upper, {
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

interface SymbolSectionProps {
    symbol: string;
}

function ProfileDescriptionSkeleton() {
    return (
        <div className="mt-4 space-y-2">
            <div className="flex items-center gap-1.5">
                <div className="border-secondary-500 h-2.5 w-2.5 animate-spin rounded-full border-2 border-t-transparent" />
                <span className="text-secondary-500 text-xs">번역 중...</span>
            </div>
            <div className="animate-pulse space-y-1.5">
                <div className="bg-secondary-700 h-3 w-full rounded" />
                <div className="bg-secondary-700 h-3 w-[92%] rounded" />
                <div className="bg-secondary-700 h-3 w-4/5 rounded" />
                <div className="bg-secondary-700 h-3 w-3/5 rounded" />
            </div>
        </div>
    );
}

interface ProfileCardSkeletonProps {
    symbol: string;
}

function ProfileCardSkeleton({ symbol }: ProfileCardSkeletonProps) {
    return (
        <section
            aria-labelledby="profile-heading"
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2
                        id="profile-heading"
                        className="text-xl font-semibold tracking-tight"
                    >
                        <span className="bg-secondary-700 inline-block h-5 w-36 animate-pulse rounded align-middle" />
                        <span className="text-secondary-400 ml-2 text-base font-normal">
                            ({symbol})
                        </span>
                    </h2>
                    <div className="bg-secondary-700 mt-1 h-4 w-28 animate-pulse rounded" />
                </div>
                <div className="text-right">
                    <span className="text-secondary-400 text-xs tracking-widest uppercase">
                        시가총액
                    </span>
                    <div className="bg-secondary-700 mt-0.5 h-6 w-20 animate-pulse rounded" />
                </div>
            </div>

            <dl className="mt-4 grid grid-cols-1 gap-y-2 sm:grid-cols-2">
                <div className="flex gap-2">
                    <dt className="text-secondary-400 w-10 shrink-0 text-sm">
                        CEO
                    </dt>
                    <dd>
                        <div className="bg-secondary-700 h-4 w-32 animate-pulse rounded" />
                    </dd>
                </div>
                <div className="flex gap-2">
                    <dt className="text-secondary-400 w-10 shrink-0 text-sm">
                        웹
                    </dt>
                    <dd>
                        <div className="bg-secondary-700 h-4 w-40 animate-pulse rounded" />
                    </dd>
                </div>
            </dl>

            <ProfileDescriptionSkeleton />
        </section>
    );
}

interface ProfileDescriptionSectionProps {
    symbol: string;
    fallback: string;
}

async function ProfileDescriptionSection({
    symbol,
    fallback,
}: ProfileDescriptionSectionProps) {
    const descriptionKo = await getProfileDescriptionKo(symbol);
    return (
        <p className="text-secondary-400 mt-4 line-clamp-4 text-sm leading-relaxed">
            {descriptionKo ?? fallback}
        </p>
    );
}

async function ProfileSection({ symbol }: SymbolSectionProps) {
    const profile = await getProfile(symbol);
    if (profile === null) return null;

    const descriptionSlot =
        profile.description !== null ? (
            <Suspense fallback={<ProfileDescriptionSkeleton />}>
                <ProfileDescriptionSection
                    symbol={symbol}
                    fallback={profile.description}
                />
            </Suspense>
        ) : undefined;

    return <ProfileCard profile={profile} descriptionSlot={descriptionSlot} />;
}

async function ValuationSection({ symbol }: SymbolSectionProps) {
    const metrics = await getKeyMetricsTtm(symbol);
    if (metrics === null) return null;
    return <ValuationCard metrics={metrics} />;
}

async function PeersSection({ symbol }: SymbolSectionProps) {
    const peers = await getStockPeers(symbol);
    if (peers.length === 0) return null;
    return <PeersTable peers={peers} />;
}

async function ProfitabilitySection({ symbol }: SymbolSectionProps) {
    const ratios = await getRatiosTtm(symbol);
    if (ratios === null) return null;
    return <ProfitabilityCard ratios={ratios} />;
}

async function GrowthSection({ symbol }: SymbolSectionProps) {
    const growth = await getIncomeStatementGrowth(symbol);
    if (growth === null) return null;
    return <GrowthChart growth={growth} />;
}

async function FinancialHealthSection({ symbol }: SymbolSectionProps) {
    const [ratios, scores, cashFlow] = await Promise.all([
        getRatiosTtm(symbol),
        getFinancialScores(symbol),
        getCashFlowStatement(symbol),
    ]);
    if (ratios === null && scores === null) return null;
    return (
        <FinancialHealthCard
            ratios={ratios}
            scores={scores}
            cashFlow={cashFlow}
        />
    );
}

async function FutureDirectionSection({ symbol }: SymbolSectionProps) {
    const [estimates, grades, ptConsensus, ptSummary] = await Promise.all([
        getAnalystEstimates(symbol),
        getGradesConsensus(symbol),
        getPriceTargetConsensus(symbol),
        getPriceTargetSummary(symbol),
    ]);
    if (estimates === null && grades === null && ptConsensus === null)
        return null;
    return (
        <FutureDirectionCard
            estimates={estimates}
            grades={grades}
            ptConsensus={ptConsensus}
            ptSummary={ptSummary}
        />
    );
}

export default async function FundamentalPage({ params }: Props) {
    const { symbol } = await params;
    const upper = symbol.toUpperCase();

    if (!VALID_TICKER_RE.test(upper)) {
        notFound();
    }

    // Early fetch for notFound guard + sector resolution; shares the same `use cache` key as ProfileSection so no duplicate HTTP call.
    // assetInfo는 한국어 종목명을 displayName에 합치기 위해 병렬로 가져온다.
    const [profile, assetInfo] = await Promise.all([
        getProfile(upper),
        getAssetInfoCached(upper),
    ]);
    if (profile === null) {
        notFound();
    }

    // 펀더멘털 페이지는 FMP profile만 있으면 렌더 가능 — assetInfo(우리 자체 자산 디렉터리)에 등록되지
    // 않은 종목도 PER/ROE/애널리스트 컨센서스를 보여줄 수 있어야 한다. 따라서 news/overall과 달리
    // assetInfo null을 notFound()로 막지 않고 ticker fallback을 허용한다 (generateMetadata와 동일 패턴).
    const sector = profile.sector ?? '';
    const displayName = assetInfo ? buildDisplayName(assetInfo, upper) : upper;
    const { fullTitle, description, url } = buildSymbolFundamentalSeoContent(
        upper,
        {
            displayName,
            koreanName: assetInfo?.koreanName,
            sector: sector !== '' ? sector : undefined,
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
        {
            name: '펀더멘털 분석',
            url: buildSymbolFundamentalSeoContent(upper).url,
        },
    ]);

    const faqJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
            {
                '@type': 'Question',
                name: `${displayName} 펀더멘털 분석에서 무엇을 볼 수 있나요?`,
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: '회사 프로필, PER·PSR·EPS 같은 밸류에이션 지표, ROE와 마진으로 보는 수익성, 부채와 현금흐름을 통한 재무 건전성, 애널리스트 컨센서스와 목표 주가를 함께 볼 수 있습니다.',
                },
            },
            {
                '@type': 'Question',
                name: 'PER, ROE 같은 지표는 어떻게 해석하나요?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'PER이 높으면 시장이 미래 성장에 프리미엄을 주고 있다는 신호이고, ROE는 자기자본 대비 얼마나 많은 이익을 내고 있는지 보여줍니다. 동종업계 평균과 비교하며 봐야 의미가 살아납니다.',
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
                    {displayName} 재무지표와 애널리스트 의견
                </h1>
                <Suspense fallback={<ProfileCardSkeleton symbol={upper} />}>
                    <ProfileSection symbol={upper} />
                </Suspense>

                <ErrorBoundary FallbackComponent={FundamentalAiSummaryError}>
                    <Suspense fallback={<FundamentalAiSummarySkeleton />}>
                        <FundamentalAiSummary symbol={upper} />
                    </Suspense>
                </ErrorBoundary>

                <Suspense fallback={<SectionSkeleton />}>
                    <ValuationSection symbol={upper} />
                </Suspense>

                <Suspense fallback={<SectionSkeleton />}>
                    <PeersSection symbol={upper} />
                </Suspense>

                <Suspense fallback={<SectionSkeleton />}>
                    <ProfitabilitySection symbol={upper} />
                </Suspense>

                <Suspense fallback={<SectionSkeleton />}>
                    <GrowthSection symbol={upper} />
                </Suspense>

                <Suspense fallback={<SectionSkeleton />}>
                    <FinancialHealthSection symbol={upper} />
                </Suspense>

                <Suspense fallback={<SectionSkeleton />}>
                    <FutureDirectionSection symbol={upper} />
                </Suspense>

                <CrossLinkCards symbol={upper} current="fundamental" />
            </main>
        </>
    );
}
