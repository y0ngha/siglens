import { Suspense, type ReactNode } from 'react';
import {
    dehydrate,
    HydrationBoundary,
    QueryClient,
} from '@tanstack/react-query';
import { SymbolLayoutClient } from '@/app/[symbol]/SymbolLayoutClient';
import { SymbolTabsSkeleton } from '@/components/symbol-page/SymbolTabsSkeleton';
import { DEFAULT_TIMEFRAME } from '@/domain/constants/market';
import { getBarsAction } from '@/infrastructure/market/getBarsAction';
import { getAssetInfoCached } from '@/infrastructure/ticker/getAssetInfoCached';
import { QUERY_KEYS, QUERY_STALE_TIME_MS } from '@/lib/queryConfig';

interface SymbolLayoutProps {
    children: ReactNode;
    params: Promise<{ symbol: string }>;
}

// Layout shell stays as an RSC: it hands off to a single client subtree that hosts
// the page-agnostic header, scroll lock, and floating chat button.
//
// `params` is async (Next.js 16) so the chrome that depends on `symbol` is gated
// behind Suspense. cacheComponents가 비활성화되어 있으므로 connection() 명시
// 신호는 필요 없다.
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
    const ticker = symbol.toUpperCase();
    const assetInfo = await getAssetInfoCached(ticker);

    // FearGreedHeaderChipMounted (in SymbolLayoutHeader) calls useBars with DEFAULT_TIMEFRAME
    // via useSuspenseQuery + getBarsAction (a Server Action). Server Actions cannot be invoked
    // during SSR rendering. Prefetching here and dehydrating into HydrationBoundary ensures
    // every sub-page (/fundamental, /news, /overall, chart) satisfies the query from cache
    // instead of calling getBarsAction during initial render.
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
            <SymbolLayoutClient symbol={symbol}>{children}</SymbolLayoutClient>
        </HydrationBoundary>
    );
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
