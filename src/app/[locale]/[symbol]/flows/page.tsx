import { getTranslations } from 'next-intl/server';
import { resolveLocale } from '@/shared/i18n/locales';
import { getBlockedSymbolMetadata } from '@/app/[locale]/[symbol]/symbolIndexabilityMetadata';
import { getProfileResilient } from '@/entities/ticker/lib/getProfileResilient';
import { FlowsDegraded } from '@/app/[locale]/[symbol]/flows/FlowsDegraded';
import { InvestorFlowsContent } from '@/widgets/investor-flows/InvestorFlowsContent';
import { InvestorFlowsEmpty } from '@/widgets/investor-flows/InvestorFlowsEmpty';
import { InvestorFlowsSummary } from '@/widgets/investor-flows/InvestorFlowsSummary';
import { KrInvestorFlowsContent } from '@/widgets/investor-flows/KrInvestorFlowsContent';
import { isKrDisclosureCollecting } from '@/entities/investor-flows/lib/investorFlowsReadiness';
import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import {
    getInvestorFlowsScorecard,
    type InvestorFlowsScorecardResult,
} from '@/entities/investor-flows/server/getInvestorFlowsScorecard';
import { SymbolPageHeading } from '@/views/symbol/ui/SymbolPageHeading';
import { CrossLinkCards } from '@/shared/ui/CrossLinkCards';
import { JsonLd } from '@/shared/ui/JsonLd';
import { type SymbolRouteParams } from '@/shared/config/market';
import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
import { isUnresolvableDegraded } from '@/shared/lib/symbolGuard';
import { buildAssetAboutNode } from '@/entities/ticker/lib/assetClassification';
import { buildDisplayName, pickAssetName } from '@/entities/ticker/lib/ticker';
import { getAssetInfoResilient } from '@/entities/ticker/lib/getAssetInfoResilient';
import { startWhenResolvable } from '@/app/[locale]/[symbol]/startWhenResolvable';
import { shortenRevalidateForRuntimeDegrade } from '@/shared/cache/buildDegradedRevalidate';
import { requireResolvableAsset } from '@/app/[locale]/[symbol]/requireResolvableAsset';
import {
    ALWAYS_NOINDEX_TAB_ROBOTS,
    buildBreadcrumbJsonLd,
} from '@/shared/lib/seo';
import {
    buildSymbolFlowsSeoContent,
    buildSymbolSeoContent,
} from '@/shared/lib/seoSymbol';
import { symbolMetadataFromSeo } from '@/shared/lib/symbolMetadata';
import { buildSymbolWebPageJsonLd } from '@/app/[locale]/[symbol]/symbolWebPageJsonLd';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';
import { enterLocale } from '@/shared/lib/enterLocale';

// 수급 스냅샷(`getInvestorFlowsSnapshot`)이 12시간 캐시라 페이지도 12시간이다 — Next는 렌더 중 읽힌
// `unstable_cache` revalidate의 최솟값으로 라우트 revalidate를 낮추므로(`symbolTabRevalidateClamp` 가드),
// 페이지 선언을 스냅샷 TTL(`SECONDS_PER_HALF_DAY`)과 맞춘다. 13F는 하루 한 번 이하, FINRA는 영업일마다,
// DART 지분공시는 하루 두 번 수집돼 반나절이면 새 공시·결제일이 다음 방문에 반영된다.
// app/CLAUDE.md ISR 4축 규약 §4: route segment config must stay a literal for Next.js static analysis (the magic-number-extraction rule does not apply here).
export const revalidate = 43200; // 12h

