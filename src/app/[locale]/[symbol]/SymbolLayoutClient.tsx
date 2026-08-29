'use client';

import { type ReactNode } from 'react';
import { useSelectedLayoutSegment } from 'next/navigation';
import { FloatingChatButton } from '@/widgets/chat/FloatingChatButton';
import { SymbolChatProvider } from '@/features/symbol-chat';
import { SymbolModelProvider } from '@/features/symbol-model';
import { ShareableAnalysisProvider } from '@/features/share';
import { cn } from '@/shared/lib/cn';

interface SymbolLayoutJailProps {
    children: ReactNode;
}

/**
 * Sticky-footer jail wrapper shared by every `/[symbol]/*` route.
 *
 * Height behavior differs by route because the chart (index) page and the
 * sibling tabs (news/fundamental/options/overall/fear-greed) have opposite
 * needs:
 *
 * - Chart route (`useSelectedLayoutSegment() === null`): chart + AI panel must
 *   fill exactly the first viewport with a *definite* height so the AI panel's
 *   own `overflow-y-auto` scrolls internally and the chart keeps a fixed height.
 *   A definite `h-[calc(...)]` (not `min-h`) is required: percentage/`flex-1`
 *   height resolution inside ChartContent (`h-full` aside) only works when an
 *   ancestor has a definite height. `<body>` is `min-h-full` and provides none,
 *   so the jail must establish it here. `overflow-hidden` keeps the chart + AI
 *   flex column contained within that definite height so the fixed-viewport block
 *   never spills past the first screen. (The gate modal and mobile sheet are
 *   `position: fixed`, so they escape the clip; the model dropdown is `absolute`
 *   but opens downward from the header at the top of the jail, well clear of the
 *   bottom edge, so it is not clipped in practice.)
 * - Sibling routes (segment !== null): content flows and grows. `min-h-[calc]`
 *   keeps short pages tall enough for the sticky footer while letting long pages
 *   expand and scroll the page naturally.
 *
 * The footer lives in the root layout as the jail's sibling, so it sits below
 * the jail and is reached by scrolling on every route.
 */
export function SymbolLayoutJail({ children }: SymbolLayoutJailProps) {
    const isChartRoute = useSelectedLayoutSegment() === null;
    // Class strings are written out in full (not interpolated) so Tailwind's JIT
    // content scanner can statically detect and generate them.
    return (
        <div
            className={cn(
                'flex flex-col',
                isChartRoute
                    ? // 확정 높이와 클립은 **데스크톱에서만** 건다.
                      //
                      // 이 높이가 필요한 이유는 `ChartContent`의 aside
                      // (`md:h-full` + 자체 스크롤)가 조상의 확정 높이 없이는
                      // 해석되지 않아서인데, 그 aside는 `hidden md:flex`라
                      // 모바일에 아예 없다. 모바일에서 걸면 얻는 것 없이
                      // **이중 스크롤**만 남았다 — jail이 뷰포트에 고정되고 그
                      // 안의 `<main>`이 따로 스크롤해서, 아래 "지난 AI 분석"에
                      // 닿으려면 스크롤을 두 번 해야 했다(사용자 제보).
                      //
                      // 모바일에서 차트 높이는 차트 블록이 `--symbol-chrome-h`로
                      // 직접 계산한다 — jail의 확정 높이에 기대지 않는다.
                      'min-h-[calc(100dvh-var(--header-h,3.5rem)-var(--pwa-banner-h,0px))] md:h-[calc(100dvh-var(--header-h,3.5rem)-var(--pwa-banner-h,0px))] md:overflow-hidden'
                    : 'min-h-[calc(100dvh-var(--header-h,3.5rem)-var(--pwa-banner-h,0px))]'
            )}
        >
            {children}
        </div>
    );
}

interface SymbolLayoutProvidersProps {
    children: ReactNode;
}

/**
 * Client provider subtree shared by every `/[symbol]/*` page. Keeps the chat and
 * model contexts alive across symbol tab navigation so per-tab pages can publish
 * and consume chat state without remounting providers.
 */
export function SymbolLayoutProviders({
    children,
}: SymbolLayoutProvidersProps) {
    return (
        <SymbolChatProvider>
            <SymbolModelProvider>
                <ShareableAnalysisProvider>
                    {children}
                </ShareableAnalysisProvider>
            </SymbolModelProvider>
        </SymbolChatProvider>
    );
}

interface SymbolLayoutFloatingChatProps {
    symbol: string;
}

/**
 * Floating chat launcher. Reads chat state from `SymbolChatContext` via
 * `useChat`/`useSymbolChat` — no props drilling. Each page (chart/fundamental/
 * news/overall) publishes its own analysis via `usePublishSymbolChat`.
 *
 * Mounted after the active page subtree so the launcher's tab order follows the
 * page content (assistive tech reaches the page first, then the chat affordance).
 */
export function SymbolLayoutFloatingChat({
    symbol,
}: SymbolLayoutFloatingChatProps) {
    return <FloatingChatButton symbol={symbol} />;
}
