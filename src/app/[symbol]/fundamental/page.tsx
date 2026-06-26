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
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';

import { FundamentalAiSummary } from '@/widgets/fundamental/FundamentalAiSummary';
import { FundamentalAiSummaryError } from '@/widgets/fundamental/FundamentalAiSummaryError';
import { FundamentalAiSummarySkeleton } from '@/widgets/fundamental/FundamentalAiSummarySkeleton';
import { FinancialHealthCard } from '@/widgets/fundamental/sections/FinancialHealthCard';
import { FutureDirectionCard } from '@/widgets/fundamental/sections/FutureDirectionCard';
import { GrowthChart } from '@/widgets/fundamental/sections/GrowthChart';
import { PeersTable } from '@/widgets/fundamental/sections/PeersTable';
import { ProfileCard } from '@/widgets/fundamental/sections/ProfileCard';
import { ProfitabilityCard } from '@/widgets/fundamental/sections/ProfitabilityCard';
import { ValuationCard } from '@/widgets/fundamental/sections/ValuationCard';
import { SymbolPageHeading } from '@/views/symbol';
import { CrossLinkCards } from '@/shared/ui/CrossLinkCards';
import { SectionSkeleton } from '@/views/symbol/SectionSkeleton';
import { JsonLd } from '@/shared/ui/JsonLd';
import {
    SymbolRouteParams,
    isAdmissibleSymbolShape,
} from '@/shared/config/market';
import { isUnresolvableDegraded } from '@/shared/lib/symbolGuard';
import { SECONDS_PER_DAY } from '@/shared/config/time';
import {
    buildAssetAboutNode,
    buildDisplayName,
    getAssetInfoResilient,
} from '@/entities/ticker';
import {
    buildBreadcrumbJsonLd,
    buildSymbolFundamentalSeoContent,
    buildSymbolSeoContent,
    buildSymbolWebPageJsonLd,
    symbolMetadataFromSeo,
    NOINDEX_SYMBOL_METADATA,
} from '@/shared/lib/seo';
import { getProfileResilient } from './getProfileResilient';
import { FundamentalDegraded } from './FundamentalDegraded';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';

// 종목당 SEO 콘텐츠는 고정이고 동적 데이터는 클라가 재hydrate한다. 엣지 캐시로
// compute 호출을 줄인다. (일시 인프라 장애의 404 캐싱은 getAssetInfo strict로 차단)
export const revalidate = 86400; // 24h — FMP 재무는 분기(약 45일) 단위라 길게

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
    // 본문 `isTabAllowedForSymbol` 가드와 일관: 크립토 심볼은 fundamental 탭이 없으므로
    // generateMetadata도 동일 조건에서 NOINDEX로 반환한다. 가드 없이 계속 진행하면
    // 본문은 notFound()(noindex)인데 메타데이터는 canonical + index:true인 soft-404가 만들어진다.
    if (!(await isTabAllowedForSymbol(upper, 'fundamental'))) {
        return NOINDEX_SYMBOL_METADATA;
    }
    const { assetInfo, degraded } = await getAssetInfoResilient(upper);
    if (degraded) {
        return NOINDEX_SYMBOL_METADATA;
    }
    // 펀더멘털 페이지는 FMP profile이 있어야 렌더된다. profile을 본문/ProfileSection과
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
    // sector는 의도적으로 <meta description>에 쓰지 않는다(description은 sector 없는 base
    // 카피, 페이지 본문 JSON-LD만 sector 보강 카피). 위 profile 조회는 noindex 게이트 용도이며
    // 두 description 모두 동일 함수에서 파생되므로 핵심 의미는 일치한다.
    const seo = buildSymbolFundamentalSeoContent(upper, {
        displayName,
        koreanName: assetInfo?.koreanName,
    });
    return symbolMetadataFromSeo(seo);
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

