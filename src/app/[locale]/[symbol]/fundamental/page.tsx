import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
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
    getProfileDescription,
    getRatiosTtm,
    getStockPeers,
} from '@/app/[locale]/[symbol]/fundamental/fundamentalData';
import { setRequestLocale } from 'next-intl/server';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/shared/i18n/locales';
import { contentLocaleKeyPart } from '@/shared/cache/contentLocaleKeyPart';
import { getBlockedSymbolMetadata } from '@/app/[locale]/[symbol]/symbolIndexabilityMetadata';
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
import {
    FundamentalSnapshotProse,
    hasFundamentalProse,
} from '@/views/symbol/snapshot/renderers/FundamentalSnapshotProse';
import { CrossLinkCards } from '@/shared/ui/CrossLinkCards';
import { SectionSkeleton } from '@/views/symbol/SectionSkeleton';
import { JsonLd } from '@/shared/ui/JsonLd';
import { FaqSection } from '@/shared/ui/FaqSection';
import {
    SymbolRouteParams,
    isAdmissibleSymbolShape,
} from '@/shared/config/market';
import { isUnresolvableDegraded } from '@/shared/lib/symbolGuard';
import { SECONDS_PER_DAY } from '@/shared/config/time';
import { getSeoSnapshotsStatic } from '@/entities/seo-snapshot/lib/getSnapshotStatic';
import {
    buildAssetAboutNode,
    buildDisplayName,
    getAssetInfoResilient,
    pickAssetName,
} from '@/entities/ticker';
import {
    buildBreadcrumbJsonLd,
    buildFaqJsonLd,
    buildSnapshotMetaDescription,
    buildSymbolFundamentalSeoContent,
    buildSymbolSeoContent,
    buildWebPageJsonLd,
    symbolMetadataFromSeo,
    NOINDEX_SYMBOL_METADATA,
    noindexSymbolMetadata,
    type FaqItem,
} from '@/shared/lib/seo';
import { getProfileResilient } from './getProfileResilient';
import { FundamentalDegraded } from './FundamentalDegraded';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';
import {
    marketProfileOf,
    profileIdForSymbol,
    type MarketProfileId,
} from '@/shared/config/marketProfile';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';

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
    params: Promise<{ locale: string; symbol: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale: rawLocale, symbol } = await params;
    const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
    const tSeo = await getTranslations({ locale, namespace: 'shared.seo' });
    const upper = symbol.toUpperCase();
    // 본문 notFound()와 일관: 잘못된 ticker는 메타데이터를 비우고 noindex로 응답한다.
    if (!isAdmissibleSymbolShape(upper)) {
        return NOINDEX_SYMBOL_METADATA;
    }
    // 본문 `isTabAllowedForSymbol` 가드와 일관: 크립토 심볼은 fundamental 탭이 없으므로
    // generateMetadata도 동일 조건에서 NOINDEX로 반환한다. 가드 없이 계속 진행하면
    // 본문은 notFound()(noindex)인데 메타데이터는 canonical + index:true인 soft-404가 만들어진다.
    if (!(await isTabAllowedForSymbol(upper, 'fundamental'))) {
        return noindexSymbolMetadata(upper, tSeo, locale);
    }
    const { assetInfo, degraded } = await getAssetInfoResilient(upper);
    const blockedMetadata = await getBlockedSymbolMetadata({
        locale,
        symbol: upper,
        assetInfo,
        degraded,
        revalidateSeconds: revalidate,
        tab: 'fundamental',
    });
    if (blockedMetadata) return blockedMetadata;

    // 펀더멘털 페이지는 FMP profile이 있어야 렌더된다. profile을 본문/ProfileSection과
    // 동일한 정적 캐시 키로 미리 확인한다(같은 요청 내 React.cache + unstable_cache 공유라
    // 추가 FMP round-trip 없음). 그래서 본문 렌더 결과와 metadata noindex 판단이 일치한다:
    //   - profileDegraded(FMP 인프라 실패) → 본문은 degrade(200)를 렌더하므로 noindex.
    //   - profile === null(실존하지 않는 종목) → 본문은 notFound()이므로 noindex.
    // `displayName`을 가드보다 위에서 계산한다 — 아래 noindex 분기들도
    // `noindexSymbolMetadata`에 넘겨야 차단된 페이지가 티커가 아니라 사명까지
    // 담은 title/description을 갖는다. `buildDisplayName`은 순수 함수라 위치를
    // 올려도 부작용이 없다.
    const displayName = assetInfo
        ? buildDisplayName(assetInfo, upper, locale)
        : upper;

    const { profile, degraded: profileDegraded } =
        await getProfileResilient(upper);
    if (profileDegraded || profile === null) {
        return noindexSymbolMetadata(upper, tSeo, locale, {
            displayName,
            koreanName: assetInfo?.koreanName,
        });
    }
    // sector는 의도적으로 <meta description>에 쓰지 않는다(description은 sector 없는 base
    // 카피, 페이지 본문 JSON-LD만 sector 보강 카피). 위 profile 조회는 noindex 게이트 용도이며
    // 두 description 모두 동일 함수에서 파생되므로 핵심 의미는 일치한다.
    const seo = buildSymbolFundamentalSeoContent(upper, tSeo, {
        displayName,
        koreanName: assetInfo?.koreanName,
        englishName: assetInfo?.name,
        locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
    });
    const metadata = symbolMetadataFromSeo(seo, locale);

    // snapshot-derived unique description (spec 2026-07-24 Task 8). Same
    // getSeoSnapshotsStatic(upper, revalidate) call the page body makes below —
    // unstable_cache dedupes it within this render, so this is a cache hit, not
    // an extra DB round-trip. Falls back to the templated description when no
    // snapshot exists (backward compatible). og/twitter keep the templated copy
    // — only the search-facing <meta name="description"> is overridden.
    const snap = (await getSeoSnapshotsStatic(upper, revalidate, locale)).find(
        s => s.tab === 'fundamental'
    );
    const snapshotDescription = snap
        ? buildSnapshotMetaDescription(
              'fundamental',
              snap.content,
              displayName,
              locale
          )
        : null;
    return snapshotDescription
        ? { ...metadata, description: snapshotDescription }
        : metadata;
}

