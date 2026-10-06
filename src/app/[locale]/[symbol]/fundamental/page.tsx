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
    getRatiosTtm,
    getStockPeers,
} from '@/app/[locale]/[symbol]/fundamental/fundamentalData';
import { type Locale, resolveLocale } from '@/shared/i18n/locales';
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
import { SymbolPageHeading } from '@/views/symbol/ui/SymbolPageHeading';
import { FundamentalSnapshotProse } from '@/views/symbol/snapshot/renderers/FundamentalSnapshotProse';
import { hasFundamentalProse } from '@/entities/seo-snapshot/lib/fundamentalContent';
import { CrossLinkCards } from '@/shared/ui/CrossLinkCards';
import { JsonLd } from '@/shared/ui/JsonLd';
import { SymbolRouteParams } from '@/shared/config/market';
import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
import { isUnresolvableDegraded } from '@/shared/lib/symbolGuard';
import { SECONDS_PER_DAY } from '@/shared/config/time';
import { getSeoSnapshotsStatic } from '@/entities/seo-snapshot/lib/getSnapshotStatic';
import { buildAssetAboutNode } from '@/entities/ticker/lib/assetClassification';
import { buildDisplayName, pickAssetName } from '@/entities/ticker/lib/ticker';
import { getAssetInfoResilient } from '@/entities/ticker/lib/getAssetInfoResilient';
import { requireResolvableAsset } from '@/app/[locale]/[symbol]/requireResolvableAsset';
import {
    ALWAYS_NOINDEX_TAB_ROBOTS,
    buildBreadcrumbJsonLd,
    buildSymbolFundamentalSeoContent,
    buildSymbolSeoContent,
    symbolMetadataFromSeo,
} from '@/shared/lib/seo';
import { buildSymbolWebPageJsonLd } from '@/app/[locale]/[symbol]/symbolWebPageJsonLd';
import { getProfileResilient } from '@/entities/ticker/lib/getProfileResilient';
import { shortenRevalidateForRuntimeDegrade } from '@/shared/cache/buildDegradedRevalidate';
import { FundamentalDegraded } from './FundamentalDegraded';
import { loadProfileDescription } from './profileDescription';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';
import {
    marketProfileOf,
    profileIdForSymbol,
} from '@/shared/config/marketProfile/registry';
import { type MarketProfileId } from '@/shared/config/marketProfile/types';
import { enterLocale } from '@/shared/lib/enterLocale';

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
    const locale = resolveLocale(rawLocale);
    const tSeo = await getTranslations({ locale, namespace: 'shared.seo' });
    const upper = symbol.toUpperCase();
    // 본문·레이아웃 notFound()와 일관: 형식이 잘못된 세그먼트는 메타데이터 단계에서도 404다.
    // 레이아웃이 notFound()를 던져도 이 페이지의 generateMetadata 결과가 이기므로, 여기서
    // 메타를 돌려주면 404 응답에 홈 상속 title·og가 얹힌다(e2e `not-found.spec.ts`).
    if (!isAdmissibleSymbolShape(upper)) notFound();
    // 존재하지 않는 심볼은 레이아웃과 같은 판정으로 여기서도 404다(`requireResolvableAsset`).
    const { assetInfo, degraded } = await requireResolvableAsset(upper);
    // 본문 `isTabAllowedForSymbol` 가드와 같은 판정으로 메타데이터 단계에서도 404다(크립토엔
    // 이 탭이 없다). 레이아웃·본문이 notFound()를 던져도 generateMetadata 결과가 이기므로,
    // 여기서 탭 카피 + self-canonical을 돌려주면 404 응답이 정상 페이지 메타를 단다.
    if (!(await isTabAllowedForSymbol(upper, 'fundamental'))) notFound();
    const blockedMetadata = await getBlockedSymbolMetadata({
        locale,
        symbol: upper,
        assetInfo,
        degraded,
        revalidateSeconds: revalidate,
        tab: 'fundamental',
    });
    if (blockedMetadata) return blockedMetadata;

    const displayName = buildDisplayName(assetInfo, upper, locale);
    const seo = buildSymbolFundamentalSeoContent(upper, tSeo, {
        displayName,
        koreanName: assetInfo.koreanName,
        englishName: assetInfo.name,
        locale,
    });
    // **항상 noindex** (2026-10-01 SEO 감사, `SEO_RECOVERY_2026_09.md` §10).
    // 프리웜이 이 탭의 산문을 더는 굽지 않는다(`PREWARM_TABS`). 남는 것은 전 종목이
    // 같은 표를 채우는 프로필·지표 카드뿐이라 종목 고유 텍스트가 없다 — 예전
    // "산문 없으면 noindex" 게이트가 이제 항상 참이 되므로 조건 없이 막는다. 조건부로
    // 두면 사용자 방문이 만든 캐시 유무에 따라 색인 여부가 흔들린다.
    return {
        ...symbolMetadataFromSeo(seo, locale),
        robots: ALWAYS_NOINDEX_TAB_ROBOTS,
    };
}

