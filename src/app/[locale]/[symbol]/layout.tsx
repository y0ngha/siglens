import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';

import { SymbolLayoutChrome } from '@/app/[locale]/[symbol]/_components/SymbolLayoutChrome';
import { requireResolvableAsset } from '@/app/[locale]/[symbol]/requireResolvableAsset';
import { SymbolLayoutProviders } from '@/app/[locale]/[symbol]/SymbolLayoutClient';
import { SymbolLayoutJail } from '@/app/[locale]/[symbol]/SymbolLayoutJail';
import { pickAssetName } from '@/entities/ticker/lib/ticker';
import { SymbolViewPing } from '@/features/visitor-ping/ui/SymbolViewPing';
import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
import { localePath } from '@/shared/i18n/locales';
import { RouteMessages } from '@/shared/i18n/RouteMessages';
import { enterLocale } from '@/shared/lib/enterLocale';
import { RelatedSymbols } from '@/views/symbol/RelatedSymbols';
import { SymbolTabPendingSlot } from '@/views/symbol/SymbolTabPendingContext';
import { AskAiFab } from '@/widgets/ask-ai-fab/AskAiFab';

import { SymbolTabSkeleton } from './SymbolTabSkeleton';

/** `[locale]/[symbol]` 세그먼트 파라미터(Next 16은 Promise로 넘긴다). */
type SymbolLayoutParams = Promise<{ locale: string; symbol: string }>;

interface SymbolLayoutProps {
    children: ReactNode;
    params: SymbolLayoutParams;
}

/**
 * `/[symbol]/*` 9개 탭이 공유하는 셸 — 심볼 존재 판정, 크롬(헤더·탭), 탭 pending 골격, 관련 종목 칩,
 * 조회수 비콘, `ai.siglens.io` 플로팅 링크.
 *
 * **심볼 존재 판정은 이 레이아웃 최상단에서 한다.** 존재하지 않는 심볼이 페이지 렌더(AI·봉 조회)까지
 * 가기 전에 `getAssetInfoResilient` 한 번으로 끊긴다. 그래서 의도적으로 blocking이다 — `children`을
 * 돌려주기 전에 존재를 확정한다. 비용은 감당 가능하다: `generateStaticParams: []` ISR이라 blocking은
 * cold-gen·재검증 렌더에만 생기고, 그 조회는 모든 탭 본문이 어차피 기다리는 값이다. 탭 가용성
 * (`isTabAllowedForSymbol`)은 탭을 알아야 해서 각 `page.tsx`에 남는다.
 *
 * **서버 데이터 Suspense를 두지 않는다**(크롬 포함, `[symbol]` 아래 `loading.tsx`도 없다 —
 * `symbolNoLoadingBoundaries.test.ts`). Next 16.2는 Suspense 경계 안쪽에서 던진 `notFound()`의 상태를
 * 200으로 남기고(soft 404), 서버 데이터 경계는 raw HTML에 숨김 청크를 남겨 JS 없는 크롤러에게 헤더·탭을
 * 가린다. 내비게이션 중 골격은 클라 pending slot(`SymbolTabPendingSlot` → `SymbolTabSkeleton`)이 그린다.
 *
 * Sticky-footer jail(`SymbolLayoutJail`): 헤더 + 탭 본문을 첫 뷰포트 잔여 영역(viewport − site
 * Header `--header-h`)에 맞춘 `min-h` 컨테이너로 감싼다. footer는 root layout에서 jail의 형제라 스크롤해야
 * 보인다. `--header-h`는 `globals.css` `@theme`의 3.5rem 기본값으로 site Header `h-14`와 맞물린다.
 */
export default async function SymbolLayout({
    children,
    params,
}: SymbolLayoutProps) {
    const { locale: rawLocale, symbol } = await params;
    const locale = enterLocale(rawLocale);
    const ticker = symbol.toUpperCase();
    // 형상 불합격(해외 거래소 접미사 포함)은 외부 호출 없이 즉시 404.
    if (!isAdmissibleSymbolShape(ticker)) notFound();
    // 해결 순서: 캐시 → crypto_assets → FMP 크립토 목록 → asset_translations → FMP `search-symbol`.
    // FMP 전면 장애에도 DB가 살아 있으면 실재 종목은 asset_translations에서 풀려 degraded 200 + noindex가
    // 된다. FMP와 DB가 동시에 죽으면 `isUnresolvableDegraded`가 `VALID_TICKER_RE` 형상만 살려 두어
    // 자릿수 초과·숫자 시작 크립토는 404가 되지만, cache-handler가 `status >= 400` 엔트리를 저장하지
    // 않아 복구 즉시 정상 렌더된다. 모든 탭의 `generateMetadata`도 같은 판정을 부른다.
    const { assetInfo, degraded } = await requireResolvableAsset(ticker);
    return (
        // 이 서브트리가 실제로 쓰는 메시지만 클라이언트로 내려보낸다 — 루트 레이아웃은 크롬만
        // 싣는다(`RouteMessages` JSDoc).
        <RouteMessages route="[symbol]" locale={locale}>
            <SymbolLayoutProviders>
                <SymbolLayoutJail>
                    <SymbolLayoutChrome
                        assetInfo={assetInfo}
                        degraded={degraded}
                        params={params}
                    />
                    <SymbolTabPendingSlot fallback={<SymbolTabSkeleton />}>
                        {children}
                    </SymbolTabPendingSlot>
                </SymbolLayoutJail>
                {/* 관련 종목 칩 — **jail 밖**이라 페이지 일반 스크롤로 닿는다(푸터 바로 위). 차트 탭의
                    `<main>` 안이면 AI 패널 스크롤러 쪽에 깔려 사람은 끝내 닿지 못한다. jail 높이 계산은
                    건드리지 않는다 — 형제로 붙을 뿐이라 차트 세로폭은 그대로다.

                    9개 탭 전부에 렌더돼 모든 탭이 다른 종목으로 나가는 간선을 갖는다. 피어 8종의 이름 조회
                    (`Promise.all` 1왕복, 각 종목 자기 페이지가 채운 캐시 공유)는 콜드젠마다 치른다.
                    Suspense로 감싸지 않는다 — 경계 뒤 콘텐츠는 raw HTML 끝쪽으로 스트리밍돼 JS를 실행하지
                    않는 크롤러(Naver Yeti·Daumoa)에게 내부링크가 푸터 뒤로 밀린다. 한국어 검색이 주
                    유입이고 내부링크가 이 컴포넌트의 존재 이유다. */}
                <RelatedSymbols symbol={ticker} />
                {/* 조회수 비콘 — notFound() 판정 뒤라 실재 종목만 집계된다. 레이아웃은 같은 종목의 탭
                    이동에서 유지되므로 탭마다 재전송하지 않는다. */}
                <SymbolViewPing symbol={ticker} />
                {/* `ai.siglens.io`로 보내는 플로팅 링크(위치·z-index는 `AskAiFab` JSDoc). 패널 없이 새 탭으로
                    이동하는 순수 서버 렌더 링크라, 위에서 확정한 `assetInfo`·`locale`로 인라인 렌더한다 —
                    경계 뒤에 두면 링크가 raw HTML 끝의 숨김 청크로 밀린다. */}
                <AskAiFab
                    name={pickAssetName(assetInfo, assetInfo.symbol, locale)}
                    localePrefix={localePath(locale, '/')}
                />
            </SymbolLayoutProviders>
        </RouteMessages>
    );
}