// generateStaticParams가 없으면 revalidate가 무력화된다(Next.js). 빈 배열 = 빌드 시 prebuild
// 없이, 첫 요청에 렌더+캐시 후 revalidate 주기로 재생성하는 on-demand ISR.
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
    if (!isAdmissibleSymbolShape(upper)) notFound();
    // 존재하지 않는 심볼은 레이아웃과 같은 판정으로 여기서도 404다(`requireResolvableAsset`).
    const { assetInfo, degraded } = await requireResolvableAsset(upper);
    // 본문 `isTabAllowedForSymbol` 가드와 같은 판정으로 메타데이터 단계에서도 404다(크립토엔 이 탭이 없다).
    // 한국 주식은 DART 지분공시로 열린다(기관·외국인 순매수는 KRX 재배포 라이선스로 계속 제외).
    if (!(await isTabAllowedForSymbol(upper, 'flows'))) notFound();
    const blockedMetadata = await getBlockedSymbolMetadata({
        locale,
        symbol: upper,
        assetInfo,
        degraded,
        revalidateSeconds: revalidate,
        tab: 'flows',
    });
    if (blockedMetadata) return blockedMetadata;

    const displayName = buildDisplayName(assetInfo, upper, locale);
    const seo = buildSymbolFlowsSeoContent(upper, tSeo, {
        displayName,
        koreanName: assetInfo.koreanName,
        englishName: assetInfo.name,
        locale,
    });
    // **항상 noindex** — 색인 정책은 의회 거래·펀더멘털 탭과 같다(종목별 색인은 차트·뉴스·공포탐욕 세 탭).
    // 13F·내부자·DART 지분공시 표는 숫자와 이름만 바뀌는 데이터라 색인 근거가 못 된다. 한국 종목도 같다.
    return {
        ...symbolMetadataFromSeo(seo, locale),
        robots: ALWAYS_NOINDEX_TAB_ROBOTS,
    };
}

export default async function FlowsPage({ params }: Props) {
    const { locale: rawLocale, symbol } = await params;
    const locale = enterLocale(rawLocale);
    const t = await getTranslations('app.symbol');
    const tSeo = await getTranslations('shared.seo');
    const upper = symbol.toUpperCase();

    if (!isAdmissibleSymbolShape(upper)) {
        notFound();
    }

    // Hard-404 crypto — 수급 원천이 없다. 미국 주식은 13F·Form 4·FINRA·SEC, 한국 주식은 DART 지분공시다.
    if (!(await isTabAllowedForSymbol(upper, 'flows'))) notFound();
    const krListing = isKrEquitySymbol(upper);

    // 수급 fetch는 profile 게이트를 기다리지 않는다 — 캐시된 자산 해석이 이 심볼을 실재(non-null, 비 degrade)로
    // 확인하는 즉시 시작해 나머지 게이트와 겹친다(`startWhenResolvable` JSDoc). 존재하지 않는 심볼에는
    // DB·FMP를 쏘지 않는다.
    const assetPromise = getAssetInfoResilient(upper);
    const flowsPromise = startWhenResolvable(assetPromise, () =>
        getInvestorFlowsScorecard(upper)
    );

    // getProfileResilient uses the ['fundamental:profile', upper] key shared with the fundamental page,
    // so there is no extra FMP round-trip.
    const [{ profile, degraded: profileDegraded }, { assetInfo, degraded }] =
        await Promise.all([getProfileResilient(upper), assetPromise]);

    // degraded + digit-first 심볼 = 자산 해석 불가 → 차트 페이지와 동일한 notFound 처리.
    if (isUnresolvableDegraded(upper, degraded)) notFound();

    const displayName = assetInfo
        ? buildDisplayName(assetInfo, upper, locale)
        : upper;

    // FMP 인프라 일시 실패: 500 대신 degrade 안내(200)를 렌더한다. 다음 revalidate에 복구되면 자동 갱신.
    if (profileDegraded) {
        return (
            <FlowsDegraded
                displayName={displayName}
                symbol={upper}
                krListing={krListing}
            />
        );
    }

    // profile === null = FMP 200 + 빈 결과 = 실존하지 않는 종목 → 404.
    if (profile === null) {
        notFound();
    }

    // 위에서 자산 해석 직후 시작했다. 자산이 미해석·degrade라 시작하지 않았다면 지금 읽는다.
    const flows =
        (await flowsPromise) ?? (await getInvestorFlowsScorecard(upper));

    if (flows.degraded) {
        // 저장소 장애로 degrade된 렌더가 12시간 굳지 않게 5분으로 낮춘다.
        await shortenRevalidateForRuntimeDegrade();
        return (
            <FlowsDegraded
                displayName={displayName}
                symbol={upper}
                krListing={krListing}
            />
        );
    }

    const { fullTitle, description, url } = buildSymbolFlowsSeoContent(
        upper,
        tSeo,
        {
            displayName,
            koreanName: assetInfo?.koreanName,
            englishName: assetInfo?.name,
            locale,
        }
    );

    // about 노드는 stock으로 분류된 경우만 채워지고, ETF/Index/모호한 종목은 undefined로 자연 생략된다.
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
        // 스냅샷 프로즈가 없는 탭이라 신선도(dateModified)를 주장하지 않는다.
        generatedAt: null,
    });

    // 셋째 마디 이름은 헤더 가시 브레드크럼(`SymbolLayoutHeader`)과 같은 `shared.symbolTab` 키다 —
    // 구글은 마크업과 화면 텍스트가 다르면 breadcrumb 마크업을 무시한다.
    const tTab = await getTranslations('shared.symbolTab');
    const breadcrumbJsonLd = buildBreadcrumbJsonLd(
        [
            { name: displayName, url: buildSymbolSeoContent(upper, tSeo).url },
            { name: tTab('flows'), url },
        ],
        locale
    );

    const heading = krListing
        ? t('flows.krHeading', { v0: displayName })
        : t('flows.heading', { v0: displayName });

    return (
        <>
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
                <SymbolPageHeading>{heading}</SymbolPageHeading>
                <FlowsTabBody
                    flows={flows}
                    symbol={upper}
                    krListing={krListing}
                />
                <CrossLinkCards
                    symbol={upper}
                    current="flows"
                    marketProfile={krListing ? 'kr-equity' : 'us-equity'}
                />
            </main>
        </>
    );
}