interface SymbolSectionProps {
    symbol: string;
}

interface LocalizedSectionProps extends SymbolSectionProps {
    locale: Locale;
}

function ProfileDescriptionSkeleton() {
    const t = useTranslations('app.symbol');
    return (
        <div className="mt-4 space-y-2">
            <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-secondary-500 border-t-transparent" />
                <span className="text-xs text-secondary-500">
                    {t('page.c6cf97')}
                </span>
            </div>
            <div className="animate-pulse space-y-1.5">
                <div className="h-3 w-full rounded bg-secondary-700" />
                <div className="h-3 w-[92%] rounded bg-secondary-700" />
                <div className="h-3 w-4/5 rounded bg-secondary-700" />
                <div className="h-3 w-3/5 rounded bg-secondary-700" />
            </div>
        </div>
    );
}

interface ProfileCardSkeletonProps {
    symbol: string;
}

function ProfileCardSkeleton({ symbol }: ProfileCardSkeletonProps) {
    const t = useTranslations('app.symbol');
    return (
        <section
            aria-labelledby="profile-heading"
            className="rounded-lg border border-secondary-700 bg-secondary-800 p-6"
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 id="profile-heading" className={HEADING_SECTION}>
                        <span className="inline-block h-5 w-36 animate-pulse rounded bg-secondary-700 align-middle" />
                        <span className="ml-2 text-base font-normal text-secondary-400">
                            ({symbol})
                        </span>
                    </h2>
                    <div className="mt-1 h-4 w-28 animate-pulse rounded bg-secondary-700" />
                </div>
                <div className="text-right">
                    <span className="text-xs tracking-[0.01em] text-secondary-400">
                        {t('page.cf643b')}
                    </span>
                    <div className="mt-0.5 h-6 w-20 animate-pulse rounded bg-secondary-700" />
                </div>
            </div>

            <dl className="mt-4 grid grid-cols-1 gap-y-2 sm:grid-cols-2">
                <div className="flex gap-2">
                    <dt className="w-10 shrink-0 text-sm text-secondary-400">
                        CEO
                    </dt>
                    <dd>
                        <div className="h-4 w-32 animate-pulse rounded bg-secondary-700" />
                    </dd>
                </div>
                <div className="flex gap-2">
                    <dt className="w-10 shrink-0 text-sm text-secondary-400">
                        {t('page.9f451a')}
                    </dt>
                    <dd>
                        <div className="h-4 w-40 animate-pulse rounded bg-secondary-700" />
                    </dd>
                </div>
            </dl>

            <ProfileDescriptionSkeleton />
        </section>
    );
}

