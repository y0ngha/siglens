import { Suspense, type ReactNode } from 'react';
import { SymbolLayoutClient } from '@/app/[symbol]/SymbolLayoutClient';
import { SymbolTabsSkeleton } from '@/components/symbol-page/SymbolTabsSkeleton';

interface SymbolLayoutProps {
    children: ReactNode;
    params: Promise<{ symbol: string }>;
}

// Layout shell stays as an RSC: it hands off to a single client subtree that hosts
// the page-agnostic header, scroll lock, and floating chat button.
//
// Awaiting `params` is dynamic under Next.js Cache Components, so the chrome that
// depends on `symbol` is gated behind Suspense to keep the static shell prerenderable.
// PPR resolves each child segment's static/dynamic split independently of the chrome's
// Suspense, so a page (fundamental/news/overall/chart) is not delayed by chrome
// resolution even though `children` is composed inside the same boundary here.
export default function SymbolLayout({ children, params }: SymbolLayoutProps) {
    return (
        <Suspense fallback={<SymbolHeaderShellFallback />}>
            <SymbolLayoutChrome params={params}>{children}</SymbolLayoutChrome>
        </Suspense>
    );
}

interface SymbolLayoutChromeProps {
    params: Promise<{ symbol: string }>;
    children: ReactNode;
}

async function SymbolLayoutChrome({
    params,
    children,
}: SymbolLayoutChromeProps) {
    const { symbol } = await params;
    return <SymbolLayoutClient symbol={symbol}>{children}</SymbolLayoutClient>;
}

// Static shell mirroring SymbolLayoutHeader's outer shape. Used as the PPR fallback
// while params resolve and the client chrome hydrates.
function SymbolHeaderShellFallback() {
    return (
        <header className="px-4 py-3" aria-hidden="true">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-secondary-500 font-mono text-xs tracking-[0.2em] uppercase">
                        SIGLENS
                    </span>
                    <span className="text-secondary-700">/</span>
                    <span className="bg-secondary-700 inline-block h-5 w-32 animate-pulse rounded" />
                </div>
            </div>
            <div className="-mx-4 mt-3">
                <SymbolTabsSkeleton />
            </div>
        </header>
    );
}
