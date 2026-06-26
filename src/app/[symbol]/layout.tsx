import { Suspense, type ReactNode } from 'react';
import {
    dehydrate,
    HydrationBoundary,
    QueryClient,
} from '@tanstack/react-query';
import {
    SymbolLayoutFloatingChat,
    SymbolLayoutJail,
    SymbolLayoutProviders,
} from '@/app/[symbol]/SymbolLayoutClient';
import { SymbolLayoutHeader } from '@/views/symbol/SymbolLayoutHeader';
import { SymbolTabsSkeleton } from '@/views/symbol/SymbolTabsSkeleton';
import { DEFAULT_TIMEFRAME } from '@/shared/config/market';
import { getBarsStatic, quantizeBarsDataToLastClosed } from '@/entities/bars';
import { getAssetInfoResilient } from '@/entities/ticker';
import {
    marketProfileOf,
    DEFAULT_MARKET_PROFILE,
} from '@/shared/config/marketProfile';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { QUERY_KEYS, QUERY_STALE_TIME_MS } from '@/shared/config/queryConfig';
import { MS_PER_SECOND } from '@/shared/config/time';
import { EMPTY_INDICATOR_RESULT, type BarsData } from '@y0ngha/siglens-core';

interface SymbolLayoutProps {
    children: ReactNode;
    params: Promise<{ symbol: string }>;
}

// Layout shell stays as an RSC: it composes a shared provider subtree (chat/model
// contexts) around the chrome (header) and the active page subtree.
//
// Sticky-footer jail (SymbolLayoutJail): SymbolLayoutHeader + page main을 viewport
// 잔여 영역에 맞춘 컨테이너로 감싼다. viewport에서 site Header(`var(--header-h)` = 3.5rem)
// + PwaBanner(`var(--pwa-banner-h, 0px)`, banner 표시 중일 때만 3rem)를 빼면 jail이 첫
// 화면의 잔여 영역을 정확히 차지하고, 그 안에서 layout header가 자기 자리 + page main이
// 나머지를 차지한다. footer는 root layout에서 jail의 형제로 위치하므로 자연스럽게 jail
// 아래로 push되어 스크롤해야 보인다.
//
// jail 높이는 라우트별로 다르다 (SymbolLayoutJail JSDoc 참조). 차트(index) 라우트는
// definite `h-[calc(...)]` + overflow-hidden으로 chart+AI를 첫 viewport에 고정해 AI 패널이
// 내부 스크롤되게 하고, sibling 탭은 `min-h-[calc(...)]`으로 콘텐츠 길이에 따라 자란다.
//
// `--header-h`는 globals.css의 @theme에서 3.5rem 기본값으로 정의되어 site Header h-14와
// 동기화된다. `--pwa-banner-h`는 PwaBanner mount 시점에 3rem으로 set, dismiss/unmount
// 시점에 remove돼 jail이 PwaBanner 토글에 일관되게 반응한다. 두 변수 모두 한 곳에서만
// 관리되므로 chrome 높이 변경 시 jail 계산식을 수정할 필요가 없다.
//
// `params` is async (Next.js 16) and the chrome depends on it + a bars prefetch,
// so the chrome lives behind Suspense with a header-shaped skeleton. `children`
// (the active page subtree) is kept outside that Suspense so a page's LCP never
// waits on the layout chrome's async work (getAssetInfoResilient + prefetchQuery(bars)).
export default function SymbolLayout({ children, params }: SymbolLayoutProps) {
    return (
        <SymbolLayoutProviders>
            <SymbolLayoutJail>
                <Suspense fallback={<SymbolHeaderShellFallback />}>
                    <SymbolLayoutChrome params={params} />
                </Suspense>
                {children}
            </SymbolLayoutJail>
            <Suspense fallback={null}>
                <SymbolFloatingChat params={params} />
            </Suspense>
        </SymbolLayoutProviders>
    );
}

// chrome과 floating chat은 둘 다 `params`만 받아 async RSC로 동작하는 동일 shape이라
// 단일 인터페이스를 공유한다.
interface SymbolLayoutSegmentProps {
    params: Promise<{ symbol: string }>;
}

