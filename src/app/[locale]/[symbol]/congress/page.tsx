import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { buildSymbolTabBreadcrumbJsonLd } from '@/app/[locale]/[symbol]/_lib/symbolTabBreadcrumb';
import {
    enterSymbolTabMetadata,
    enterSymbolTabPage,
    type SymbolTabParams,
} from '@/app/[locale]/[symbol]/_lib/symbolTabEntry';
import { getCongressPageData } from '@/app/[locale]/[symbol]/congress/congressData';
import { CongressDegraded } from '@/app/[locale]/[symbol]/congress/CongressDegraded';
import { startWhenResolvable } from '@/app/[locale]/[symbol]/startWhenResolvable';
import { getBlockedSymbolMetadata } from '@/app/[locale]/[symbol]/symbolIndexabilityMetadata';
import { buildSymbolWebPageJsonLd } from '@/app/[locale]/[symbol]/symbolWebPageJsonLd';
import { hasCongressProse } from '@/entities/seo-snapshot/lib/congressContent';
import { findSnapshotForLocale } from '@/entities/seo-snapshot/lib/findSnapshotForLocale';
import { getSeoSnapshotsStatic } from '@/entities/seo-snapshot/server/getSnapshotStatic';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';
import { buildAssetAboutNode } from '@/entities/ticker/lib/assetClassification';
import { getAssetInfoResilient } from '@/entities/ticker/server/getAssetInfoResilient';
import { getProfileResilient } from '@/entities/ticker/server/getProfileResilient';
import { buildDisplayName, pickAssetName } from '@/entities/ticker/lib/ticker';
import { shortenRevalidateForRuntimeDegrade } from '@/shared/cache/buildDegradedRevalidate';
import { type SymbolRouteParams } from '@/shared/config/market';
import { ALWAYS_NOINDEX_TAB_ROBOTS } from '@/shared/lib/seo';
import { buildSymbolCongressSeoContent } from '@/shared/lib/seoSymbol';
import { isUnresolvableDegraded } from '@/shared/lib/symbolGuard';
import { symbolMetadataFromSeo } from '@/shared/lib/symbolMetadata';
import { CrossLinkCards } from '@/shared/ui/CrossLinkCards';
import { JsonLd } from '@/shared/ui/JsonLd';
import { CongressSnapshotProse } from '@/views/symbol/snapshot/renderers/CongressSnapshotProse';
import { SymbolPageHeading } from '@/views/symbol/ui/SymbolPageHeading';
import { CongressTradesTable } from '@/widgets/congress/CongressTradesTable';
import { CongressTrendSummary } from '@/widgets/congress/CongressTrendSummary';

/**
 * ISR 상한. 의회 거래는 STOCK Act상 신고 마감(거래일 +30~45일) 이후 공시돼 일 단위 갱신이면 새 공시를
 * 다음 날 안에 반영한다.
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
 * 의회 거래 탭 메타데이터 — **항상 noindex**. 이 탭의 산문은 더는 프리웜되지 않고, 거래 목록은 숫자·
 * 이름만 바뀌는 표라 색인 근거가 못 된다.
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
    if (!(await isTabAllowedForSymbol(upper, 'congress'))) notFound();
    const blockedMetadata = await getBlockedSymbolMetadata({
        locale,
        symbol: upper,
        assetInfo,
        degraded,
        revalidateSeconds: revalidate,
        tab: 'congress',
    });
    if (blockedMetadata) return blockedMetadata;

    const displayName = buildDisplayName(assetInfo, upper, locale);
    const seo = buildSymbolCongressSeoContent(upper, tSeo, {
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
 * 의회 거래 탭 본문(미국 주식 전용) — 프로필 게이트(FMP profile) 뒤에 AI 요약·거래 표를 렌더한다.
 *
 * - degrade는 FMP 인프라 장애뿐이다(프로필 또는 거래 조회). 거래 0건은 정상 상태 — 거래가 없는
 *   종목이 많아 표의 빈 상태로 렌더한다. 거래 쪽 degrade는 그 렌더가 24h 굳지 않게 revalidate를
 *   짧게 낮춘다.
 * - AI 스냅샷 산문과 AI 위젯은 같은 결론을 그리므로 XOR이다 — 산문이 렌더 가능하면 위젯은
 *   `hideView`로 화면만 끈 채 마운트를 유지한다(헤더 공유 버튼의 `useRegisterShareable`).
 */