export async function ProfileDescriptionSection({
    symbol,
    fallback,
}: ProfileDescriptionSectionProps) {
    // ISR degrade guard: getProfileDescriptionKo(AI 번역)가 throw하더라도 ISR 캐시에
    // 0-byte 빈 결과가 굳지 않도록 흡수한다. null 로 degrade → fallback(영어 원문)을 렌더.
    const descriptionKo = await staticSymbolCache(
        ['fundamental:desc-ko', symbol],
        symbol,
        () => getProfileDescriptionKo(symbol),
        [],
        SECONDS_PER_DAY
    ).catch((e: unknown) => {
        console.error(
            '[ProfileDescriptionSection] getProfileDescriptionKo failed, degrading to null:',
            e
        );
        return null;
    });
    return (
        <p className="text-secondary-400 mt-4 line-clamp-4 text-sm leading-relaxed">
            {descriptionKo ?? fallback}
        </p>
    );
}

export async function ProfileSection({ symbol }: SymbolSectionProps) {
    // Shares the same key as the notFound guard in the page body — cross-request ISR cache is shared.
    // ISR degrade guard: getProfile(FMP)가 throw하면 null 로 degrade → ProfileCard(null)가
    // 기존 empty-state UI를 렌더하고 페이지 크롬은 유지된다.
    const profile = await staticSymbolCache(
        ['fundamental:profile', symbol],
        symbol,
        () => getProfile(symbol),
        [],
        SECONDS_PER_DAY
    ).catch((e: unknown) => {
        console.error(
            '[ProfileSection] getProfile failed, degrading to null:',
            e
        );
        return null;
    });

    const descriptionSlot = (
        <Suspense fallback={<ProfileDescriptionSkeleton />}>
            <ProfileDescriptionSection
                symbol={symbol}
                fallback={profile?.description ?? ''}
            />
        </Suspense>
    );

    return <ProfileCard profile={profile} descriptionSlot={descriptionSlot} />;
}

export async function ValuationSection({ symbol }: SymbolSectionProps) {
    // ISR degrade guard: getKeyMetricsTtm(FMP)가 throw하면 null 로 degrade →
    // ValuationCard(null)가 기존 empty-state UI를 렌더한다.
    const metrics = await staticSymbolCache(
        ['fundamental:metrics', symbol],
        symbol,
        () => getKeyMetricsTtm(symbol),
        [],
        SECONDS_PER_DAY
    ).catch((e: unknown) => {
        console.error(
            '[ValuationSection] getKeyMetricsTtm failed, degrading to null:',
            e
        );
        return null;
    });
    return <ValuationCard metrics={metrics} />;
}

export async function PeersSection({ symbol }: SymbolSectionProps) {
    // ISR degrade guard: getStockPeers(FMP)가 throw하면 [] 로 degrade →
    // PeersTable([])가 기존 empty-state UI를 렌더한다.
    const peers = await staticSymbolCache(
        ['fundamental:peers', symbol],
        symbol,
        () => getStockPeers(symbol),
        [],
        SECONDS_PER_DAY
    ).catch((e: unknown) => {
        console.error(
            '[PeersSection] getStockPeers failed, degrading to []:',
            e
        );
        return [] as Awaited<ReturnType<typeof getStockPeers>>;
    });
    return <PeersTable peers={peers} />;
}

export async function ProfitabilitySection({ symbol }: SymbolSectionProps) {
    // ISR degrade guard: getRatiosTtm(FMP)가 throw하면 null 로 degrade →
    // ProfitabilityCard(null)가 기존 empty-state UI를 렌더한다.
    const ratios = await staticSymbolCache(
        ['fundamental:ratios', symbol],
        symbol,
        () => getRatiosTtm(symbol),
        [],
        SECONDS_PER_DAY
    ).catch((e: unknown) => {
        console.error(
            '[ProfitabilitySection] getRatiosTtm failed, degrading to null:',
            e
        );
        return null;
    });
    return <ProfitabilityCard ratios={ratios} />;
}

