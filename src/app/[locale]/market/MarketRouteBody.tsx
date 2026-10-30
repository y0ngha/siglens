import { Suspense, type ReactElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { HydrationBoundary } from '@tanstack/react-query';
import { peekBriefingStatic } from '@/entities/market-summary/api/briefingStaticCache';
import { MarketSummaryPanel } from '@/widgets/dashboard/MarketSummaryPanel';
import { MarketSummaryPanelSkeleton } from '@/widgets/dashboard/MarketSummaryPanelSkeleton';
import { SectorFactsSummary } from '@/widgets/dashboard/SectorFactsSummary';
import { SectorSignalPanel } from '@/widgets/dashboard/SectorSignalPanel';
import { SectorSignalPanelSkeleton } from '@/widgets/dashboard/SectorSignalPanelSkeleton';
import { SignalTypeGuide } from '@/widgets/dashboard/SignalTypeGuide';
import { DEFAULT_DASHBOARD_TIMEFRAME } from '@/shared/config/dashboard-tickers';
import {
    toClientScope,
    type DashboardScope,
} from '@/shared/config/dashboardScope';
import { ISO_DATE_HOUR_SLICE_END } from '@/shared/config/time';
import type { Locale } from '@/shared/i18n/locales';
import { brandTitle } from '@/shared/lib/brandName';
import {
    buildBreadcrumbJsonLd,
    buildWebPageJsonLd,
    SITE_URL,
    SYMBOLS_PATH,
} from '@/shared/lib/seo';
import { Breadcrumb } from '@/shared/ui/Breadcrumb';
import { JsonLd } from '@/shared/ui/JsonLd';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { RegionTabs } from '@/shared/ui/RegionTabs';
import { buildMarketItemListJsonLd } from './_lib/marketItemListJsonLd';
import { buildMarketDehydratedSeed } from './_lib/marketSeed';
import { marketCopyFor } from './copy';
import { loadMarketSignals } from './loadMarketSignals';

interface MarketScopeProps {
    readonly scope: DashboardScope;
}

/**
 * ISR-safe 시장 본문(패널 2개 + 전 섹터 크롤 텍스트). 서버 searchParams를 읽지 않는다 —
 * timeframe/sector는 `SectorSignalPanel`이 클라에서 `useUrlSearchParam`으로 읽는다. 그 훅의
 * 서버 스냅샷이 `null`이라 패널은 아래 seed의 기본 섹터/timeframe으로 서버 렌더되고(CSR
 * bailout 없음) 딥링크는 하이드레이션 직후 반영된다.
 *
 * 데이터 흐름:
 *   1. getMarketSummaryStatic / getSectorSignalsStatic — unstable_cache (1h)
 *   2. peekBriefingStatic — 캐시된 브리핑을 SSR seed로 읽는다(부수효과 없음)
 *   3. QueryClient.setQueryData — React Query에 seed를 넣어 즉시 하이드레이션
 *   4. SectorFactsSummary — 영구 서버 sibling(패널 아래), 전 섹터 요약 crawl text
 */
export async function MarketContent({
    scope,
}: MarketScopeProps): Promise<ReactElement> {
    // ISR date-hour 키: 같은 시간대면 같은 캐시 브리핑 peek를 읽는다 — 매 렌더 summary 전체를
    // 해싱하지 않는다.
    const dateHour = new Date().toISOString().slice(0, ISO_DATE_HOUR_SLICE_END);

    const { summary, sectorData } = await loadMarketSignals(scope, dateHour);
    // peek는 읽기 전용 — 캐시 miss면 null이고 클라가 submit한다. 실패도 null로 흡수하되
    // 조용히 삼키지 않고 로그를 남긴다(SERVER.md#SA-4).
    const peekSeed = await peekBriefingStatic(summary, dateHour, scope).catch(
        (e: unknown) => {
            console.error('[MarketContent] peekBriefingStatic failed:', e);
            return null;
        }
    );

    /**
     * SSR seed의 computedAt만 시간 단위로 quantize한다 — 5~15분 churn이 ISR write를
     * 유발하므로. 클라 refetch가 실제 computedAt을 공급해 화면 표시는 불변.
     * dateHour는 이미 'YYYY-MM-DDTHH' 형식의 string이므로 타입 호환 유지.
     *
     * ⚠️ SectorFactsSummary/SectorSignalPanel은 현재 `computedAt`을 사용자/크롤러에게
     * 직접 렌더링하지 않는다(`buildSectorFacts`도 사용 안 함). 향후 SSR 표시 경로가
     * 추가되면 truncated 'YYYY-MM-DDTHH' 13자 형식이 노출되므로 그 시점에 표시 형식
     * 변환을 함께 검토해야 한다.
     */
    const sectorDataSeed = { ...sectorData, computedAt: dateHour };

    const dehydratedState = buildMarketDehydratedSeed(
        scope,
        summary,
        sectorDataSeed,
        dateHour
    );

    const firstSector = scope.signalSectors[0];
    if (firstSector === undefined) {
        throw new Error(`[MarketContent] scope has no sectors: ${scope.id}`);
    }

    // 서버 → 클라이언트 경계. 여기서 한 번 좁히지 않으면 스캔 대상 종목표(미국 97행)가
    // RSC Flight 페이로드와 ISR HTML에 매 렌더 실린다 — 클라는 읽지도 않는 값이다.
    const clientScope = toClientScope(scope);

    return (
        <>
            <HydrationBoundary state={dehydratedState}>
                <Suspense
                    fallback={
                        <MarketSummaryPanelSkeleton scope={clientScope} />
                    }
                >
                    <MarketSummaryPanel
                        scope={clientScope}
                        peekSeed={peekSeed}
                    />
                </Suspense>
            </HydrationBoundary>
            {/* 패널은 서버에서 렌더된다(`useUrlSearchParam` — CSR bailout 없음). 이 경계는
                **안전망**으로만 남긴다: 서버 렌더가 예외적으로 suspend하면 같은 높이의
                스켈레톤이 자리를 지킨다. fallback엔 스켈레톤만 둔다 — 크롤 텍스트는 fallback이
                아니라 아래 영구 sibling이 맡는다(fallback은 경계가 resolve되면 클라에서 파괴되고
                raw HTML에서는 숨김 청크 뒤로 밀린다). */}
            <Suspense
                fallback={<SectorSignalPanelSkeleton scope={clientScope} />}
            >
                <SectorSignalPanel
                    scope={clientScope}
                    initialSector={firstSector.symbol}
                    initialTimeframe={DEFAULT_DASHBOARD_TIMEFRAME}
                    initialData={sectorDataSeed}
                />
            </Suspense>
            {/* **전 섹터** SSR 크롤 텍스트. 위 패널도 서버 렌더되지만 활성 섹터만 보여 준다 —
                SectorFactsSummary가 전 섹터를 `이름 (TICKER)` 앵커와 함께 정적 텍스트로 나열해
                크롤러가 JS 없이 스냅샷 전체와 `/{symbol}` 링크를 본다. 사용자도 같은 데이터를 본다. */}
            <SectorFactsSummary data={sectorDataSeed} scope={clientScope} />
            <SignalTypeGuide />
        </>
    );
}

/**
 * 미국·한국 `/market` 라우트가 공유하는 본문 + 구조화데이터.
 *
 * 두 페이지는 구조가 완전히 같고 데이터 소스와 문장만 다르다. 라우트마다 복사하면
 * SSR seed 배선(쿼리 키·peek scope) 같은 조용한 항목이 한쪽에서만 갱신되는데,
 * 그건 화면에 아무 표시도 나지 않고 "다른 시장 데이터가 보이는" 형태로만 드러난다.
 */
export async function MarketRouteBody({
    scope,
    // 훅이 아니라 prop으로 받는다 — 이 컴포넌트는 테스트가 함수로 직접
    // 호출하고(트리를 `JSON.stringify`로 검사) 그 자리에는 React 컨텍스트가
    // 없어 `useLocale()`이 던진다.
    locale,
}: MarketScopeProps & { readonly locale: Locale }): Promise<ReactElement> {
    // `useTranslations`(client hook) 대신 `getTranslations`를 쓴다 — 이 함수는
    // 테스트에서 React 렌더 파이프라인 없이 **직접 함수로 호출**된다(예:
    // `MarketRouteBody({ scope })`의 반환 트리를 `JSON.stringify`로 검사).
    // `useTranslations`는 훅 디스패처가 없는 그 호출 경로에서 즉시 throw한다.
    const t = await getTranslations('shared.seo');
    // 디렉터리 링크 문구는 푸터와 **같은 키**를 쓴다 — `shared.seo`에 두면
    // 클라이언트 페이로드 금지 네임스페이스에 걸린다(clientKeyCoverage 가드).
    const tLayout = await getTranslations('widgets.layout');
    const copy = marketCopyFor(scope.id, t);
    const url = `${SITE_URL}${copy.path}`;

    // metadata가 noindex를 거는 것과 **같은 술어**로 구조화데이터를 끈다. 빈 렌더에
    // "이 URL은 정식 WebPage이고 섹터 ETF 11종을 담은 ItemList"라고 주장하면
    // 색인 지시와 마크업이 정면으로 어긋난다.
    const { degraded } = await loadMarketSignals(scope);

    const jsonLd = buildWebPageJsonLd({
        url,
        name: brandTitle(copy.title, locale),
        description: copy.description,
        locale,
    });
    const breadcrumbJsonLd = buildBreadcrumbJsonLd(
        [{ name: copy.breadcrumb, url }],
        locale
    );
    const itemListJsonLd = buildMarketItemListJsonLd(
        scope,
        copy.itemListName,
        locale
    );

    return (
        <>
            {!degraded && (
                <>
                    <JsonLd data={jsonLd} />
                    <JsonLd data={breadcrumbJsonLd} />
                    <JsonLd data={itemListJsonLd} />
                </>
            )}
            {/* main 랜드마크 — h1과 본문이 fragment 아래 직접 노출되면 의미론적 랜드마크가
                빠진다. 형제 페이지(/[symbol]/*)와 같은 구조를 둔다. */}
            <main className="flex-1">
                <div className="page-container pt-6">
                    <RegionTabs
                        vertical="market"
                        active={scope.id}
                        currentPath={copy.path}
                    />
                </div>
                <div className="page-container pt-6">
                    {/* 가시 브레드크럼 — 텍스트가 위 BreadcrumbList의 `name`과 같아야
                        구글이 마크업을 무시하지 않는다(`buildBreadcrumbJsonLd` 참조). */}
                    <Breadcrumb trail={[{ label: copy.breadcrumb }]} />
                    <h1 className="text-2xl font-bold tracking-tight text-balance text-secondary-50 sm:text-3xl">
                        {copy.title}
                    </h1>
                </div>
                {/* 서버 데이터(`MarketContent`)는 Suspense로 감싸지 않는다 — 서버 데이터 경계는
                    raw HTML에 숨김 청크를 남겨 JS 없는 크롤러에게 본문을 가린다.
                    클라 전용 경계(`MarketSummaryPanel`·`SectorSignalPanel`)는 `MarketContent`
                    안에서 유지한다. */}
                <MarketContent scope={scope} />
                {/*
                 * 디렉터리 진입 — 이 페이지는 섹터 신호가 잡힌 종목만 보여주므로
                 * 조용한 장에는 목록이 짧다. 그때 다른 종목으로 가는 길이 사라지지
                 * 않게 둔다(푸터에도 있지만, 여기가 문맥상 훨씬 가깝다).
                 */}
                <div className="mx-auto w-full max-w-6xl px-4 pb-8">
                    <Link
                        href={SYMBOLS_PATH}
                        prefetch={false}
                        className="text-sm text-secondary-400 transition-colors hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                        {tLayout('Footer.symbolsLink')} →
                    </Link>
                </div>
            </main>
        </>
    );
}
