import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
    getProfile,
    getKeyMetricsTtm,
    getRatiosTtm,
    getStockPeers,
    getIncomeStatementGrowth,
    getFinancialScores,
    getCashFlowStatement,
    getAnalystEstimates,
    getGradesConsensus,
    getPriceTargetConsensus,
    getPriceTargetSummary,
    getSectorSnapshot,
    getHistoricalSector,
} from '@/app/[symbol]/fundamental/fundamentalData';
import { todayKstIsoDate } from '@/lib/dateKey';
import { VALID_TICKER_RE } from '@/domain/constants/market';
import { ProfileCard } from '@/components/fundamental/sections/ProfileCard';
import { ValuationCard } from '@/components/fundamental/sections/ValuationCard';
import { PeersTable } from '@/components/fundamental/sections/PeersTable';
import { ProfitabilityCard } from '@/components/fundamental/sections/ProfitabilityCard';
import { GrowthChart } from '@/components/fundamental/sections/GrowthChart';
import { FinancialHealthCard } from '@/components/fundamental/sections/FinancialHealthCard';
import { FutureDirectionCard } from '@/components/fundamental/sections/FutureDirectionCard';
import { SectorDirectionCard } from '@/components/fundamental/sections/SectorDirectionCard';
import { FundamentalAiSummary } from '@/components/fundamental/FundamentalAiSummary';
import { CrossLinkCards } from '@/components/symbol-page/CrossLinkCards';
import { JsonLd } from '@/components/ui/JsonLd';
import {
    buildBreadcrumbJsonLd,
    buildSymbolFundamentalSeoContent,
    OG_IMAGE_HEIGHT,
    OG_IMAGE_WIDTH,
    SITE_NAME,
} from '@/lib/seo';

interface Props {
    params: Promise<{ symbol: string }>;
}

/**
 * Generate page-level SEO metadata for `/[symbol]/fundamental`.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { symbol } = await params;
    const upper = symbol.toUpperCase();
    const { title, fullTitle, description, url, keywords } =
        buildSymbolFundamentalSeoContent(upper);

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
            images: [
                {
                    url: '/og-image.png',
                    width: OG_IMAGE_WIDTH,
                    height: OG_IMAGE_HEIGHT,
                    alt: fullTitle,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title: fullTitle,
            description,
            images: ['/og-image.png'],
        },
    };
}

// Thin async RSC wrappers — each fetches data and passes props to a presentational
// section in components/fundamental/sections/. Suspense boundaries on the page
// let each section stream independently.

interface SymbolSectionProps {
    symbol: string;
}

async function ProfileSection({ symbol }: SymbolSectionProps) {
    const profile = await getProfile(symbol);
    if (profile === null) return null;
    return <ProfileCard profile={profile} />;
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

async function SectorDirectionSection({ sector }: { sector: string }) {
    const today = todayKstIsoDate();
    const [snapshot, historical] = await Promise.all([
        getSectorSnapshot(today),
        sector !== '' ? getHistoricalSector(sector) : Promise.resolve([]),
    ]);
    return (
        <SectorDirectionCard
            sector={sector}
            snapshot={snapshot}
            historical={historical}
        />
    );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SectionSkeleton() {
    return (
        <div
            aria-hidden="true"
            className="bg-secondary-700 h-32 animate-pulse rounded-xl"
        />
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * RSC page: `/[symbol]/fundamental`.
 *
 * Fetches the company profile first (needed for sector + notFound guard),
 * then streams each of the 9 sections independently via Suspense.
 */
export default async function FundamentalPage({ params }: Props) {
    const { symbol } = await params;
    const upper = symbol.toUpperCase();

    if (!VALID_TICKER_RE.test(upper)) {
        notFound();
    }

    // Profile is fetched early: (1) notFound guard, (2) resolve sector for SectorDirectionSection.
    // Shares the same unstable_cache key as ProfileSection — no duplicate HTTP call.
    const profile = await getProfile(upper);
    if (profile === null) {
        notFound();
    }

    const sector = profile.sector ?? '';

    const breadcrumbJsonLd = buildBreadcrumbJsonLd([
        { name: upper, url: `/${upper}` },
        { name: '펀더멘털 분석', url: `/${upper}/fundamental` },
    ]);

    return (
        <>
            <JsonLd data={breadcrumbJsonLd} />
            <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
                <Suspense fallback={<SectionSkeleton />}>
                    <ProfileSection symbol={upper} />
                </Suspense>

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

                <Suspense fallback={<SectionSkeleton />}>
                    <SectorDirectionSection sector={sector} />
                </Suspense>

                <FundamentalAiSummary symbol={upper} />

                <CrossLinkCards symbol={upper} current="fundamental" />
            </main>
        </>
    );
}
