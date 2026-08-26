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
import { RelatedSymbols } from '@/views/symbol';
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
import { computeFearGreedIndex } from '@y0ngha/siglens-core';
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
            {/* 관련 종목 칩 — **jail 밖**이라 페이지 일반 스크롤로 닿는다.
                푸터 바로 위 자리다.

                예전엔 차트 페이지 `<main>` 안에 있었는데, 그 `<main>`은 차트
                라우트에서 자체 `overflow-y-auto` 스크롤 컨테이너다(jail이
                definite height + overflow-hidden이라 그 안에서 따로 스크롤된다).
                그래서 칩이 **중첩 스크롤러 안쪽**에 깔려, 사용자가 페이지를 내려
                푸터를 봐도 칩에는 영원히 도달하지 못했다 — DOM에는 있어서 크롤러는
                봤지만 사람은 못 보는 상태였다(2026-08-25 사용자 제보).

                ⚠️ jail의 높이 계산을 건드리지 않는다 — 형제로 뒤에 붙일 뿐이라
                차트 세로폭은 그대로다. jail 안으로 되돌리면 같은 문제가 재발한다.

                레이아웃으로 올라오면서 9개 탭 전부에 렌더된다. 칩 8개는 1KB
                남짓이고, 오히려 모든 탭이 다른 종목으로 나가는 간선을 갖게 돼
                내부링크 그래프가 촘촘해진다.

                ⚠️ 두 가지가 이 이동으로 **새로 생긴다**(리뷰 round 1 지적):

                1. **잔여 soft-404 탭에도 뜬다.** 크립토가 options/fundamental/
                   financials/congress를 방문하면 그 page.tsx가 `notFound()`를
                   던지지만 세그먼트 `loading.tsx`의 Suspense 경계 때문에 200으로
                   샌다(이 파일 상단 주석의 알려진 잔여 동작). 레이아웃은 그보다
                   위라 칩이 그대로 렌더된다.
                   그대로 둔다 — `app/not-found.tsx`가 이미 `TickerCategories`로
                   종목 링크 그리드를 띄운다. 찾지 못한 페이지에서 탐색로를 주는 건
                   이 사이트의 의도된 동작이고, 칩만 예외로 막을 이유가 없다.

                2. **콜드젠 blocking I/O가 1탭 → 9탭으로 늘었다.** 칩은 피어 8종의
                   한글명을 `getAssetInfoResilient`로 조회한다(`Promise.all` 1왕복).
                   각 피어의 엔트리는 그 종목 자기 페이지가 이미 채운 `unstable_cache`를
                   공유하므로 워엄에서는 비용이 관측되지 않았지만(실측 0.20~0.26초),
                   그건 **차트 탭 1회 기준 측정**이었다. 이제 심볼당 최대 9번 콜드젠에서
                   같은 비용을 치른다.
                   `<Suspense>`로 감싸지 않는 이유는 그대로다 — 경계 뒤 콘텐츠는 raw
                   HTML 끝쪽에 스트리밍돼 JS를 실행하지 않는 크롤러(Naver Yeti·Daumoa)
                   에게 내부링크가 푸터 뒤로 밀린다. 한국어 검색이 주 유입이고 내부링크가
                   이 컴포넌트의 존재 이유라 그 교환은 하지 않는다. */}
            <RelatedSymbols symbol={ticker} />
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

    // 이 QueryClient는 이제 `assetInfo`만 seed한다. 헤더의 공포·탐욕 칩이 봉을
    // 요구하던 것이 봉 seed의 유일한 이유였는데, 지금은 서버가 계산한 스냅샷을
    // prop으로 받으므로 그 의존이 사라졌다(아래 `fearGreedSnapshot` 주석에 실측 근거).
    //
    // ISR static-safe: 봉 조회는 getSeedBarsStatic(=React.cache(unstable_cache(getBarsAction)))
    // 으로 통일한다 — static gen 중 redis no-store fetch가 DYNAMIC_SERVER_USAGE를
    // throw하지 않게.
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
    // 공포·탐욕 칩 값을 **서버에서 확정**한다. `computeFearGreedIndex`는 core의
    // 순수 함수라 AI 호출도 I/O도 없다(`FearGreedFactsSummary`가 이미 서버에서 쓴다).
    //
    // ## 왜 bars를 seed하지 않는가 — 9탭 × 76KB의 실측 낭비
    //
    // 예전엔 이 자리에서 `QUERY_KEYS.bars`에 일봉 500개 + buySellVolume을 seed했다.
    // 레이아웃이라 **9탭 전부**에 실렸는데, 2026-08-24 프로덕션 실측 기준 raw 76KB
    // (bars 52KB + buySellVolume 24KB)였고 `/[symbol]/position`에서는 RSC 페이로드의
    // **47%**를 차지했다.
    //
    // 그런데 `useBars` 소비자는 셋뿐이다: `ChartContent`(차트 탭), `FearGreedPage`
    // (공포·탐욕 탭), 그리고 이 헤더 칩(9탭 전부). 앞의 둘은 **각자 page.tsx에서
    // 직접 seed**하므로 이 레이아웃 seed가 필요한 소비자는 칩 하나뿐이었다. 즉
    // 나머지 7탭은 헤더 배지 하나 때문에 76KB를 나르고 있었다.
    //
    // 칩이 서버 계산 스냅샷(수십 바이트)을 받으면 그 seed가 통째로 불필요해진다.
    // 차트·공포탐욕 탭은 자기 seed를 그대로 쓰므로 영향이 없다 — 이 레이아웃의
    // HydrationBoundary는 헤더만 감싸고, 두 페이지는 자신의 안쪽 boundary를 쓴다.
    //
    // ## 덤: 크롤러가 칩 값을 본다
    //
    // 예전 칩은 하이드레이션 전까지 스켈레톤이라(클라 계산값과 SSR 값이 갈려
    // React #418 텍스트 mismatch가 났다) JS를 실행하지 않는 크롤러(Naver Yeti·
    // Daumoa)에겐 아무것도 안 보였다. 서버 값은 SSR HTML에 그대로 박히고, 같은
    // 값이 하이드레이션 후에도 렌더되므로 mismatch가 원천적으로 없다.
    //
    // ## 신선도 — 장중에는 값이 덜 민감해진다 (의도된 트레이드오프)
    //
    // 예전 클라 경로는 30초마다 refetch했고 그 응답에는 **형성 중인 당일 봉**이
    // 포함됐다. 서버 경로는 `getSeedBarsStatic`이 마지막 완료 봉까지만 quantize하고
    // (ISR HTML 결정성 때문에 필수다), 그 위에 봉 캐시 6h + 페이지 ISR 6~24h가 얹힌다.
    // 즉 장이 열려 있는 동안 이 배지는 당일 거래량 흐름을 반영하지 않는다.
    //
    // 그래도 이 쪽을 택한 이유: (a) 공포·탐욕은 일봉 지표라 세션 중 갱신의 가치가
    // 작고, (b) 같은 페이지의 다른 모든 숫자가 이미 동일한 ISR 상한에 묶여 있어
    // 배지만 실시간이면 오히려 어긋나 보이며, (c) 실시간 값이 필요한 사용자를 위한
    // `/[symbol]/fear-greed` 전용 페이지는 `useFearGreedFromSymbol`로 계속
    // 라이브 refetch한다. 배지는 그 페이지로 가는 입구일 뿐이다.
    //
    // `quantized`가 null(FMP 키 없음·degrade)이면 스냅샷도 null → 칩이 기존
    // "데이터 부족" 문구로 폴백한다.
    const fearGreedSnapshot =
        quantized === null
            ? null
            : computeFearGreedIndex(
                  quantized.bars,
                  quantized.indicators.buySellVolume
              );

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <SymbolLayoutHeader
                symbol={symbol}
                fearGreedSnapshot={fearGreedSnapshot}
            />
        </HydrationBoundary>
    );
}

