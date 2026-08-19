import { Suspense, type ReactNode } from 'react';
import { notFound } from 'next/navigation';
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
import {
    DEFAULT_TIMEFRAME,
    isAdmissibleSymbolShape,
} from '@/shared/config/market';
import { isUnresolvableDegraded } from '@/shared/lib/symbolGuard';
import { getSeedBarsStatic } from '@/entities/bars';
import { getAssetInfoResilient } from '@/entities/ticker';
import { marketProfileOf } from '@/shared/config/marketProfile';
import { QUERY_KEYS, QUERY_STALE_TIME_MS } from '@/shared/config/queryConfig';
import { MS_PER_SECOND } from '@/shared/config/time';
import { EMPTY_INDICATOR_RESULT, type BarsData } from '@y0ngha/siglens-core';
import type { AssetInfo } from '@/shared/lib/types';

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
// `params` is async (Next.js 16). The chrome's remaining async work (bars prefetch)
// lives behind Suspense with a header-shaped skeleton.
//
// ⚠️ 이 레이아웃은 **의도적으로 blocking**이다 — `children`을 반환하기 전에 심볼 존재
// 여부를 확정해야 하기 때문이다(바로 아래 soft 404 설명 참조). 예전 주석은 "children이
// Suspense 밖이라 page LCP가 레이아웃 async 작업을 기다리지 않는다"고 했지만, 이제
// `getAssetInfoResilient` **한 번**은 문서 shell 전체가 기다린다. 여전히 Suspense 뒤에
// 남는 건 `getQuantizedBarsStatic`(느린 쪽)이다.
//
// 비용이 감당 가능한 이유: 이 라우트들은 `generateStaticParams: []` ISR이라 blocking은
// **cold-gen/재검증 렌더에만** 발생하고, 워엄 요청은 캐시된 HTML로 응답한다. 게다가
// `getAssetInfoResilient`는 어차피 모든 자식 page.tsx가 await하던 값이라 크리티컬 패스에
// 이미 있었다. 상태 코드 정확성(soft 404 제거)이 이 한 번의 blocking보다 가치가 크다.
//
// ⚠️ **심볼 존재 판정은 반드시 이 레이아웃 최상단에서 한다 — 자식 page.tsx가 아니라.**
//
// Next 16.2에서 `notFound()`가 Suspense 경계 **안쪽**에서 던져지면 HTTP 상태가 200으로
// 남는다(soft 404). Flight 렌더가 이미 shell을 flush한 뒤라 app-render.js의 catch
// (`res.statusCode = getAccessFallbackHTTPStatus(err)`)에 도달하지 못하고, 클라이언트
// `HTTPAccessFallbackBoundary`가 404 UI만 그려주기 때문이다.
//
// 2026-07-26 로컬 프로덕션 빌드 실측(최소 재현 라우트 5종):
//   page 직접 호출(경계 없음)          → 404 ✅
//   layout 호출(loading.tsx 있어도)     → 404 ✅
//   page 호출 + loading.tsx             → 200 ❌
//   page 호출 + 명시적 <Suspense>       → 200 ❌
//   page 호출 + client 컴포넌트 래핑    → 404 ✅  (client 래핑은 무관)
//
// 이 라우트 트리는 index/news/overall/fundamental/options에 `loading.tsx`가 있고
// 레이아웃 자체도 Suspense를 쓰므로, page.tsx의 `notFound()`는 9개 탭 전부에서
// 200으로 새어 나갔다 — Google 입장에선 전형적인 soft 404다. 레이아웃은 그 경계들보다
// 위에 있으므로 여기서 던져야 진짜 404가 나간다.
//
// 📌 위 규칙은 **심볼 존재 판정에만** 적용된다. 탭 가용성 판정(`isTabAllowedForSymbol`)은
// 탭이 어디인지 알아야 하므로 레이아웃으로 끌어올릴 수 없고, 자식 page.tsx에 남아
// **여전히 200(soft 404)** 이다. 영향 범위는 크립토 × 주식 전용 4개 탭
// (options/fundamental/financials/congress)이다 — `position`은 CRYPTO_DESCRIPTOR.tabs에
// 포함돼 크립토도 정상 렌더된다(marketProfile/crypto.ts). 부모 세그먼트의 `loading.tsx`가 자식 세그먼트
// 레이아웃까지 감싸므로 탭별 layout.tsx를 만들어도 해결되지 않는다(실측 확인).
// 노출 범위는 제한적이다 — 크립토 sitemap(`sitemap-crypto.xml`)은 `/`,`/overall`,`/news`,
// `/fear-greed`만 싣고 탭 바도 크립토에선 해당 탭을 숨기므로 내부 링크가 없다.
// `e2e/specs/crypto-symbol.spec.ts`가 이 잔여 동작을 200으로 명시 단언한다.
//
// 자식 page.tsx의 동일한 **심볼 존재** 가드는 제거하지 않았다. 그쪽은 `generateMetadata`와
// 짝을 이루고, 레이아웃 없이 페이지 컴포넌트를 직접 렌더하는 단위 테스트 경로도 지켜야 한다.
export default async function SymbolLayout({
    children,
    params,
}: SymbolLayoutProps) {
    const { symbol } = await params;
    const ticker = symbol.toUpperCase();
    // 형상 불합격(해외 거래소 접미사 포함)은 외부 호출 없이 즉시 404.
    if (!isAdmissibleSymbolShape(ticker)) notFound();
    // `getAssetInfo` 해결 순서: 캐시 → crypto_assets → FMP 크립토 목록 → asset_translations
    // → FMP `search-symbol`. 이 전부를 거쳐도 정체를 알 수 없는 심볼만 여기 걸린다.
    //
    // FMP 전면 장애 시에도 **DB가 살아 있는 한** AAPL 같은 실재 종목은 asset_translations에서
    // 해결되므로 404가 되지 않는다(degraded=true + assetInfo 있음 → 기존 200+noindex 유지).
    // FMP와 DB가 **동시에** 죽으면 `isUnresolvableDegraded`가 `VALID_TICKER_RE` 형상만
    // 살려두므로, 자릿수 초과·숫자 시작 크립토(`1INCHUSD`, `1000SATSUSD`)는 하드 404가 된다.
    // 그 404가 stale로 굳지는 않는다 — cache-handler가 `status >= 400` 엔트리를 저장하지
    // 않으므로(cache-handler/index.mjs) 장애 복구 즉시 다음 요청에서 정상 렌더된다.
    const { assetInfo, degraded } = await getAssetInfoResilient(ticker);
    if (isUnresolvableDegraded(ticker, degraded) || !assetInfo) notFound();
    return (
        <SymbolLayoutProviders>
            <SymbolLayoutJail>
                <Suspense fallback={<SymbolHeaderShellFallback />}>
                    <SymbolLayoutChrome assetInfo={assetInfo} params={params} />
                </Suspense>
                {children}
            </SymbolLayoutJail>
            <Suspense fallback={null}>
                <SymbolFloatingChat params={params} />
            </Suspense>
        </SymbolLayoutProviders>
    );
}

