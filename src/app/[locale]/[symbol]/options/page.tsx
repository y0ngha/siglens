import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { buildSymbolTabBreadcrumbJsonLd } from '@/app/[locale]/[symbol]/_lib/symbolTabBreadcrumb';
import {
    enterSymbolTabMetadata,
    enterSymbolTabPage,
    type SymbolTabParams,
} from '@/app/[locale]/[symbol]/_lib/symbolTabEntry';
import { getBlockedSymbolMetadata } from '@/app/[locale]/[symbol]/symbolIndexabilityMetadata';
import { buildSymbolWebPageJsonLd } from '@/app/[locale]/[symbol]/symbolWebPageJsonLd';
import { toClientOptionsSnapshot } from '@/entities/options-chain/lib/clientOptionsSnapshot';
import { resolveSnapshotSlots } from '@/entities/options-chain/lib/optionsSlots';
import { findSnapshotForLocale } from '@/entities/seo-snapshot/lib/findSnapshotForLocale';
import { getSeoSnapshotsStatic } from '@/entities/seo-snapshot/server/getSnapshotStatic';
import { hasOptionsProse } from '@/entities/seo-snapshot/lib/optionsContent';
import { isTabAllowedForSymbol } from '@/entities/ticker/api';
import { buildAssetAboutNode } from '@/entities/ticker/lib/assetClassification';
import { getAssetInfoResilient } from '@/entities/ticker/server/getAssetInfoResilient';
import { buildDisplayName, pickAssetName } from '@/entities/ticker/lib/ticker';
import { SymbolRouteParams } from '@/shared/config/market';
import { ALWAYS_NOINDEX_TAB_ROBOTS } from '@/shared/lib/seo';
import { buildSymbolOptionsSeoContent } from '@/shared/lib/seoSymbol';
import { isUnresolvableDegraded } from '@/shared/lib/symbolGuard';
import { symbolMetadataFromSeo } from '@/shared/lib/symbolMetadata';
import { JsonLd } from '@/shared/ui/JsonLd';
import { OptionsSnapshotProse } from '@/views/symbol/snapshot/renderers/OptionsSnapshotProse';
import { SymbolPageHeading } from '@/views/symbol/ui/SymbolPageHeading';
import { OptionsEmptyState } from '@/widgets/options/OptionsEmptyState';
import { OptionsPageClient } from '@/widgets/options/OptionsPageClient';

import { loadHasOptionsMarket, loadOptionsSnapshot } from './_lib/optionsData';

/** ISR 상한. SSR은 만기일 목록뿐이고 Max Pain·IV·OI는 클라가 그린다. */
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
 * 옵션 탭 메타데이터 — **항상 noindex**. 이 탭의 산문은 더는 프리웜되지 않아 옵션 체인 수치표만
 * 남는다. 옵션 없는 종목도 같다(`follow`는 남겨 형제 탭 안내 링크를 크롤러가 따라가게 한다).
 *
 * 크립토엔 이 탭이 없다 — 본문과 같은 `isTabAllowedForSymbol` 판정으로 메타데이터 단계에서도 404다.
 * 옵션 시장 여부는 카피(`hasOptions`)에만 쓰여 차단 판정과 겹쳐 기다린다.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const {
        locale,
        ticker: upper,
        tSeo,
        assetInfo,
        degraded,
    } = await enterSymbolTabMetadata(params);
    if (!(await isTabAllowedForSymbol(upper, 'options'))) notFound();
    const [hasOptions, blockedMetadata] = await Promise.all([
        loadHasOptionsMarket(
            upper,
            '[generateMetadata:options] hasOptionsMarket infra failure, degrading to false:'
        ),
        getBlockedSymbolMetadata({
            locale,
            symbol: upper,
            assetInfo,
            degraded,
            revalidateSeconds: revalidate,
            tab: 'options',
        }),
    ]);
    if (blockedMetadata) return blockedMetadata;

    const displayName = buildDisplayName(assetInfo, upper, locale);
    const seo = buildSymbolOptionsSeoContent(upper, tSeo, {
        displayName,
        koreanName: assetInfo.koreanName,
        englishName: assetInfo.name,
        locale,
        hasOptions,
    });
    return {
        ...symbolMetadataFromSeo(seo, locale),
        robots: ALWAYS_NOINDEX_TAB_ROBOTS,
    };
}

/**
 * 옵션 탭 본문(미국 주식 전용) — 옵션 시장·스냅샷이 있으면 체인 화면을, 없거나 조회가 실패하면 빈 상태
 * 화면을 렌더한다. 스냅샷 산문은 두 경우 모두 유지한다.
 *
 * AI 스냅샷 산문과 AI 위젯(`OptionsPageClient` 안)은 같은 결론을 그리므로 XOR이다 — 산문이 렌더
 * 가능하면 위젯은 `hasSnapshotProse`로 화면만 끈 채 마운트를 유지한다(공유 등록 때문).
 */