/**
 * 탭 본문 — 데이터 없음(빈 상태) / 한국 레이아웃 / 미국 레이아웃 중 하나. 데이터가 없는 종목은 AI를 부르지 않는다.
 *
 * 한국은 DART 백필 상태만 본다 — 13F·FINRA가 수집 중이어도 "수집 중"이 뜨지 않는다(설계 §4.5). 한국 레이아웃은 점수 → 기준
 * 시점·출처 → 대량보유 → 임원·주요주주 → 거래계획 → AI 해석이다(표를 먼저 읽고 해석을 보게 한다).
 *
 * 미국은 AI 해석을 탭 맨 위에 둔다(제품 결정). 데이터 표를 읽기 전에 결론부터 보게 하려는 것이다 — 다른 탭의 순서(의회 거래:
 * AI 먼저, 펀더멘털: 프로필 → AI, 재무제표: 점수 → AI)와 맞추려는 것이 아니다. 스트림이 도착하기 전에는 스켈레톤이 같은 자리를
 * 잡고, 그 높이는 도착한 결과와 비슷하게 `InvestorFlowsSummary`가 예약해(`SUMMARY_RESERVED_HEIGHT`) 아래 점수 카드가 밀리지 않는다.
 */
function FlowsTabBody({
    flows,
    symbol,
    krListing,
}: {
    readonly flows: InvestorFlowsScorecardResult;
    readonly symbol: string;
    readonly krListing: boolean;
}) {
    const {
        snapshot,
        scorecard,
        finraEnabled,
        regShoEnabled,
        readiness,
        krCompany,
    } = flows;
    if (snapshot === null || scorecard === null) {
        return krListing ? (
            <InvestorFlowsEmpty
                market="kr"
                collecting={isKrDisclosureCollecting(readiness, null)}
            />
        ) : (
            <InvestorFlowsEmpty
                collecting={readiness.institutional === 'collecting'}
                shortCollecting={
                    finraEnabled && readiness.short === 'collecting'
                }
            />
        );
    }
    if (krListing) {
        return (
            <>
                <KrInvestorFlowsContent
                    snapshot={snapshot}
                    scorecard={scorecard}
                    readiness={readiness}
                    krCompany={krCompany}
                />
                <InvestorFlowsSummary symbol={symbol} />
            </>
        );
    }
    return (
        <>
            <InvestorFlowsSummary symbol={symbol} />
            <InvestorFlowsContent
                snapshot={snapshot}
                scorecard={scorecard}
                finraEnabled={finraEnabled}
                regShoEnabled={regShoEnabled}
                readiness={readiness}
            />
        </>
    );
}
