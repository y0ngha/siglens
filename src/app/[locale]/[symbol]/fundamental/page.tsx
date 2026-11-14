import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ErrorBoundary } from 'react-error-boundary';

import { buildSymbolTabBreadcrumbJsonLd } from '@/app/[locale]/[symbol]/_lib/symbolTabBreadcrumb';
import {
    enterSymbolTabMetadata,
    enterSymbolTabPage,
    type SymbolTabParams,
} from '@/app/[locale]/[symbol]/_lib/symbolTabEntry';
import { getBlockedSymbolMetadata } from '@/app/[locale]/[symbol]/symbolIndexabilityMetadata';
import { buildSymbolWebPageJsonLd } from '@/app/[locale]/[symbol]/symbolWebPageJsonLd';
import {
    flagNoindexDegradedRender,
    shortenRevalidateForRuntimeDegrade,
} from '@/shared/cache/buildDegradedRevalidate';
import { getFundamentalFacts } from '@/entities/fundamental-facts/server/getFundamentalFacts';
import { hasFundamentalProse } from '@/entities/seo-snapshot/lib/fundamentalContent';
import { findSnapshotForLocale } from '@/entities/seo-snapshot/lib/findSnapshotForLocale';
import { getSeoSnapshotsStatic } from '@/entities/seo-snapshot/server/getSnapshotStatic';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';
import { buildAssetAboutNode } from '@/entities/ticker/lib/assetClassification';
import { getAssetInfoResilient } from '@/entities/ticker/server/getAssetInfoResilient';
import { getProfileResilient } from '@/entities/ticker/server/getProfileResilient';
import { buildDisplayName, pickAssetName } from '@/entities/ticker/lib/ticker';
import { SymbolRouteParams } from '@/shared/config/market';
import {
    marketProfileOf,
    profileIdForSymbol,
} from '@/shared/config/marketProfile/registry';
import { type MarketProfileId } from '@/shared/config/marketProfile/types';
import { ALWAYS_NOINDEX_TAB_ROBOTS } from '@/shared/lib/seo';
import { buildSymbolFundamentalSeoContent } from '@/shared/lib/seoSymbol';
import { isUnresolvableDegraded } from '@/shared/lib/symbolGuard';
import { symbolMetadataFromSeo } from '@/shared/lib/symbolMetadata';
import { CrossLinkCards } from '@/shared/ui/CrossLinkCards';
import { JsonLd } from '@/shared/ui/JsonLd';
import { FundamentalSnapshotProse } from '@/views/symbol/snapshot/renderers/FundamentalSnapshotProse';
import { SymbolPageHeading } from '@/views/symbol/ui/SymbolPageHeading';
import { FundamentalAiSummary } from '@/widgets/fundamental/FundamentalAiSummary';
import { FundamentalAiSummaryError } from '@/widgets/fundamental/FundamentalAiSummaryError';
import { FundamentalAiSummarySkeleton } from '@/widgets/fundamental/FundamentalAiSummarySkeleton';
import { FundamentalFactsCard } from '@/widgets/fundamental/sections/FundamentalFactsCard';

import {
    FinancialHealthSection,
    FutureDirectionSection,
    GrowthSection,
    PeersSection,
    ProfileSection,
    ProfitabilitySection,
    ValuationSection,
} from './_components/FundamentalSections';
import { FundamentalDegraded } from './FundamentalDegraded';

/**
 * ISR 상한 — 사실 블록이 읽는 수급 스냅샷(`getInvestorFlowsSnapshot`, `unstable_cache` 12h)과 맞춘다.
 * 더 길게 선언해도 렌더 중 읽힌 가장 짧은 `unstable_cache`로 내려간다(`symbolTabRevalidateClamp`).
 */
export const revalidate = 43200; // 12h

/**
 * 빈 배열 = 빌드 시 prebuild 없이 첫 요청에 렌더+캐시하는 on-demand ISR. 없으면 동적 세그먼트가
 * 매 요청 동적 렌더돼 `revalidate`가 무력화된다.
 */
export async function generateStaticParams(): Promise<SymbolRouteParams[]> {
    return [];
}

interface Props {
    params: SymbolTabParams;
}