export default async function OptionsPage({ params }: Props) {
    const { locale, ticker: upper } = await enterSymbolTabPage(params);
    // 탭 가드(크립토 404)를 번역·자산·스냅샷 읽기와 같이 시작한다. Yahoo를 부르는 옵션 시장 조회만 가드
    // 결과에 묶어 크립토에는 부르지 않는다. 자산은 레이아웃이 이미 읽은 캐시 엔트리라 크립토도 가드
    // 전에 읽어도 왕복이 늘지 않는다.
    const tabAllowedPromise = isTabAllowedForSymbol(upper, 'options');
    const [
        t,
        tSeo,
        tabAllowed,
        { assetInfo, degraded },
        hasOptions,
        snapshots,
    ] = await Promise.all([
        getTranslations('app.symbol'),
        getTranslations('shared.seo'),
        tabAllowedPromise,
        getAssetInfoResilient(upper),
        tabAllowedPromise.then(allowed =>
            allowed
                ? loadHasOptionsMarket(
                      upper,
                      '[OptionsPage] hasOptionsMarket failed, degrading to false:'
                  )
                : false
        ),
        // revalidate는 이 페이지 선언과 같은 값이라 색인 게이트의 읽기와 캐시를 공유한다.
        getSeoSnapshotsStatic(upper, revalidate, locale),
    ]);
    if (!tabAllowed) notFound();
    const optionsSnapshot = findSnapshotForLocale(snapshots, 'options', locale);
    // 프로즈 컴포넌트와 같은 `narrowOptionsContent` 판정이라 둘이 어긋나지 않는다.
    const showOptionsProse = hasOptionsProse(optionsSnapshot?.content);

    // 두 데이터 소스가 동시에 죽어 형상만으로 실재를 보증할 수 없는 심볼 → 다른 탭과 같은 404.
    if (isUnresolvableDegraded(upper, degraded)) notFound();
    if (!assetInfo) notFound();

    const displayName = buildDisplayName(assetInfo, upper, locale);
    // 이 탭은 미국 주식 전용이라(위 탭 가드) 시장 프로필을 고정한다 — `OptionsSnapshotProseProps` JSDoc.
    const snapshotProse = (
        <OptionsSnapshotProse
            content={optionsSnapshot?.content}
            symbol={upper}
            displayName={displayName}
            marketProfile="us-equity"
            generatedAt={optionsSnapshot?.generatedAt}
            plain={optionsSnapshot?.plain}
        />
    );
    // 옵션 시장이 없거나(조회 실패 포함) 스냅샷을 못 읽으면 빈 상태 화면 — 산문은 렌더 가능할 때만 싣는다.
    const emptyState = (
        <OptionsEmptyState
            symbol={upper}
            snapshotSlot={showOptionsProse ? snapshotProse : undefined}
        />
    );
    if (!hasOptions) return emptyState;

    const snapshot = await loadOptionsSnapshot(upper);
    if (snapshot === null) return emptyState;

    // 수집 시점에 확정한 슬롯 매핑을 쓴다 — 묵은 스냅샷을 지금 시각으로 다시 매핑하면 날짜가 밀려
    // 칩이 바뀌거나 사라진다. 매핑이 없는 슬롯은 칩을 그리지 않는다.
    const slots = resolveSnapshotSlots(snapshot, new Date());
    // 클라이언트가 읽는 계약 필드만 보낸다(`toClientOptionsSnapshot` JSDoc).
    const clientSnapshot = toClientOptionsSnapshot(snapshot);

    // 여기까지 왔으면 옵션 시장이 있다 — 메타데이터와 달리 `false` 분기가 없어 상수로 둔다.
    const { fullTitle, description, url } = buildSymbolOptionsSeoContent(
        upper,
        tSeo,
        {
            displayName,
            koreanName: assetInfo.koreanName,
            englishName: assetInfo.name,
            locale,
            hasOptions: true,
        }
    );

    // about 노드는 stock으로 분류된 경우만 채워지고, ETF·지수·모호한 종목은 undefined로 생략된다.
    const aboutNode = buildAssetAboutNode(
        upper,
        pickAssetName(assetInfo, upper, locale),
        assetInfo.fmpSymbol
    );
    const jsonLd = buildSymbolWebPageJsonLd({
        url,
        name: fullTitle,
        description,
        about: aboutNode,
        locale,
        // 화면에 실제로 그려지는 스냅샷일 때만 신선도를 주장한다.
        generatedAt: showOptionsProse ? optionsSnapshot?.generatedAt : null,
    });
    const breadcrumbJsonLd = await buildSymbolTabBreadcrumbJsonLd({
        ticker: upper,
        displayName,
        tab: 'options',
        tabUrl: url,
        tSeo,
        locale,
    });

    return (
        <>
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            {/* 빈 상태 화면(`OptionsEmptyState`)은 자체 <main>을 가진다 — 정상 경로도 같은 main
                랜드마크와 폭으로 감싼다(`OptionsPageClient`는 폭을 다시 잡지 않는다). */}
            <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
                <SymbolPageHeading>
                    {t('page.ba2808', { v0: displayName })}
                </SymbolPageHeading>
                {/* AI 위젯은 클라 훅으로 데이터를 받아 ISR HTML에 골격만 남긴다 — 크롤러가 읽는 AI
                    문장은 이 산문뿐이다. 스냅샷이 없으면 null. */}
                {snapshotProse}
                <OptionsPageClient
                    symbol={upper}
                    companyName={displayName}
                    snapshot={clientSnapshot}
                    slots={slots}
                    hasSnapshotProse={showOptionsProse}
                />
            </main>
        </>
    );
}