// `params`만 받는 async RSC 세그먼트들의 공유 베이스 — floating chat은 이 형태 그대로
// 쓰고, chrome은 여기에 `assetInfo`를 얹어 확장한다.
interface SymbolLayoutSegmentProps {
    params: Promise<{ symbol: string }>;
}

interface SymbolLayoutChromeProps extends SymbolLayoutSegmentProps {
    assetInfo: AssetInfo;
}

/**
 * 레이아웃 chrome(헤더 + bars seed). 레이아웃 외부에서 쓰지 않으며, export는 ISR seed
 * quantize 단위 테스트를 위한 것이다.
 *
 * chrome은 심볼 존재 판정을 통과한 뒤에만 렌더되므로 레이아웃이 이미 확정한
 * `assetInfo`를 prop으로 받는다(그래서 non-null이 보장된다 — null이면 그 전에 notFound).
 *
 * 이전에는 여기서 `getAssetInfoResilient`를 다시 호출했다. 그건 FMP/DB 왕복은 아니었지만
 * (`unstable_cache` 데이터 캐시 HIT), **incremental-cache read 한 번**은 더 일어났고 —
 * S3로 외부화된 cache-handler에서는 그게 실제 네트워크 왕복이다. 게다가 "두 번째 호출이
 * 반드시 HIT"이라는 건 어떤 테스트도 고정하지 않는 암묵적 불변식이었다. prop으로 내리면
 * 의존 자체가 사라진다. 스트리밍에는 영향 없다 — 값은 Suspense 서브트리가 렌더되기 전에
 * 이미 확정돼 있고, 느린 `getQuantizedBarsStatic`은 그대로 경계 뒤에 남는다.
 */