/**
 * 펀더멘털 탭 메타데이터 — **사실 블록이 3개 이상 그려질 때만 색인**(2026-11-07, 그전엔 항상 noindex).
 * 프로필·지표 카드는 전 종목이 같은 표를 채울 뿐이라, 종목 고유 텍스트인 "재무·수급 요약" 사실 수를
 * 게이트로 쓴다(`getFundamentalFacts` — 본문과 같은 함수·같은 요청 캐시, CP-2). 입력은 데이터뿐이고
 * 방문자가 채우는 캐시(AI 산문)는 읽지 않아 색인 여부가 방문 이력에 따라 흔들리지 않는다.
 *
 * 크립토엔 이 탭이 없다 — 본문과 같은 `isTabAllowedForSymbol` 판정으로 메타데이터 단계에서도
 * 404다(탭 카피 + self-canonical이 404 응답에 얹히지 않게).
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const {
        locale,
        ticker: upper,
        tSeo,
        assetInfo,
        degraded,
    } = await enterSymbolTabMetadata(params);
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
    // 본문이 degrade 안내(`FundamentalDegraded`)나 404를 그리는 경우엔 사실을 읽지 않고 noindex다.
    // 프로필은 본문과 같은 캐시 키라 추가 비용이 없고, 없는 종목이 사실 입력원(FMP·DB)을 때리지 않는다.
    const { profile, degraded: profileDegraded } =
        await getProfileResilient(upper);
    const { indexable } =
        profileDegraded || profile === null
            ? { indexable: false }
            : await getFundamentalFacts(upper);
    if (indexable) return symbolMetadataFromSeo(seo, locale);
    return {
        ...symbolMetadataFromSeo(seo, locale),
        robots: ALWAYS_NOINDEX_TAB_ROBOTS,
    };
}

/**
 * 펀더멘털 탭 본문 — 프로필 게이트(FMP profile) 뒤에 프로필·AI 요약·지표 카드 섹션을 렌더한다.
 *
 * - FMP 프로필 조회가 인프라 장애로 degrade되면 500 대신 안내 화면(200, 메타는 noindex)을 렌더하고,
 *   다음 revalidate에 자동 복구된다. 프로필이 "빈 결과"면 실존하지 않는 종목이라 404다.
 * - AI 스냅샷 산문과 AI 위젯은 같은 결론을 그리므로 XOR이다 — 산문이 렌더 가능하면 산문만 보이고,
 *   위젯은 `hideView`로 화면만 끈 채 마운트를 유지한다(헤더 공유 버튼의 `useRegisterShareable`).
 */
