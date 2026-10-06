import { type ReactNode } from 'react';

interface SymbolLayoutJailProps {
    children: ReactNode;
}

/**
 * Sticky-footer jail wrapper shared by every `/[symbol]/*` route.
 *
 * **Every route — the chart (index) page included — is a growable `min-h` box,
 * never a clipped fixed-height one.** The jail and `<main>` never scroll; the
 * document does. The only other scroller in the tree is the chart route's
 * desktop AI panel, which locks itself to `--symbol-chart-h` and scrolls its
 * own overflow (see the aside comment in ChartContent).
 *
 * The chart route used to be the exception
 * (`md:h-[calc(...)] md:overflow-hidden`) so that ChartContent's `md:h-full`
 * aside could resolve a percentage height and scroll internally. That produced
 * three scrollbars on desktop — the jail-clipped `<main>`, the AI panel, and the
 * body — which the product owner reported against v0.79.0. The chart's definite
 * height now lives on the chart column and the AI panel themselves
 * (`--symbol-chart-h`, globals.css), so no ancestor needs to establish one and
 * nothing needs clipping.
 *
 * `min-h-[calc(...)]` keeps short pages tall enough for the sticky footer while
 * letting long pages expand and scroll the page naturally.
 *
 * The footer lives in the root layout as the jail's sibling, so it sits below
 * the jail and is reached by scrolling on every route.
 *
 * 이 파일은 프로바이더(`SymbolLayoutClient`)와 분리돼 있어야 한다. 루트 레이아웃이 모든
 * 라우트에서 그리는 종목 진입 골격(`SymbolEntrySkeleton`)이 이 jail을 쓰는데, 같은 파일에
 * 있으면 모델 선택 프로바이더를 거쳐 `@y0ngha/siglens-core` 전체(원본 185KB, 전송 ~51KB)가
 * 모든 페이지의 첫 JS에 실렸다(2026-10-05 JS 커버리지 실측, 홈에서 99% 미사용).
 * `src/__tests__/guards/rootLayoutCoreFree.test.ts`가 이 경로를 고정한다.
 */
export function SymbolLayoutJail({ children }: SymbolLayoutJailProps) {
    // Class string written out in full (not interpolated) so Tailwind's JIT
    // content scanner can statically detect and generate it.
    return (
        <div className="flex min-h-[calc(100dvh-var(--header-h,3.5rem))] flex-col">
            {children}
        </div>
    );
}