interface SymbolSectionProps {
    symbol: string;
}

interface LocalizedSectionProps extends SymbolSectionProps {
    locale: Locale;
}

/**
 * FMP 섹션 로더 실패를 흡수하는 공통 degrade: 로그를 남기고, **이 렌더의 revalidate를 5분으로
 * 낮춘 뒤**(`shortenRevalidateForRuntimeDegrade`) 빈 상태 값을 돌려준다.
 *
 * 왜 낮추나: 렌더 경로의 FMP 호출은 짧은 예산(시도당 3초·재시도 1회·429 대기 없음 —
 * `renderBudget.ts`)으로 돈다. 일시적인 지연·레이트 리밋만으로도 섹션이 빈 카드로 렌더될 수 있는데,
 * 그 HTML이 라우트 revalidate(24h) 동안 굳으면 안 된다. ISR은 요청이 와야만 재생성하므로, 짧아진
 * revalidate의 비용은 "장애가 이어지는 동안 그 페이지 방문당 최대 5분에 한 번 재렌더"뿐이다 —
 * 그래서 봉 캐시와 달리 큐레이션 종목으로 한정하지 않는다.
 */
async function degradeSection<T>(
    label: string,
    error: unknown,
    fallback: T
): Promise<T> {
    console.error(label, error);
    await shortenRevalidateForRuntimeDegrade();
    return fallback;
}