export default async function FundamentalPage({ params }: Props) {
    const { locale, ticker: upper } = await enterSymbolTabPage(params);
    // 크립토는 이 탭이 없다(주식 전용) — 다른 읽기 전에 끊는다.
    const [t, tSeo, tabAllowed] = await Promise.all([
        getTranslations('app.symbol'),
        getTranslations('shared.seo'),
        isTabAllowedForSymbol(upper, 'fundamental'),
    ]);
    if (!tabAllowed) notFound();

    // 프로필은 `ProfileSection`과 같은 `fundamental:profile` 키라 요청·요청 간 캐시를 공유한다.
    // 자산 정보는 한국어 종목명을 표시명에 합치려고 함께 읽는다. 스냅샷 revalidate는 이 페이지
    // 선언과 같은 값이라 색인 게이트의 읽기와 캐시를 공유한다.
    const [
        { profile, degraded: profileDegraded },
        { assetInfo, degraded },
        snapshots,
    ] = await Promise.all([
        getProfileResilient(upper),
        getAssetInfoResilient(upper),
        getSeoSnapshotsStatic(upper, revalidate, locale),
    ]);
    const fundamentalSnapshot = findSnapshotForLocale(
        snapshots,
        'fundamental',
        locale
    );
    const showFundamentalProse = hasFundamentalProse(
        fundamentalSnapshot?.content
    );

    // 두 데이터 소스가 동시에 죽어 형상만으로 실재를 보증할 수 없는 심볼 → 다른 탭과 같은 404.
    if (isUnresolvableDegraded(upper, degraded)) notFound();
    // 이 탭은 FMP 프로필만 있어도 렌더한다 — 자산 디렉터리에 없는 종목은 티커를 표시명으로 쓴다.
    const displayName = assetInfo
        ? buildDisplayName(assetInfo, upper, locale)
        : upper;
    // 자산 정보가 없으면 심볼 형상으로 시장을 판정한다(`marketProfileOf` 내부 폴백과 같은 규칙).
    // `CrossLinkCards` 기본값(us-equity)에 맡기면 한국 종목에 없는 `/options`·`/congress` 링크가 나간다.
    const marketProfile: MarketProfileId = assetInfo
        ? marketProfileOf(assetInfo)
        : profileIdForSymbol(upper);
    if (profileDegraded) {
        // 이 렌더는 안내문 + `noindex`다. 300초 창이 지나면 stale로 내보내지 않게 표시한다 —
        // 안 하면 다음 요청자(롱테일에서는 몇 시간 뒤의 크롤러)가 이 `noindex` 사본을 받는다.
        await flagNoindexDegradedRender();
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
    if (profile === null) {
        notFound();
    }
    // 404·degrade 분기 뒤에 읽는다 — 없는 종목(봇이 찍는 임의 티커)이 실적·수급·목표가 입력원을 때리지 않게.
    const factsResult = await getFundamentalFacts(upper);
    // 입력원 장애로 불완전한 렌더(메타는 noindex)가 12h 동안 굳지 않게, 섹션 degrade와 같이
    // 이 렌더의 revalidate를 짧게 낮춘다 — 복구되면 다음 재생성에서 다시 판정한다.
    // 그 렌더는 `noindex`이므로(`getFundamentalFacts`의 `indexable`) 창이 지난 뒤 stale로도
    // 내보내지 않는다 — 위 프로필 degrade와 같은 이유다.
    if (!factsResult.complete) {
        await shortenRevalidateForRuntimeDegrade();
        await flagNoindexDegradedRender();
    }
    // sitemap 스탬프는 여기서 쓰지 않는다 — 렌더 중 Redis 쓰기(Upstash REST no-store fetch)는 ISR을
    // 동적으로 뒤집는다(e2e 실측). 스탬프는 SEO 프리웜이 같은 판정으로 채운다(`fundamentalStamps.ts`).

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

    // about 노드는 stock으로 분류된 경우만 채워지고, ETF·지수·모호한 종목은 undefined로 생략된다.
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
        // 화면에 실제로 그려지는 스냅샷일 때만 신선도를 주장한다.
        generatedAt: showFundamentalProse
            ? fundamentalSnapshot?.generatedAt
            : null,
    });
    const breadcrumbJsonLd = await buildSymbolTabBreadcrumbJsonLd({
        ticker: upper,
        displayName,
        tab: 'fundamental',
        // 섹터 없는 기본 URL — 섹터는 카피에만 쓰이고 경로에는 들어가지 않는다.
        tabUrl: buildSymbolFundamentalSeoContent(upper, tSeo).url,
        tSeo,
        locale,
    });

    return (
        <>
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
                <SymbolPageHeading>
                    {t('page.9e0659', { v0: displayName })}
                </SymbolPageHeading>
                {/* 종목 고유 문장이라 프로필(FMP 회사 소개 — 웹 전체에 같은 글)보다 앞에 둔다. */}
                <FundamentalFactsCard
                    facts={factsResult.facts}
                    symbol={upper}
                    displayName={displayName}
                />
                {/* 서버 데이터 섹션은 Suspense로 감싸지 않는다 — 서버 데이터 경계는 raw HTML에
                    스켈레톤 + 숨김 청크를 남겨 JS 없는 크롤러에게 본문을 뒤로 밀고, 교체 순간 레이아웃이
                    흔들린다. 형제 async 섹션은 서버에서 병렬로 렌더되고, 실패는 섹션마다 흡수한다.
                    남는 경계는 클라 위젯 `FundamentalAiSummary`의 것 하나뿐이다
                    (`src/__tests__/guards/serverDataSuspenseBoundaries.test.ts`). */}
                <ProfileSection symbol={upper} locale={locale} />

                {/* AI 위젯은 클라 훅으로 데이터를 받아 ISR HTML에 골격만 남긴다 — 크롤러가 읽는 AI
                    문장은 이 스냅샷 산문뿐이다. */}
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