export async function GrowthSection({ symbol }: SymbolSectionProps) {
    // ISR degrade guard: getIncomeStatementGrowth(FMP)가 throw하면 null 로 degrade →
    // GrowthChart(null)가 기존 empty-state UI를 렌더한다.
    const growth = await staticSymbolCache(
        ['fundamental:growth', symbol],
        symbol,
        () => getIncomeStatementGrowth(symbol),
        [],
        SECONDS_PER_DAY
    ).catch((e: unknown) => {
        console.error(
            '[GrowthSection] getIncomeStatementGrowth failed, degrading to null:',
            e
        );
        return null;
    });
    return <GrowthChart growth={growth} />;
}

export async function FinancialHealthSection({ symbol }: SymbolSectionProps) {
    // ISR degrade guard: 각 FMP 로더가 throw하면 null 로 degrade →
    // FinancialHealthCard(null, null, null)가 기존 empty-state UI를 렌더한다.
    const [ratios, scores, cashFlow] = await Promise.all([
        staticSymbolCache(
            ['fundamental:ratios', symbol],
            symbol,
            () => getRatiosTtm(symbol),
            [],
            SECONDS_PER_DAY
        ).catch((e: unknown) => {
            console.error(
                '[FinancialHealthSection] getRatiosTtm failed, degrading to null:',
                e
            );
            return null;
        }),
        staticSymbolCache(
            ['fundamental:scores', symbol],
            symbol,
            () => getFinancialScores(symbol),
            [],
            SECONDS_PER_DAY
        ).catch((e: unknown) => {
            console.error(
                '[FinancialHealthSection] getFinancialScores failed, degrading to null:',
                e
            );
            return null;
        }),
        staticSymbolCache(
            ['fundamental:cashflow', symbol],
            symbol,
            () => getCashFlowStatement(symbol),
            [],
            SECONDS_PER_DAY
        ).catch((e: unknown) => {
            console.error(
                '[FinancialHealthSection] getCashFlowStatement failed, degrading to null:',
                e
            );
            return null;
        }),
    ]);
    return (
        <FinancialHealthCard
            ratios={ratios}
            scores={scores}
            cashFlow={cashFlow}
        />
    );
}

