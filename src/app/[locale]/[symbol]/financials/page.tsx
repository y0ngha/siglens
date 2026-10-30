import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { buildSymbolTabBreadcrumbJsonLd } from '@/app/[locale]/[symbol]/_lib/symbolTabBreadcrumb';
import {
    enterSymbolTabMetadata,
    enterSymbolTabPage,
    type SymbolTabParams,
} from '@/app/[locale]/[symbol]/_lib/symbolTabEntry';
import { getFinancialsPageData } from '@/app/[locale]/[symbol]/financials/financialData';
import { FinancialsDegraded } from '@/app/[locale]/[symbol]/financials/FinancialsDegraded';
import { startWhenResolvable } from '@/app/[locale]/[symbol]/startWhenResolvable';
import { getBlockedSymbolMetadata } from '@/app/[locale]/[symbol]/symbolIndexabilityMetadata';
import { buildSymbolWebPageJsonLd } from '@/app/[locale]/[symbol]/symbolWebPageJsonLd';
import { isEmptyFinancialsSnapshot } from '@/entities/financials-statements/lib/financialsSnapshot';
import { hasFinancialsProse } from '@/entities/seo-snapshot/lib/financialsContent';
import { findSnapshotForLocale } from '@/entities/seo-snapshot/lib/findSnapshotForLocale';
import { getSeoSnapshotsStatic } from '@/entities/seo-snapshot/lib/getSnapshotStatic';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';
import { buildAssetAboutNode } from '@/entities/ticker/lib/assetClassification';
import { getAssetInfoResilient } from '@/entities/ticker/lib/getAssetInfoResilient';
import { getProfileResilient } from '@/entities/ticker/lib/getProfileResilient';
import { buildDisplayName, pickAssetName } from '@/entities/ticker/lib/ticker';
import { shortenRevalidateForRuntimeDegrade } from '@/shared/cache/buildDegradedRevalidate';
import { type SymbolRouteParams } from '@/shared/config/market';
import {
    marketProfileOf,
    profileIdForSymbol,
} from '@/shared/config/marketProfile/registry';
import { type MarketProfileId } from '@/shared/config/marketProfile/types';
import {
    ALWAYS_NOINDEX_TAB_ROBOTS,
    buildSymbolFinancialsSeoContent,
} from '@/shared/lib/seo';
import { isUnresolvableDegraded } from '@/shared/lib/symbolGuard';
import { symbolMetadataFromSeo } from '@/shared/lib/symbolMetadata';
import { CrossLinkCards } from '@/shared/ui/CrossLinkCards';
import { JsonLd } from '@/shared/ui/JsonLd';
import { FinancialsSnapshotProse } from '@/views/symbol/snapshot/renderers/FinancialsSnapshotProse';
import { SymbolPageHeading } from '@/views/symbol/ui/SymbolPageHeading';
import { FinancialsAiSummary } from '@/widgets/financials/FinancialsAiSummary';
import { FinancialsScorecard } from '@/widgets/financials/FinancialsScorecard';
import { FinancialsStatements } from '@/widgets/financials/FinancialsStatements';
import { deriveStatementCurrency } from '@/widgets/financials/utils/statementCurrency';

/**
 * ISR 상한. 재무제표는 분기(약 45일) 단위로 갱신돼, 엣지 캐시를 최대한 쓰면서 다음 분기 공시 전에
 * 묵은 데이터를 내지 않는 균형점이다.
 */
export const revalidate = 86400; // 24h

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
 * 재무제표 탭 메타데이터 — **항상 noindex**. 이 탭의 산문은 더는 프리웜되지 않아, 남는 건 숫자만
 * 바뀌는 재무표다(종목별 공포·탐욕 탭을 noindex로 돌렸던 근거와 같은 형태).
 *
 * 크립토엔 이 탭이 없다 — 본문과 같은 `isTabAllowedForSymbol` 판정으로 메타데이터 단계에서도 404다.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const {
        locale,
        ticker: upper,
        tSeo,
        assetInfo,
        degraded,
    } = await enterSymbolTabMetadata(params);
    if (!(await isTabAllowedForSymbol(upper, 'financials'))) notFound();
    const blockedMetadata = await getBlockedSymbolMetadata({
        locale,
        symbol: upper,
        assetInfo,
        degraded,
        revalidateSeconds: revalidate,
        tab: 'financials',
    });
    if (blockedMetadata) return blockedMetadata;

    const displayName = buildDisplayName(assetInfo, upper, locale);
    const seo = buildSymbolFinancialsSeoContent(upper, tSeo, {
        displayName,
        koreanName: assetInfo.koreanName,
        englishName: assetInfo.name,
        locale,
    });
    return {
        ...symbolMetadataFromSeo(seo, locale),
        robots: ALWAYS_NOINDEX_TAB_ROBOTS,
    };
}

/**
 * 재무제표 탭 본문 — 프로필 게이트(FMP profile) 뒤에 점수표·AI 요약·재무제표를 렌더한다.
 *
 * - 프로필 조회가 인프라 장애로 degrade되거나 재무 6종이 모두 비면(대개 FMP 일시 장애) 500 대신
 *   안내 화면(200)을 렌더한다. 후자는 그 렌더가 24h 굳지 않게 revalidate를 짧게 낮춘다 — 재무가
 *   정말 없는 종목도 같아지지만, ISR은 방문이 있어야 재생성해 비용은 방문당 최대 5분에 한 번이다.
 * - AI 스냅샷 산문과 AI 위젯은 같은 결론을 그리므로 XOR이다 — 산문이 렌더 가능하면 위젯은
 *   `hideView`로 화면만 끈 채 마운트를 유지한다(헤더 공유 버튼의 `useRegisterShareable`).
 */
