import type { ReactElement } from 'react';
import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import {
    dehydrate,
    HydrationBoundary,
    QueryClient,
    type DehydratedState,
} from '@tanstack/react-query';
import { MarketSummaryPanel } from '@/widgets/dashboard/MarketSummaryPanel';
import { MarketSummaryPanelSkeleton } from '@/widgets/dashboard/MarketSummaryPanelSkeleton';
import { SectorFactsSummary } from '@/widgets/dashboard';
import { SectorSignalPanel } from '@/widgets/dashboard/SectorSignalPanel';
import { SectorSignalPanelSkeleton } from '@/widgets/dashboard/SectorSignalPanelSkeleton';
import { SignalTypeGuide } from '@/widgets/dashboard/SignalTypeGuide';
import { peekBriefingStatic } from '@/entities/market-summary/api/briefingStaticCache';
import { DEFAULT_DASHBOARD_TIMEFRAME } from '@/shared/config/dashboard-tickers';
import {
    toClientScope,
    type DashboardScope,
} from '@/shared/config/dashboardScope';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { ISO_DATE_HOUR_SLICE_END } from '@/shared/config/time';
import { RegionTabs } from '@/shared/ui/RegionTabs';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { JsonLd } from '@/shared/ui/JsonLd';
import type { Locale } from '@/shared/i18n/locales';
import {
    buildBreadcrumbJsonLd,
    buildWebPageJsonLd,
    SITE_NAME,
    SITE_URL,
    SYMBOLS_PATH,
} from '@/shared/lib/seo';
import { Breadcrumb } from '@/shared/ui/Breadcrumb';
import { marketCopyFor } from './copy';
import {
    loadMarketSignals,
    type LoadMarketSignalsResult,
} from './loadMarketSignals';

/**
 * SSR seed를 만들어 dehydrate한다.
 *
 * **컴포넌트 밖에 두는 이유**: `new QueryClient()`를 컴포넌트 본문에서 만들면
 * 클라이언트 컴포넌트에서는 매 렌더 캐시가 날아가는 실수라, 정적 분석이 이를
 * 잡아낸다(react-doctor `query-stable-query-client`). 여기는 서버 컴포넌트라
 * 요청당 새 클라이언트가 **오히려 맞지만**, 규칙이 그 구분을 하지 못한다.
 * 함수로 빼면 의도(요청 스코프 1회용 시드)가 코드에 드러나고 경고도 사라진다.
 *
 * `updatedAt`을 명시하는 이유: React Query `dehydrate` 기본값이 `Date.now()`라
 * 매 ISR 재생성마다 다른 timestamp가 HTML에 박혀 ISR write churn이 생긴다.
 * dateHour 버킷의 시작 시각으로 고정해 같은 시간 안에서는 결정적이 되게 한다.
 */
function buildDehydratedSeed(
    scope: DashboardScope,
    summary: LoadMarketSignalsResult['summary'],
    sectorDataSeed: LoadMarketSignalsResult['sectorData'],
    dateHour: string
): DehydratedState {
    const stableUpdatedAt = new Date(`${dateHour}:00:00.000Z`).getTime();
    const queryClient = new QueryClient();
    queryClient.setQueryData(
        QUERY_KEYS.marketSummary(scope.id),
        { summary },
        { updatedAt: stableUpdatedAt }
    );
    queryClient.setQueryData(
        QUERY_KEYS.sectorSignals(scope.id, DEFAULT_DASHBOARD_TIMEFRAME),
        sectorDataSeed,
        { updatedAt: stableUpdatedAt }
    );
    return dehydrate(queryClient);
}

/**
 * ISR-safe market content. No searchParams — timeframe/sector are purely
 * client-side via useSearchParams in SectorSignalPanel (CSR).
 *
 * Static data flow:
 *   1. getMarketSummaryStatic / getSectorSignalsStatic — unstable_cache (1h)
 *   2. peekBriefingStatic — read cached briefing for SSR seed (no side effects)
 *   3. QueryClient.setQueryData — seeds React Query for instant hydration
 *   4. SectorFactsSummary — SSR crawl text (axis 2: useSearchParams bailout workaround)
 */
interface MarketScopeProps {
    readonly scope: DashboardScope;
}

