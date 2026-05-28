'use client';

import { type ReactNode } from 'react';
import { useSelectedLayoutSegment } from 'next/navigation';
import { FloatingChatButton } from '@/widgets/chat/FloatingChatButton';
import { SymbolChatProvider } from '@/features/symbol-chat';
import { SymbolModelProvider } from '@/widgets/symbol-page/SymbolModelContext';
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
                    ? 'h-[calc(100dvh-var(--header-h,3.5rem)-var(--pwa-banner-h,0px))] overflow-hidden'
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
            <SymbolModelProvider>{children}</SymbolModelProvider>
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