interface ProfileDescriptionSectionProps {
    symbol: string;
    locale: Locale;
    fallback: string;
}

export async function ProfileDescriptionSection({
    symbol,
    locale,
    fallback,
}: ProfileDescriptionSectionProps) {
    // ISR degrade guard: getProfileDescription(AI 번역)이 throw하더라도 ISR 캐시에
    // 0-byte 빈 결과가 굳지 않도록 흡수한다. null 로 degrade → fallback(영어 원문)을 렌더.
    const description = await staticSymbolCache(
        // 로케일을 키에 넣지 않으면 먼저 생성된 로케일의 설명이 전 로케일에 굳는다.
        ['fundamental:desc', symbol, ...contentLocaleKeyPart(locale)],
        symbol,
        () => getProfileDescription(symbol, locale),
        [],
        SECONDS_PER_DAY
    ).catch((e: unknown) => {
        console.error(
            '[ProfileDescriptionSection] getProfileDescription failed, degrading to null:',
            e
        );
        return null;
    });
    return (
        <p className="mt-4 line-clamp-4 text-sm leading-relaxed text-secondary-400">
            {description ?? fallback}
        </p>
    );
}

export async function ProfileSection({
    symbol,
    locale,
}: LocalizedSectionProps) {
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
                locale={locale}
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
            symbol={symbol}
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
            symbol={symbol}
            estimates={estimates}
            grades={grades}
            ptConsensus={ptConsensus}
            ptSummary={ptSummary}
        />
    );
}