// Exported for unit testing — verifies ISR seed quantization. Not used outside layout.
export async function SymbolLayoutChrome({ params }: SymbolLayoutSegmentProps) {
    const { symbol } = await params;
    const ticker = symbol.toUpperCase();
    const { assetInfo } = await getAssetInfoResilient(ticker);

    // FearGreedHeaderChipMounted (in SymbolLayoutHeader) calls useBars with DEFAULT_TIMEFRAME
    // via useSuspenseQuery + getBarsAction (a Server Action). Server Actions cannot be invoked
    // during SSR rendering. Prefetching here and dehydrating into HydrationBoundary ensures
    // the header chip satisfies the query from cache instead of calling getBarsAction
    // during initial render.
    //
    // ISR static-safe: prefetch는 getBarsStatic(=unstable_cache(getBarsAction))으로
    // 통일한다 — static gen 중 redis no-store fetch가 DYNAMIC_SERVER_USAGE를 throw하지 않게.
    const queryClient = new QueryClient({
        defaultOptions: { queries: { staleTime: QUERY_STALE_TIME_MS } },
    });

    if (assetInfo) {
        // assetInfo는 fundamental data로 거의 불변 — updatedAt 0으로 고정해 ISR HTML 결정성 보장.
        // Date.now() 기본값은 매 ISR 재생성마다 다른 timestamp가 dehydrated state에 박혀 write churn 유발.
        queryClient.setQueryData(QUERY_KEYS.assetInfo(symbol), assetInfo, {
            updatedAt: 0,
        });
    }

    // ISR write churn 차단: quantize로 forming 봉을 제거 + setQueryData에 안정 updatedAt
    // 명시. prefetchQuery는 dataUpdatedAt 옵션이 없어 매 ISR 재생성마다 다른 timestamp가
    // dehydrate 상태에 박혀 HTML hash가 달라진다(2026-06-06 실측). setQueryData는
    // updatedAt 옵션 지원 → 마지막 완료 봉의 timestamp로 고정해 ISR HTML 결정성 보장.
    const headerBars = await getBarsStatic(
        symbol,
        DEFAULT_TIMEFRAME,
        assetInfo?.fmpSymbol
    ).catch((e: unknown) => {
        console.error('[SymbolLayout] getBarsStatic failed:', e);
        return null;
    });
    if (headerBars !== null) {
        // Derive the session spec from assetInfo so crypto (always-open) strips
        // the forming bar consistently with the chart page. Without the session
        // arg the call defaulted to US_EQUITY_SESSION even for crypto symbols,
        // causing divergent seed bars and ISR write-churn on the shared bars key.
        // When assetInfo is null (degraded symbol) DEFAULT_MARKET_PROFILE applies,
        // which is 'us-equity' — the same as omitting the session arg.
        const session = assetInfo
            ? sessionSpecFor(marketProfileOf(assetInfo))
            : sessionSpecFor(DEFAULT_MARKET_PROFILE);
        const quantized = quantizeBarsDataToLastClosed(
            headerBars,
            new Date(),
            session
        );
        // Bar.time은 seconds (epoch) — RQ dataUpdatedAt은 milliseconds 기대.
        const lastBarSec = quantized.bars.at(-1)?.time ?? 0;
        const stableUpdatedAt = lastBarSec * MS_PER_SECOND;
        queryClient.setQueryData(
            QUERY_KEYS.bars(symbol, DEFAULT_TIMEFRAME, assetInfo?.fmpSymbol),
            quantized,
            { updatedAt: stableUpdatedAt }
        );
    } else {
        // Bars fetch failed (no FMP key, degraded symbol, etc.). Seed an empty
        // BarsData into the query cache so useSuspenseQuery in
        // FearGreedHeaderChipMounted → useBars finds data in the dehydrated state
        // and does NOT call getBarsAction ('use server') during SSR. React 19
        // throws "Server Functions cannot be called during initial render" when a
        // Server Action is invoked from a query's queryFn at SSR time.
        // updatedAt: 0 keeps the dehydrated HTML deterministic (never varies
        // across ISR regenerations) and signals to the client that it should
        // re-fetch immediately (staleTime check: 0 < Date.now()).
        const emptyBars: BarsData = {
            bars: [],
            indicators: EMPTY_INDICATOR_RESULT,
        };
        queryClient.setQueryData(
            QUERY_KEYS.bars(symbol, DEFAULT_TIMEFRAME, assetInfo?.fmpSymbol),
            emptyBars,
            { updatedAt: 0 }
        );
    }

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <SymbolLayoutHeader symbol={symbol} />
        </HydrationBoundary>
    );
}

async function SymbolFloatingChat({ params }: SymbolLayoutSegmentProps) {
    const { symbol } = await params;
    return <SymbolLayoutFloatingChat symbol={symbol} />;
}

// Static shell mirroring SymbolLayoutHeader's outer shape. Used as the Suspense
// fallback while params resolve and the bars prefetch completes.
function SymbolHeaderShellFallback() {
    return (
        <header className="px-4 py-3" aria-hidden="true">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-secondary-500 font-mono text-xs tracking-[0.2em] uppercase">
                        SIGLENS
                    </span>
                    <span className="text-secondary-700">/</span>
                    <span className="bg-secondary-700 inline-block h-5 w-32 animate-pulse rounded" />
                </div>
                <span className="bg-secondary-700 inline-block h-8 w-36 shrink-0 animate-pulse rounded-md" />
            </div>
            <div className="-mx-4 mt-3">
                <SymbolTabsSkeleton />
            </div>
        </header>
    );
}