export async function ProfileSection({
    symbol,
    locale,
}: LocalizedSectionProps) {
    // 프로필과 AI 번역 설명을 **함께 시작**한다 — 설명은 프로필 결과에 의존하지 않는다
    // (원문 폴백만 프로필에서 온다). 예전엔 설명이 프로필 뒤의 별도 Suspense 경계라 직렬
    // 왕복이었고 raw HTML에 숨김 청크를 남겼다. 설명은 `PROFILE_DESCRIPTION_TIMEOUT_MS`로
    // 상한을 둔다(`loadProfileDescription`) — 늦으면 원문으로 렌더한다.
    const [profile, description] = await Promise.all([
        // Shares the same key as the notFound guard in the page body — cross-request ISR cache is shared.
        // ISR degrade guard: getProfile(FMP)가 throw하면 null 로 degrade → ProfileCard(null)가
        // 기존 empty-state UI를 렌더하고 페이지 크롬은 유지된다.
        staticSymbolCache(
            ['fundamental:profile', symbol],
            symbol,
            () => getProfile(symbol),
            [],
            SECONDS_PER_DAY
        ).catch((e: unknown) =>
            degradeSection(
                '[ProfileSection] getProfile failed, degrading to null:',
                e,
                null
            )
        ),
        loadProfileDescription(symbol, locale),
    ]);

    const descriptionSlot = (
        <p className="mt-4 line-clamp-4 text-sm leading-relaxed text-secondary-400">
            {description ?? profile?.description ?? ''}
        </p>
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
    ).catch((e: unknown) =>
        degradeSection(
            '[ValuationSection] getKeyMetricsTtm failed, degrading to null:',
            e,
            null
        )
    );
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
    ).catch((e: unknown) =>
        degradeSection(
            '[PeersSection] getStockPeers failed, degrading to []:',
            e,
            [] as Awaited<ReturnType<typeof getStockPeers>>
        )
    );
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
    ).catch((e: unknown) =>
        degradeSection(
            '[ProfitabilitySection] getRatiosTtm failed, degrading to null:',
            e,
            null
        )
    );
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
    ).catch((e: unknown) =>
        degradeSection(
            '[GrowthSection] getIncomeStatementGrowth failed, degrading to null:',
            e,
            null
        )
    );
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
        ).catch((e: unknown) =>
            degradeSection(
                '[FinancialHealthSection] getRatiosTtm failed, degrading to null:',
                e,
                null
            )
        ),
        staticSymbolCache(
            ['fundamental:scores', symbol],
            symbol,
            () => getFinancialScores(symbol),
            [],
            SECONDS_PER_DAY
        ).catch((e: unknown) =>
            degradeSection(
                '[FinancialHealthSection] getFinancialScores failed, degrading to null:',
                e,
                null
            )
        ),
        staticSymbolCache(
            ['fundamental:cashflow', symbol],
            symbol,
            () => getCashFlowStatement(symbol),
            [],
            SECONDS_PER_DAY
        ).catch((e: unknown) =>
            degradeSection(
                '[FinancialHealthSection] getCashFlowStatement failed, degrading to null:',
                e,
                null
            )
        ),
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
        ).catch((e: unknown) =>
            degradeSection(
                '[FutureDirectionSection] getAnalystEstimates failed, degrading to null:',
                e,
                null
            )
        ),
        staticSymbolCache(
            ['fundamental:grades-consensus', symbol],
            symbol,
            () => getGradesConsensus(symbol),
            [],
            SECONDS_PER_DAY
        ).catch((e: unknown) =>
            degradeSection(
                '[FutureDirectionSection] getGradesConsensus failed, degrading to null:',
                e,
                null
            )
        ),
        staticSymbolCache(
            ['fundamental:pt-consensus', symbol],
            symbol,
            () => getPriceTargetConsensus(symbol),
            [],
            SECONDS_PER_DAY
        ).catch((e: unknown) =>
            degradeSection(
                '[FutureDirectionSection] getPriceTargetConsensus failed, degrading to null:',
                e,
                null
            )
        ),
        staticSymbolCache(
            ['fundamental:pt-summary', symbol],
            symbol,
            () => getPriceTargetSummary(symbol),
            [],
            SECONDS_PER_DAY
        ).catch((e: unknown) =>
            degradeSection(
                '[FutureDirectionSection] getPriceTargetSummary failed, degrading to null:',
                e,
                null
            )
        ),
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
    const { locale: rawLocale, symbol } = await params;
    const locale = enterLocale(rawLocale);
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
        getSeoSnapshotsStatic(upper, revalidate, locale),
    ]);
    const fundamentalSnapshot = (snapshots ?? []).find(
        s => s.tab === 'fundamental'
    );
    // audit fix FIX 2: XOR 게이트 — 스냅샷 프로즈가 렌더 가능하면(hasFundamentalProse)
    // 그것만 보여준다. 클라이언트 AI 위젯은 계속 마운트하되 `hideView`로 UI만 끈다 —
    // 위젯을 아예 렌더하지 않으면 `useRegisterShareable`이 돌지 않아 헤더 공유
    // 버튼이 이 탭의 분석 결과를 등록받지 못한다(review round 2 fix: 챗 발행이
    // 아니라 공유 등록이 이 마운트를 필요로 한다).
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
        ? buildDisplayName(assetInfo, upper, locale)
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
            locale,
            sector: sector !== '' ? sector : undefined,
        }
    );

    // about 노드는 stock으로 분류된 경우만 채워지고, ETF/Index/모호한 종목은
    // undefined로 자연 생략된다 (assetClassification 모듈 doc 참고).
    // fundamental 페이지는 assetInfo가 optional이라 ticker를 fallback name으로
    // 사용해 displayName 계산 정책과 일관성을 유지한다.
    const aboutNode = buildAssetAboutNode(
        upper,
        assetInfo ? pickAssetName(assetInfo, upper, locale) : upper,
        assetInfo?.fmpSymbol
    );
    const jsonLd = buildSymbolWebPageJsonLd({
        url,
        name: fullTitle,
        description,
        about: aboutNode,
        locale,
        // 화면에 실제로 그려지는 스냅샷일 때만 신선도를 주장한다 —
        // 렌더 불가한 행은 본문에 한 글자도 남기지 않는다.
        generatedAt: showFundamentalProse
            ? fundamentalSnapshot?.generatedAt
            : null,
    });

    // 셋째 마디 이름은 헤더 가시 브레드크럼(`SymbolLayoutHeader`)과 같은 `shared.symbolTab` 키다 —
    // 구글은 마크업과 화면 텍스트가 다르면 breadcrumb 마크업을 무시한다.
    const tTab = await getTranslations('shared.symbolTab');
    const breadcrumbJsonLd = buildBreadcrumbJsonLd(
        [
            { name: displayName, url: buildSymbolSeoContent(upper, tSeo).url },
            {
                name: tTab('fundamental'),
                url: buildSymbolFundamentalSeoContent(upper, tSeo).url,
            },
        ],
        locale
    );

    return (
        <>
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
                <SymbolPageHeading>
                    {t('page.9e0659', { v0: displayName })}
                </SymbolPageHeading>
                {/* 서버 데이터 섹션은 Suspense로 감싸지 않는다 — 서버 데이터 경계는 raw HTML에
                    스켈레톤 + 숨김 `<template>` 청크를 남겨 JS 없는 크롤러에게 본문을 뒤로 밀고,
                    교체 순간 레이아웃이 흔들린다. 형제 async 섹션은 서버에서 병렬로 렌더되고,
                    각 섹션은 실패를 `degradeSection`으로 흡수한다(빈 카드 + 짧아진 revalidate).
                    남는 경계는 클라 위젯 `FundamentalAiSummary`의 것 하나뿐이다
                    (`src/__tests__/guards/serverDataSuspenseBoundaries.test.ts`). */}
                <ProfileSection symbol={upper} locale={locale} />

                {/* audit fix FIX 2: XOR — FundamentalAiSummary (client widget) and
                    FundamentalSnapshotProse (SSR prose) both render the same AI
                    conclusion (overallConclusionKo/categoryAssessments/
                    riskFactorsKo). Showing both duplicated the text for sighted
                    users and screen readers and doubled as a duplicate-content
                    SEO risk. When the snapshot is renderable, show the prose
                    only; the widget stays mounted with `hideView` so
                    `useRegisterShareable` keeps registering Share data, and
                    renders its own view only when no snapshot exists —
                    FundamentalAiSummary ('use client') fetches its analysis via
                    a client-side hook, so during ISR generation it has no data
                    yet and bakes its loading skeleton into the static HTML (no
                    crawlable AI text) until it hydrates. */}
                {showFundamentalProse && (
                    <FundamentalSnapshotProse
                        content={fundamentalSnapshot?.content}
                        symbol={upper}
                        displayName={displayName}
                        marketProfile={marketProfile}
                        generatedAt={fundamentalSnapshot?.generatedAt}
                        plain={fundamentalSnapshot?.plain}
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

                <ValuationSection symbol={upper} />
                <PeersSection symbol={upper} />
                <ProfitabilitySection symbol={upper} />
                <GrowthSection symbol={upper} />
                <FinancialHealthSection symbol={upper} />
                <FutureDirectionSection symbol={upper} />
                <CrossLinkCards
                    symbol={upper}
                    current="fundamental"
                    marketProfile={marketProfile}
                />
            </main>
        </>
    );
}