export default async function FundamentalPage({ params }: Props) {
    const { locale, symbol } = await params;
    // DB 스냅샷은 로케일별 행이라 좁혀진 로케일이 필요하다. URL 세그먼트는 신뢰 경계다.
    const resolved = isLocale(locale) ? locale : DEFAULT_LOCALE;
    // 정적 렌더 활성화. 이 호출이 없으면 next-intl의 서버 API가 `headers()`로
    // 폴백해 **이 라우트의 ISR이 통째로 꺼진다**(빌드 route 표에서 `●` → `ƒ`).
    // 실측으로 확인했다 — Next 16.2는 `next/root-params` 미지원이라 이 경로가 유일하다.
    setRequestLocale(locale);
    const t = await getTranslations('app.symbol');
    const tSeo = await getTranslations('shared.seo');
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
    // snapshots: ISR-safe (staticSymbolCache-wrapped, fail-open []) — see
    // getSeoSnapshotsStatic JSDoc. revalidateSeconds mirrors this page's
    // `export const revalidate` literal above.
    const [
        { profile, degraded: profileDegraded },
        { assetInfo, degraded },
        snapshots,
    ] = await Promise.all([
        getProfileResilient(upper),
        getAssetInfoResilient(upper),
        getSeoSnapshotsStatic(upper, revalidate, resolved),
    ]);
    const fundamentalSnapshot = snapshots.find(s => s.tab === 'fundamental');
    // audit fix FIX 2: XOR 게이트 — 스냅샷 프로즈가 렌더 가능하면(hasFundamentalProse)
    // 그것만 보여준다. 클라이언트 AI 위젯은 계속 마운트하되 `hideView`로 UI만 끈다 —
    // 위젯을 아예 렌더하지 않으면 `usePublishSymbolChat`이 돌지 않아 챗봇의 분석
    // 컨텍스트가 비어 입력이 잠긴다(스냅샷이 있을수록 챗이 막히는 역전).
    // 두 소스가 동일 필드(overallConclusionKo/categoryAssessments/riskFactorsKo)를
    // 같은 순서로 중복 렌더하던 문제(같은 결론을 사용자에게 두 번, 스크린리더에
    // 두 번, 중복 콘텐츠 SEO 리스크)를 해소한다. `OverallSnapshotProse
    // .hasOverallProse` 패턴과 동일 — narrowFundamentalContent를 재사용해 프로즈
    // 컴포넌트와 동일 판단.
    const showFundamentalProse = hasFundamentalProse(
        fundamentalSnapshot?.content
    );

    // degraded + digit-first 심볼 = crypto_assets DB와 FMP가 동시 다운 중이고 resolve 불가
    // → 차트 페이지와 동일한 notFound 처리로 sibling 일관성 유지.
    if (isUnresolvableDegraded(upper, degraded)) notFound();
    const displayName = assetInfo
        ? buildDisplayName(
              assetInfo,
              upper,
              isLocale(locale) ? locale : DEFAULT_LOCALE
          )
        : upper;
    // CrossLinkCards에 넘길 시장 프로필. fundamental은 assetInfo가 optional이라(FMP
    // profile만 있어도 렌더) marketProfileOf(assetInfo)를 못 쓸 수 있다 — 그 경우
    // 심볼 형상으로 판정한다(`profileIdForSymbol`, marketProfileOf 내부 fallback과
    // 동일 패턴). crypto는 isTabAllowedForSymbol('fundamental') 가드로 이미 걸러졌으므로
    // 여기 남는 값은 us-equity/kr-equity뿐이다. SEO 감사(2026-08-18): 이 값을 넘기지
    // 않으면 CrossLinkCards의 `marketProfile='us-equity'` 기본값으로 떨어져, 한국 종목
    // 페이지에도 존재하지 않는 `/options`·`/congress` 링크가 노출됐다.
    const marketProfile: MarketProfileId = assetInfo
        ? marketProfileOf(assetInfo)
        : profileIdForSymbol(upper);
    // FMP 인프라 일시 실패: 500 대신 degrade 안내(200)를 렌더한다. generateMetadata가
    // 동일 조건을 noindex 처리하므로 이 thin 페이지는 색인되지 않고, 다음 revalidate에
    // 인프라가 복구되면 정상 데이터로 자동 갱신된다. 스냅샷이 있으면 degrade 중에도
    // 크롤러에게 프로즈 콘텐츠를 보여준다(spec §7 — degraded 분기에서도 스냅샷 유지).
    if (profileDegraded) {
        return (
            <FundamentalDegraded
                displayName={displayName}
                symbol={upper}
                marketProfile={marketProfile}
                snapshotContent={fundamentalSnapshot?.content}
                snapshotGeneratedAt={fundamentalSnapshot?.generatedAt}
            />
        );
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
        tSeo,
        {
            displayName,
            koreanName: assetInfo?.koreanName,
            englishName: assetInfo?.name,
            locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
            sector: sector !== '' ? sector : undefined,
        }
    );

    // about 노드는 stock으로 분류된 경우만 채워지고, ETF/Index/모호한 종목은
    // undefined로 자연 생략된다 (assetClassification 모듈 doc 참고).
    // fundamental 페이지는 assetInfo가 optional이라 ticker를 fallback name으로
    // 사용해 displayName 계산 정책과 일관성을 유지한다.
    const aboutNode = buildAssetAboutNode(
        upper,
        assetInfo
            ? pickAssetName(
                  assetInfo,
                  upper,
                  isLocale(locale) ? locale : DEFAULT_LOCALE
              )
            : upper,
        assetInfo?.fmpSymbol
    );
    const jsonLd = buildWebPageJsonLd({
        url,
        name: fullTitle,
        description,
        about: aboutNode,
        locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
    });

    const breadcrumbJsonLd = buildBreadcrumbJsonLd(
        [
            { name: displayName, url: buildSymbolSeoContent(upper, tSeo).url },
            {
                name: t('page.412646'),
                url: buildSymbolFundamentalSeoContent(upper, tSeo).url,
            },
        ],
        isLocale(locale) ? locale : DEFAULT_LOCALE
    );

    /**
     * FAQ — 화면 `FaqSection`과 FAQPage 구조화데이터의 단일 소스.
     *
     * 첫 답변이 섹터를 품는다. 예전에는 같은 지표 나열이 화면에 보이지 않는
     * `sr-only` 개요 문단으로 따로 있었는데(섹터도 거기 있었다), 답변과 사실상
     * 같은 문장이라 크롤러에게 같은 말을 두 번 하는 셈이었다 — 문단을 지우고
     * 섹터만 여기로 옮겼다.
     */
    const faq: readonly FaqItem[] = [
        {
            question: tSeo('faq.fundamentalScope', { v0: displayName }),
            answer: tSeo('faq.fundamentalScopeAnswer', {
                v0:
                    displayName +
                    (sector !== ''
                        ? tSeo('faq.fundamentalSectorSuffix', { v0: sector })
                        : ''),
            }),
        },
        {
            question: t('page.8770b1'),
            answer: t('page.7b255a'),
        },
        {
            question: t('page.05f287'),
            answer: t('page.6e94dd'),
        },
    ];
    const faqJsonLd = buildFaqJsonLd(faq);

    return (
        <>
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <JsonLd data={faqJsonLd} />
            <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
                <SymbolPageHeading>
                    {t('page.9e0659', { v0: displayName })}
                </SymbolPageHeading>
                <Suspense fallback={<ProfileCardSkeleton symbol={upper} />}>
                    <ProfileSection symbol={upper} locale={resolved} />
                </Suspense>

                {/* audit fix FIX 2: XOR — FundamentalAiSummary (client widget) and
                    FundamentalSnapshotProse (SSR prose) both render the same AI
                    conclusion (overallConclusionKo/categoryAssessments/
                    riskFactorsKo). Showing both duplicated the text for sighted
                    users and screen readers and doubled as a duplicate-content
                    SEO risk. When the snapshot is renderable, show the prose
                    only; the widget stays mounted with `hideView` so it keeps publishing chat
                    context, and renders its own view only when no snapshot
                    exists — FundamentalAiSummary ('use client') fetches its
                    analysis via a client-side hook, so during ISR generation it
                    has no data yet and bakes its loading skeleton into the
                    static HTML (no crawlable AI text) until it hydrates. */}
                {showFundamentalProse && (
                    <FundamentalSnapshotProse
                        content={fundamentalSnapshot?.content}
                        symbol={upper}
                        displayName={displayName}
                        marketProfile={marketProfile}
                        generatedAt={fundamentalSnapshot?.generatedAt}
                    />
                )}
                <ErrorBoundary FallbackComponent={FundamentalAiSummaryError}>
                    <Suspense
                        fallback={
                            showFundamentalProse ? null : (
                                <FundamentalAiSummarySkeleton />
                            )
                        }
                    >
                        <FundamentalAiSummary
                            symbol={upper}
                            hideView={showFundamentalProse}
                        />
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

                <FaqSection
                    heading={tSeo('faqHeading.fundamental', {
                        v0: displayName,
                    })}
                    items={faq}
                />
                <CrossLinkCards
                    symbol={upper}
                    current="fundamental"
                    marketProfile={marketProfile}
                />
            </main>
        </>
    );
}