export default async function CongressPage({ params }: Props) {
    const { locale, ticker: upper } = await enterSymbolTabPage(params);
    // 크립토는 이 탭이 없다(주식 전용) — 다른 읽기 전에 끊는다.
    const [t, tSeo, tabAllowed] = await Promise.all([
        getTranslations('app.symbol'),
        getTranslations('shared.seo'),
        isTabAllowedForSymbol(upper, 'congress'),
    ]);
    if (!tabAllowed) notFound();

    // 의회 거래 fetch는 profile·스냅샷 게이트를 기다리지 않는다 — 캐시된 자산 해석이 이 심볼을
    // 실재(non-null, 비 degrade)로 확인하는 즉시 시작해 나머지 게이트와 겹친다(`startWhenResolvable`
    // JSDoc). 존재하지 않는 심볼에는 FMP를 쏘지 않는다.
    const assetPromise = getAssetInfoResilient(upper);
    const tradesPromise = startWhenResolvable(assetPromise, () =>
        getCongressPageData(upper)
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
    const congressSnapshot = findSnapshotForLocale(
        snapshots,
        'congress',
        locale
    );
    // 프로즈 컴포넌트와 같은 `narrowCongressContent` 판정이라 둘이 어긋나지 않는다.
    const showCongressProse = hasCongressProse(congressSnapshot?.content);

    // 두 데이터 소스가 동시에 죽어 형상만으로 실재를 보증할 수 없는 심볼 → 다른 탭과 같은 404.
    if (isUnresolvableDegraded(upper, degraded)) notFound();

    // 이 탭은 FMP 프로필만 있어도 렌더한다 — 자산 디렉터리에 없는 종목은 티커를 표시명으로 쓴다.
    const displayName = assetInfo
        ? buildDisplayName(assetInfo, upper, locale)
        : upper;

    // 스냅샷이 있으면 degrade 화면에도 산문을 남겨 크롤 가능한 본문을 유지한다.
    if (profileDegraded) {
        return (
            <CongressDegraded
                displayName={displayName}
                symbol={upper}
                snapshotContent={congressSnapshot?.content}
                snapshotGeneratedAt={congressSnapshot?.generatedAt}
            />
        );
    }

    // 프로필 "빈 결과"(FMP 200 + 빈 응답) = 실존하지 않는 종목 → 404.
    if (profile === null) {
        notFound();
    }

    // 위에서 자산 해석 직후 시작했다. 자산이 미해석·degrade라 시작하지 않았다면 지금 읽는다.
    const { trades, degraded: tradesDegraded } =
        (await tradesPromise) ?? (await getCongressPageData(upper));

    if (tradesDegraded) {
        // FMP 장애(렌더 예산 초과 포함)로 degrade된 렌더가 24h 굳지 않게 5분으로 낮춘다.
        await shortenRevalidateForRuntimeDegrade();
        return (
            <CongressDegraded
                displayName={displayName}
                symbol={upper}
                snapshotContent={congressSnapshot?.content}
                snapshotGeneratedAt={congressSnapshot?.generatedAt}
            />
        );
    }

    const { fullTitle, description, url } = buildSymbolCongressSeoContent(
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
        generatedAt: showCongressProse ? congressSnapshot?.generatedAt : null,
    });

    const breadcrumbJsonLd = await buildSymbolTabBreadcrumbJsonLd({
        ticker: upper,
        displayName,
        tab: 'congress',
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
                    {t('page.e607c1', { v0: displayName })}
                </SymbolPageHeading>
                {/* AI 위젯은 클라 훅으로 데이터를 받아 ISR HTML에 골격만 남긴다 — 크롤러가 읽는 AI
                    문장은 이 스냅샷 산문뿐이다. */}
                {showCongressProse && (
                    <CongressSnapshotProse
                        content={congressSnapshot?.content}
                        symbol={upper}
                        displayName={displayName}
                        // congress 탭은 us-equity 전용이다 —
                        // CongressSnapshotProseProps JSDoc 참고.
                        marketProfile="us-equity"
                        generatedAt={congressSnapshot?.generatedAt}
                        plain={congressSnapshot?.plain}
                    />
                )}
                <CongressTrendSummary
                    symbol={upper}
                    hideView={showCongressProse}
                />

                <CongressTradesTable trades={trades} />
                <CrossLinkCards symbol={upper} current="congress" />
            </main>
        </>
    );
}