async function SymbolFloatingChat({ params }: SymbolLayoutSegmentProps) {
    const { symbol } = await params;
    return <SymbolLayoutFloatingChat symbol={symbol} />;
}

// Static shell mirroring SymbolLayoutHeader's outer shape. Used as the Suspense
// fallback while params resolve and the bars prefetch completes.
//
// 폭 구조도 실제 헤더와 **같아야 한다**. 이전엔 여기만 `px-4` 전폭이라, 안에 든
// 스켈레톤이 `symbol-container`로 옮겨간 뒤 폴백 자신의 브레드크럼과 탭이
// 1920px에서 436px 어긋났고, 폴백에서 실제 헤더로 넘어갈 때도 448px 튀었다.
// 콜드 로드의 첫 페인트라 사용자가 실제로 보는 화면이다.
//
// **행 구조도 같아야 한다.** 실제 헤더는 640px 미만에서 브레드크럼과 컨트롤이
// 두 행으로 쌓이는데 폴백은 한 행이라 높이가 109px 대 160px로 갈렸고, 폴백이
// 실제 헤더로 바뀌는 순간 세로로 51px 밀렸다(640px 이상은 15px). 폴백의 존재
// 이유가 바로 그 밀림을 막는 것이므로 같은 `flex-col → sm:flex-row` 구조와
// 같은 컨트롤 크기(size-11)를 쓴다.
//
// 컨트롤은 **2개**만 둔다. 실제 헤더의 세 번째 칩(`PortfolioChipMounted`)은
// 회원 전용이라 게스트에겐 아예 렌더되지 않는다(`useCurrentUser` null → null).
// 클러스터가 우측 정렬이라 개수가 달라도 공유·설정 버튼의 x는 안 밀린다
// (375px 실측: 폴백 2·3번이 [263,307]·[315,359], 실제 2개도 같은 좌표).
// 그래서 남는 문제는 "뜬 자리가 사라지느냐 생기느냐"뿐이고, 다수인 게스트
// 기준으로 팬텀이 없는 2개가 맞다 — 회원은 칩 하나가 클러스터 왼쪽에 붙을 뿐
// 나머지 둘은 그대로다.
function SymbolHeaderShellFallback() {
    return (
        <header className="py-3" aria-hidden="true">
            <div className="symbol-container flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex min-w-0 items-center gap-2 sm:flex-1">
                    <span className="font-mono text-xs tracking-[0.2em] text-secondary-500 uppercase">
                        SIGLENS
                    </span>
                    <span className="text-secondary-500">/</span>
                    <span className="inline-block h-7 w-32 animate-pulse rounded bg-secondary-700" />
                    {/* 실제 헤더는 이 자리에 데스크톱용 FearGreedHeaderChip을
                        인라인으로 둔다(모바일 인스턴스는 아래 행). 스냅샷이
                        null이어도 "공포·탐욕 데이터 부족" 칩을 렌더하므로 이
                        자리는 항상 채워진다. */}
                    <span className="hidden h-5 w-20 animate-pulse rounded bg-secondary-700 sm:inline-block" />
                </div>
                <div className="flex items-center justify-between gap-2 sm:order-3 sm:shrink-0 sm:justify-end">
                    <span className="inline-block h-6 w-16 animate-pulse rounded bg-secondary-700 sm:hidden" />
                    <div className="flex items-center gap-2">
                        <span className="inline-block size-11 animate-pulse rounded-lg bg-secondary-700" />
                        <span className="inline-block size-11 animate-pulse rounded-lg bg-secondary-700" />
                    </div>
                </div>
            </div>
            <div className="mt-3">
                <SymbolTabsSkeleton />
            </div>
        </header>
    );
}