export async function FutureDirectionSection({ symbol }: SymbolSectionProps) {
    // ISR degrade guard: 각 FMP 로더가 throw하면 null 로 degrade →
    // FutureDirectionCard(null, null, null, null)가 기존 empty-state UI를 렌더한다.
    const [estimates, grades, ptConsensus, ptSummary] = await Promise.all([
        staticSymbolCache(
            ['fundamental:estimates', symbol],
            symbol,
            () => getAnalystEstimates(symbol),
            [],
            SECONDS_PER_DAY
        ).catch((e: unknown) => {
            console.error(
                '[FutureDirectionSection] getAnalystEstimates failed, degrading to null:',
                e
            );
            return null;
        }),
        staticSymbolCache(
            ['fundamental:grades-consensus', symbol],
            symbol,
            () => getGradesConsensus(symbol),
            [],
            SECONDS_PER_DAY
        ).catch((e: unknown) => {
            console.error(
                '[FutureDirectionSection] getGradesConsensus failed, degrading to null:',
                e
            );
            return null;
        }),
        staticSymbolCache(
            ['fundamental:pt-consensus', symbol],
            symbol,
            () => getPriceTargetConsensus(symbol),
            [],
            SECONDS_PER_DAY
        ).catch((e: unknown) => {
            console.error(
                '[FutureDirectionSection] getPriceTargetConsensus failed, degrading to null:',
                e
            );
            return null;
        }),
        staticSymbolCache(
            ['fundamental:pt-summary', symbol],
            symbol,
            () => getPriceTargetSummary(symbol),
            [],
            SECONDS_PER_DAY
        ).catch((e: unknown) => {
            console.error(
                '[FutureDirectionSection] getPriceTargetSummary failed, degrading to null:',
                e
            );
            return null;
        }),
    ]);
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

    if (!isAdmissibleSymbolShape(upper)) {
        notFound();
    }

    // Hard-404 crypto symbols — this tab is equity-only.
    if (!(await isTabAllowedForSymbol(upper, 'fundamental'))) notFound();

    // notFound guard + sector resolution을 위해 profile을 먼저 가져온다.
    // assetInfo는 한국어 종목명을 displayName에 합치기 위해 병렬로 가져온다.
    // getProfileResilient는 ['fundamental:profile', upper] 키를 ProfileSection과 공유한다
    // → cross-request ISR 캐시 + 같은 요청 React.cache 공유(추가 FMP round-trip 없음).
    const [{ profile, degraded: profileDegraded }, { assetInfo, degraded }] =
        await Promise.all([
            getProfileResilient(upper),
            getAssetInfoResilient(upper),
        ]);

    // degraded + digit-first 심볼 = crypto_assets DB와 FMP가 동시 다운 중이고 resolve 불가
    // → 차트 페이지와 동일한 notFound 처리로 sibling 일관성 유지.
    if (isUnresolvableDegraded(upper, degraded)) notFound();
    const displayName = assetInfo ? buildDisplayName(assetInfo, upper) : upper;
    // FMP 인프라 일시 실패: 500 대신 degrade 안내(200)를 렌더한다. generateMetadata가
    // 동일 조건을 noindex 처리하므로 이 thin 페이지는 색인되지 않고, 다음 revalidate에
    // 인프라가 복구되면 정상 데이터로 자동 갱신된다.
    if (profileDegraded) {
        return <FundamentalDegraded displayName={displayName} symbol={upper} />;
    }
    // profile === null = FMP 200 + 빈 결과 = 실존하지 않는 종목 → 404.
    if (profile === null) {
        notFound();
    }

    // 펀더멘털 페이지는 FMP profile만 있으면 렌더 가능 — assetInfo(우리 자체 자산 디렉터리)에 등록되지
    // 않은 종목도 PER/ROE/애널리스트 컨센서스를 보여줄 수 있어야 한다. 따라서 news/overall과 달리
    // assetInfo null을 notFound()로 막지 않고 ticker fallback을 허용한다 (generateMetadata와 동일 패턴).
    const sector = profile.sector ?? '';
    const { fullTitle, description, url } = buildSymbolFundamentalSeoContent(
        upper,
        {
            displayName,
            koreanName: assetInfo?.koreanName,
            sector: sector !== '' ? sector : undefined,
        }
    );

    // about 노드는 stock으로 분류된 경우만 채워지고, ETF/Index/모호한 종목은
    // undefined로 자연 생략된다 (assetClassification 모듈 doc 참고).
    // fundamental 페이지는 assetInfo가 optional이라 ticker를 fallback name으로
    // 사용해 displayName 계산 정책과 일관성을 유지한다.
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
                    text: '회사 프로필, PER, PSR, EPS 같은 밸류에이션 지표, ROE와 마진으로 보는 수익성, 부채와 현금흐름을 통한 재무 건전성, 애널리스트 컨센서스와 목표 주가를 함께 볼 수 있습니다.',
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
            {
                '@type': 'Question',
                name: '동종업계 대비 비교는 어떻게 보나요?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: '같은 페이지의 동종업계 표(Peers)에서 같은 섹터의 다른 종목들과 PER, PSR, ROE, 마진 같은 핵심 지표를 한눈에 비교할 수 있습니다. 단일 종목의 절대값만 보면 비싸 보이거나 싸 보이는 착시를 줄여줍니다.',
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
                <SymbolPageHeading>
                    {displayName} 재무지표와 애널리스트 의견
                </SymbolPageHeading>
                <section className="sr-only">
                    <h2>{displayName} 펀더멘털 분석 개요</h2>
                    <p>
                        {displayName}
                        {sector !== '' ? `(${sector} 섹터)` : ''}의 펀더멘털
                        분석. 회사 프로필, 밸류에이션(PER, PSR, EPS),
                        수익성(ROE, 마진), 재무건전성, 애널리스트 컨센서스
                        목표가를 분석합니다.
                    </p>
                </section>
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