export async function SymbolLayoutChrome({
    assetInfo,
    params,
}: SymbolLayoutChromeProps) {
    const { symbol } = await params;

    // FearGreedHeaderChipMounted (in SymbolLayoutHeader) calls useBars with DEFAULT_TIMEFRAME
    // via useSuspenseQuery + getBarsAction (a Server Action). Server Actions cannot be invoked
    // during SSR rendering. Prefetching here and dehydrating into HydrationBoundary ensures
    // the header chip satisfies the query from cache instead of calling getBarsAction
    // during initial render.
    //
    // ISR static-safe: prefetch는 getQuantizedBarsStatic(=React.cache(unstable_cache(getBarsAction)))으로
    // 통일한다 — static gen 중 redis no-store fetch가 DYNAMIC_SERVER_USAGE를 throw하지 않게.
    const queryClient = new QueryClient({
        defaultOptions: { queries: { staleTime: QUERY_STALE_TIME_MS } },
    });

    // assetInfo는 fundamental data로 거의 불변 — updatedAt 0으로 고정해 ISR HTML 결정성 보장.
    // Date.now() 기본값은 매 ISR 재생성마다 다른 timestamp가 dehydrated state에 박혀 write churn 유발.
    // (null 분기는 없다 — 레이아웃 가드가 null assetInfo를 이미 404로 끊는다.)
    queryClient.setQueryData(QUERY_KEYS.assetInfo(symbol), assetInfo, {
        updatedAt: 0,
    });

    // ISR write churn 차단: quantize로 forming 봉을 제거 + setQueryData에 안정 updatedAt
    // 명시. prefetchQuery는 dataUpdatedAt 옵션이 없어 매 ISR 재생성마다 다른 timestamp가
    // dehydrate 상태에 박혀 HTML hash가 달라진다(2026-06-06 실측). setQueryData는
    // updatedAt 옵션 지원 → 마지막 완료 봉의 timestamp로 고정해 ISR HTML 결정성 보장.
    // page.tsx와 **같은 인자**(대문자 ticker)로 호출해야 요청 스코프 메모가 접힌다 —
    // 갈리면 지표가 RSC 페이로드에 두 벌 실린다(getQuantizedBarsStatic JSDoc).
    // quantize도 이 헬퍼 안에서 수행되므로, 장중·크립토에서 새 객체가 갈리던 문제까지
    // 함께 해소된다(세션 spec은 marketProfile에서 유도).
    // seed 전용 축소판을 쓴다 — layout은 지표를 서버에서 읽지 않고 seed만 하므로,
    // 첫 페인트가 읽지 않는 지표까지 직렬화할 이유가 없다(getSeedBarsStatic JSDoc).
    const quantized = await getSeedBarsStatic(
        symbol.toUpperCase(),
        DEFAULT_TIMEFRAME,
        marketProfileOf(assetInfo),
        assetInfo.fmpSymbol
    ).catch((e: unknown) => {
        console.error('[SymbolLayout] getSeedBarsStatic failed:', e);
        return null;
    });
    if (quantized !== null) {
        // Bar.time은 seconds (epoch) — RQ dataUpdatedAt은 milliseconds 기대.
        const lastBarSec = quantized.bars.at(-1)?.time ?? 0;
        const stableUpdatedAt = lastBarSec * MS_PER_SECOND;
        queryClient.setQueryData(
            QUERY_KEYS.bars(symbol, DEFAULT_TIMEFRAME, assetInfo.fmpSymbol),
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
            QUERY_KEYS.bars(symbol, DEFAULT_TIMEFRAME, assetInfo.fmpSymbol),
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
                    <span className="font-mono text-xs tracking-[0.2em] text-secondary-500 uppercase">
                        SIGLENS
                    </span>
                    <span className="text-secondary-700">/</span>
                    <span className="inline-block h-5 w-32 animate-pulse rounded bg-secondary-700" />
                </div>
                <span className="inline-block h-8 w-36 shrink-0 animate-pulse rounded-md bg-secondary-700" />
            </div>
            <div className="-mx-4 mt-3">
                <SymbolTabsSkeleton />
            </div>
        </header>
    );
}
