import { Suspense, type ReactNode } from 'react';
import {
    dehydrate,
    HydrationBoundary,
    QueryClient,
} from '@tanstack/react-query';
import { connection } from 'next/server';
import {
    SymbolLayoutFloatingChat,
    SymbolLayoutHeaderClient,
    SymbolLayoutProviders,
} from '@/app/[symbol]/SymbolLayoutClient';
import { SymbolTabsSkeleton } from '@/components/symbol-page/SymbolTabsSkeleton';
import { DEFAULT_TIMEFRAME } from '@/domain/constants/market';
import { getBarsAction } from '@/infrastructure/market/getBarsAction';
import { getAssetInfoCached } from '@/infrastructure/ticker/getAssetInfoCached';
import { QUERY_KEYS, QUERY_STALE_TIME_MS } from '@/lib/queryConfig';

interface SymbolLayoutProps {
    children: ReactNode;
    params: Promise<{ symbol: string }>;
}

// Layout shell stays as an RSC: it hands off to a client provider subtree that
// keeps model/chat state alive across the symbol tabs.
//
// Awaiting `params` is dynamic under Next.js Cache Components, so the chrome that
// depends on `symbol` is gated behind Suspense to keep the static shell prerenderable.
// Keep `children` outside that PPR boundary so the header resume slot cannot also
// own the active page subtree.
export default function SymbolLayout({ children, params }: SymbolLayoutProps) {
    return (
        <SymbolLayoutProviders>
            <Suspense fallback={<SymbolHeaderShellFallback />}>
                <SymbolLayoutChrome params={params} />
            </Suspense>
            {children}
            <Suspense fallback={null}>
                <SymbolFloatingChat params={params} />
            </Suspense>
        </SymbolLayoutProviders>
    );
}

interface SymbolLayoutChromeProps {
    params: Promise<{ symbol: string }>;
}

async function SymbolLayoutChrome({ params }: SymbolLayoutChromeProps) {
    // Cache Components (Next.js 16) requires that any `Date.now()` read during
    // render (incl. React Query's internal `dataUpdatedAt = Date.now()` inside
    // setQueryData / prefetchQuery below) be preceded by either a `fetch()` or
    // a request-data accessor in the cookies/headers/connection/searchParams
    // family. `await params` does NOT count for this gate, so we explicitly
    // mark the segment dynamic up front to avoid a NEXT_STATIC_GEN_BAILOUT.
    await connection();

    const { symbol } = await params;
    const ticker = symbol.toUpperCase();
    const assetInfo = await getAssetInfoCached(ticker);

    // FearGreedHeaderChipMounted (in SymbolLayoutHeader) calls useBars with DEFAULT_TIMEFRAME
    // via useSuspenseQuery + getBarsAction (a Server Action). Server Actions cannot be invoked
    // during SSR rendering. Prefetching here and dehydrating into HydrationBoundary ensures
    // the header chip satisfies the query from cache instead of calling getBarsAction
    // during initial render.
    const queryClient = new QueryClient({
        defaultOptions: { queries: { staleTime: QUERY_STALE_TIME_MS } },
    });

    if (assetInfo) {
        queryClient.setQueryData(QUERY_KEYS.assetInfo(ticker), assetInfo);
    }

    await queryClient.prefetchQuery({
        queryKey: QUERY_KEYS.bars(ticker, DEFAULT_TIMEFRAME),
        queryFn: () =>
            getBarsAction(ticker, DEFAULT_TIMEFRAME, assetInfo?.fmpSymbol),
    });

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <SymbolLayoutHeaderClient symbol={symbol} />
        </HydrationBoundary>
    );
}

async function SymbolFloatingChat({ params }: SymbolLayoutChromeProps) {
    const { symbol } = await params;
    return <SymbolLayoutFloatingChat symbol={symbol} />;
}

// Static shell mirroring SymbolLayoutHeader's outer shape. Used as the PPR fallback
// while params resolve and the client chrome hydrates.
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
