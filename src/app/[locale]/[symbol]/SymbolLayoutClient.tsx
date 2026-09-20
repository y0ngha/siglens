'use client';

import { type ReactNode } from 'react';
import { SymbolModelProvider } from '@/features/symbol-model';
import { ShareableAnalysisProvider } from '@/features/share';

interface SymbolLayoutJailProps {
    children: ReactNode;
}

/**
 * Sticky-footer jail wrapper shared by every `/[symbol]/*` route.
 *
 * **Every route — the chart (index) page included — is a growable `min-h` box,
 * never a clipped fixed-height one.** The whole `/[symbol]/*` tree has exactly
 * one scroller: the document. The chart route used to be the exception
 * (`md:h-[calc(...)] md:overflow-hidden`) so that ChartContent's `md:h-full`
 * aside could resolve a percentage height and scroll internally. That produced
 * three scrollbars on desktop — the jail-clipped `<main>`, the AI panel, and the
 * body — which the product owner reported against v0.79.0. The chart's definite
 * height now lives on the chart column itself (`--symbol-chart-h`, globals.css),
 * so no ancestor needs to establish one and nothing needs clipping.
 *
 * `min-h-[calc(...)]` keeps short pages tall enough for the sticky footer while
 * letting long pages expand and scroll the page naturally.
 *
 * The footer lives in the root layout as the jail's sibling, so it sits below
 * the jail and is reached by scrolling on every route.
 */
export function SymbolLayoutJail({ children }: SymbolLayoutJailProps) {
    // Class string written out in full (not interpolated) so Tailwind's JIT
    // content scanner can statically detect and generate it.
    return (
        <div className="flex min-h-[calc(100dvh-var(--header-h,3.5rem)-var(--pwa-banner-h,0px))] flex-col">
            {children}
        </div>
    );
}

interface SymbolLayoutProvidersProps {
    children: ReactNode;
}

/**
 * Client provider subtree shared by every `/[symbol]/*` page. Keeps the model
 * context alive across symbol tab navigation.
 */
export function SymbolLayoutProviders({
    children,
}: SymbolLayoutProvidersProps) {
    return (
        <SymbolModelProvider>
            <ShareableAnalysisProvider>{children}</ShareableAnalysisProvider>
        </SymbolModelProvider>
    );
}