export async function MarketContent({
    scope,
}: MarketScopeProps): Promise<ReactElement> {
    // ISR date-hour key: same hour = same cached briefing peek. Avoids hashing
    // the full summary object on every ISR render.
    const dateHour = new Date().toISOString().slice(0, ISO_DATE_HOUR_SLICE_END);

    const { summary, sectorData } = await loadMarketSignals(scope, dateHour);
    // peekBriefingStatic is read-only — null on cache miss (client will trigger submit)
    const peekSeed = await peekBriefingStatic(summary, dateHour, scope).catch(
        () => null
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

    const dehydratedState = buildDehydratedSeed(
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
            <Suspense
                fallback={
                    <>
                        {/* Axis 2: SSR crawl text while SectorSignalPanel (CSR) hydrates.
                            SectorSignalPanel uses useSearchParams → CSR bailout → empty SSR HTML.
                            SectorFactsSummary renders the same data as static server-rendered text
                            so crawlers see actual signal content without JS. Not cloaking — users
                            see the same data once JS loads. */}
                        <SectorFactsSummary data={sectorDataSeed} />
                        <SectorSignalPanelSkeleton scope={clientScope} />
                    </>
                }
            >
                <SectorSignalPanel
                    scope={clientScope}
                    initialSector={firstSector.symbol}
                    initialTimeframe={DEFAULT_DASHBOARD_TIMEFRAME}
                    initialData={sectorDataSeed}
                />
            </Suspense>
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
    // 스켈레톤도 클라이언트 컴포넌트다 — `MarketContent`와 같은 이유로 좁힌다.
    const clientScope = toClientScope(scope);
    const url = `${SITE_URL}${copy.path}`;
    const fullTitle = `${copy.title} | ${SITE_NAME}`;

    // metadata가 noindex를 거는 것과 **같은 술어**로 구조화데이터를 끈다. 빈 렌더에
    // "이 URL은 정식 WebPage이고 섹터 ETF 11종을 담은 ItemList"라고 주장하면
    // 색인 지시와 마크업이 정면으로 어긋난다.
    const { degraded } = await loadMarketSignals(scope);

    const jsonLd = buildWebPageJsonLd({
        url,
        name: fullTitle,
        description: copy.description,
        locale,
    });

    const breadcrumbJsonLd = buildBreadcrumbJsonLd(
        [{ name: copy.breadcrumb, url }],
        locale
    );

    // ItemList 항목에는 url을 두지 않는다 — 모든 항목이 동일 페이지를 가리키면
    // (변형 ?sector=는 비-canonical) 구조화데이터로서 가치가 낮고 sitelink 후보에서
    // 불리하다. 섹터/심볼 식별은 ListItem name(괄호 안 symbol)으로 표기하며,
    // 실제 크롤 가능 딥링크(→ /{symbol})는 MarketSummaryPanel 섹터 카드가 제공한다.
    // name도 개수를 표기하지 않는다(설정이 바뀌면 고정 개수는 쉽게 낡는다).
    //
    // **`signalSectors`가 아니라 `sectorEtfs`를 싣는다.** 전자는 스캐너 탭 목록이라
    // ETF가 없는 가상 테마(QNTM·SPACE)까지 들어 있는데, 그 심볼은 조회되는 자산이
    // 아니다. 존재하지 않는 티커를 ListItem으로 선언하는 건 구조화데이터가 화면·
    // 실물과 어긋나는 것이다. 가상 테마는 스캐너 UI에 그대로 남는다.
    const itemListJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: copy.itemListName,
        itemListElement: scope.sectorEtfs.map((sector, idx) => ({
            '@type': 'ListItem',
            position: idx + 1,
            name: `${sector.koreanName} (${sector.sectorName} · ${sector.symbol})`,
        })),
    };

    return (
        <>
            {!degraded && (
                <>
                    <JsonLd data={jsonLd} />
                    <JsonLd data={breadcrumbJsonLd} />
                    <JsonLd data={itemListJsonLd} />
                </>
            )}
            {/* main 랜드마크: 이전엔 h1 + Suspense가 fragment 아래 직접 노출돼
                의미론적 랜드마크가 빠져 있었다. backtesting/page.tsx가 같은
                패턴으로 회귀했었던 이력 — sibling 페이지(/[symbol]/*) 6개와의
                일관성을 맞춰 둔다. */}
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
                <Suspense
                    fallback={
                        <>
                            <MarketSummaryPanelSkeleton scope={clientScope} />
                            <SectorSignalPanelSkeleton scope={clientScope} />
                        </>
                    }
                >
                    <MarketContent scope={scope} />
                </Suspense>
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