export default async function FinancialsPage({ params }: Props) {
    const { locale, ticker: upper } = await enterSymbolTabPage(params);
    // 크립토는 이 탭이 없다(주식 전용) — 다른 읽기 전에 끊는다.
    const [t, tSeo, tabAllowed] = await Promise.all([
        getTranslations('app.symbol'),
        getTranslations('shared.seo'),
        isTabAllowedForSymbol(upper, 'financials'),
    ]);
    if (!tabAllowed) notFound();

    // 재무 6종 fetch는 profile·스냅샷 게이트를 기다리지 않는다 — 캐시된 자산 해석이 이 심볼을
    // 실재(non-null, 비 degrade)로 확인하는 즉시 시작해 나머지 게이트와 겹친다(`startWhenResolvable`
    // JSDoc). 존재하지 않는 심볼에는 FMP를 쏘지 않는다.
    const assetPromise = getAssetInfoResilient(upper);
    const pageDataPromise = startWhenResolvable(assetPromise, () =>
        getFinancialsPageData(upper)
    );

    // 프로필은 펀더멘털 탭과 같은 `fundamental:profile` 키라 FMP 왕복이 늘지 않는다. 스냅샷
    // revalidate는 이 페이지 선언과 같은 값이라 색인 게이트의 읽기와 캐시를 공유한다.
    const [
        { profile, degraded: profileDegraded },
        { assetInfo, degraded },
        snapshots,
    ] = await Promise.all([
        getProfileResilient(upper),
        assetPromise,
        getSeoSnapshotsStatic(upper, revalidate, locale),
    ]);
    const financialsSnapshot = findSnapshotForLocale(
        snapshots,
        'financials',
        locale
    );
    // 프로즈 컴포넌트와 같은 `narrowFinancialsContent` 판정이라 둘이 어긋나지 않는다.
    const showFinancialsProse = hasFinancialsProse(financialsSnapshot?.content);

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

    // 스냅샷이 있으면 degrade 화면에도 산문을 남겨 크롤 가능한 본문을 유지한다.
    if (profileDegraded) {
        return (
            <FinancialsDegraded
                displayName={displayName}
                symbol={upper}
                marketProfile={marketProfile}
                snapshotContent={financialsSnapshot?.content}
                snapshotGeneratedAt={financialsSnapshot?.generatedAt}
            />
        );
    }

    // 프로필 "빈 결과"(FMP 200 + 빈 응답) = 실존하지 않는 종목 → 404.
    if (profile === null) {
        notFound();
    }

    // 위에서 자산 해석 직후 시작했다. 자산이 미해석·degrade라 시작하지 않았다면 지금 읽는다.
    const { snapshot, scorecard } =
        (await pageDataPromise) ?? (await getFinancialsPageData(upper));

    // 6종이 모두 비면 점수표가 전 축 F로 오인 렌더된다 — 안내 화면으로 바꾼다.
    if (isEmptyFinancialsSnapshot(snapshot)) {
        await shortenRevalidateForRuntimeDegrade();
        return (
            <FinancialsDegraded
                displayName={displayName}
                symbol={upper}
                marketProfile={marketProfile}
                snapshotContent={financialsSnapshot?.content}
                snapshotGeneratedAt={financialsSnapshot?.generatedAt}
            />
        );
    }

    const { fullTitle, description, url } = buildSymbolFinancialsSeoContent(
        upper,
        tSeo,
        {
            displayName,
            koreanName: assetInfo?.koreanName,
            englishName: assetInfo?.name,
            locale,
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
        generatedAt: showFinancialsProse
            ? financialsSnapshot?.generatedAt
            : null,
    });

    const breadcrumbJsonLd = await buildSymbolTabBreadcrumbJsonLd({
        ticker: upper,
        displayName,
        tab: 'financials',
        tabUrl: url,
        tSeo,
        locale,
    });

    return (
        <>
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
                <SymbolPageHeading>
                    {t('page.465a63', { v0: displayName })}
                </SymbolPageHeading>
                <FinancialsScorecard
                    scorecard={scorecard}
                    currency={deriveStatementCurrency(snapshot, upper)}
                />

                {/* AI 위젯은 클라 훅으로 데이터를 받아 ISR HTML에 골격만 남긴다 — 크롤러가 읽는 AI
                    문장은 이 스냅샷 산문뿐이다. */}
                {showFinancialsProse && (
                    <FinancialsSnapshotProse
                        content={financialsSnapshot?.content}
                        symbol={upper}
                        displayName={displayName}
                        marketProfile={marketProfile}
                        generatedAt={financialsSnapshot?.generatedAt}
                        plain={financialsSnapshot?.plain}
                    />
                )}
                <FinancialsAiSummary
                    symbol={upper}
                    hideView={showFinancialsProse}
                />

                <FinancialsStatements
                    symbol={upper}
                    annualSnapshot={snapshot}
                />
                <CrossLinkCards
                    symbol={upper}
                    current="financials"
                    marketProfile={marketProfile}
                />
            </main>
        </>
    );
}
