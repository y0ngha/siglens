import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { buildSymbolTabBreadcrumbJsonLd } from '@/app/[locale]/[symbol]/_lib/symbolTabBreadcrumb';
import {
    enterSymbolTabMetadata,
    enterSymbolTabPage,
    type SymbolTabParams,
} from '@/app/[locale]/[symbol]/_lib/symbolTabEntry';
import { FlowsDegraded } from '@/app/[locale]/[symbol]/flows/FlowsDegraded';
import { startWhenResolvable } from '@/app/[locale]/[symbol]/startWhenResolvable';
import { getBlockedSymbolMetadata } from '@/app/[locale]/[symbol]/symbolIndexabilityMetadata';
import { buildSymbolWebPageJsonLd } from '@/app/[locale]/[symbol]/symbolWebPageJsonLd';
import { getInvestorFlowsScorecard } from '@/entities/investor-flows/server/getInvestorFlowsScorecard';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';
import { buildAssetAboutNode } from '@/entities/ticker/lib/assetClassification';
import { getAssetInfoResilient } from '@/entities/ticker/server/getAssetInfoResilient';
import { getProfileResilient } from '@/entities/ticker/server/getProfileResilient';
import { buildDisplayName, pickAssetName } from '@/entities/ticker/lib/ticker';
import { shortenRevalidateForRuntimeDegrade } from '@/shared/cache/buildDegradedRevalidate';
import { type SymbolRouteParams } from '@/shared/config/market';
import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import {
    ALWAYS_NOINDEX_TAB_ROBOTS,
    buildSymbolFlowsSeoContent,
} from '@/shared/lib/seo';
import { isUnresolvableDegraded } from '@/shared/lib/symbolGuard';
import { symbolMetadataFromSeo } from '@/shared/lib/symbolMetadata';
import { CrossLinkCards } from '@/shared/ui/CrossLinkCards';
import { JsonLd } from '@/shared/ui/JsonLd';
import { SymbolPageHeading } from '@/views/symbol/ui/SymbolPageHeading';

import { FlowsTabBody } from './_components/FlowsTabBody';

/**
 * ISR 상한 — 수급 스냅샷(`getInvestorFlowsSnapshot`) TTL(12h)과 맞춘다. Next는 렌더 중 읽힌
 * `unstable_cache` revalidate의 최솟값으로 라우트를 낮추므로(`symbolTabRevalidateClamp` 가드) 더 길게
 * 선언해도 소용이 없다. 13F는 하루 한 번 이하, FINRA는 영업일마다, DART 지분공시는 하루 두 번 수집돼
 * 반나절이면 새 공시·결제일이 다음 방문에 반영된다.
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
 * 수급 탭 메타데이터 — **항상 noindex**(종목별 색인은 차트·뉴스·공포탐욕 세 탭). 13F·내부자·DART
 * 지분공시 표는 숫자와 이름만 바뀌는 데이터라 색인 근거가 못 된다. 한국 종목도 같다.
 *
 * 크립토엔 수급 원천이 없어 이 탭이 없다 — 본문과 같은 판정으로 메타데이터 단계에서도 404다.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const {
        locale,
        ticker: upper,
        tSeo,
        assetInfo,
        degraded,
    } = await enterSymbolTabMetadata(params);
    // 한국 주식은 DART 지분공시로 열린다(기관·외국인 순매수는 KRX 재배포 라이선스로 제외).
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
    return {
        ...symbolMetadataFromSeo(seo, locale),
        robots: ALWAYS_NOINDEX_TAB_ROBOTS,
    };
}

/**
 * 수급 탭 본문 — 프로필 게이트(FMP profile) 뒤에 수급 점수·표·AI 해석을 렌더한다. 프로필이나 수급
 * 저장소가 인프라 장애로 degrade되면 500 대신 안내 화면(200)을 렌더하고, 수급 쪽 degrade는 그 렌더가
 * 12시간 굳지 않게 revalidate를 짧게 낮춘다.
 */
export default async function FlowsPage({ params }: Props) {
    const { locale, ticker: upper } = await enterSymbolTabPage(params);
    // 크립토는 수급 원천이 없어 404다. 미국 주식은 13F·Form 4·FINRA·SEC, 한국 주식은 DART 지분공시다.
    const [t, tSeo, tabAllowed] = await Promise.all([
        getTranslations('app.symbol'),
        getTranslations('shared.seo'),
        isTabAllowedForSymbol(upper, 'flows'),
    ]);
    if (!tabAllowed) notFound();
    const krListing = isKrEquitySymbol(upper);

    // 수급 fetch는 profile 게이트를 기다리지 않는다 — 캐시된 자산 해석이 이 심볼을 실재(non-null, 비 degrade)로
    // 확인하는 즉시 시작해 나머지 게이트와 겹친다(`startWhenResolvable` JSDoc). 존재하지 않는 심볼에는
    // DB·FMP를 쏘지 않는다.
    const assetPromise = getAssetInfoResilient(upper);
    const flowsPromise = startWhenResolvable(assetPromise, () =>
        getInvestorFlowsScorecard(upper)
    );

    // 프로필은 펀더멘털 탭과 같은 `fundamental:profile` 키라 FMP 왕복이 늘지 않는다.
    const [{ profile, degraded: profileDegraded }, { assetInfo, degraded }] =
        await Promise.all([getProfileResilient(upper), assetPromise]);

    // 두 데이터 소스가 동시에 죽어 형상만으로 실재를 보증할 수 없는 심볼 → 다른 탭과 같은 404.
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
        // 스냅샷 프로즈가 없는 탭이라 신선도(dateModified)를 주장하지 않는다.
        generatedAt: null,
    });

    const breadcrumbJsonLd = await buildSymbolTabBreadcrumbJsonLd({
        ticker: upper,
        displayName,
        tab: 'flows',
        tabUrl: url,
        tSeo,
        locale,
    });

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
