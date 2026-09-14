'use client';

import {
    MutationCache,
    QueryCache,
    QueryClient,
    QueryClientProvider,
} from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import {
    QUERY_GC_TIME_MS,
    QUERY_STALE_TIME_MS,
} from '@/shared/config/queryConfig';
import {
    isVersionSkewError,
    reloadOnVersionSkew,
} from '@/shared/lib/reloadOnVersionSkew';

interface ReactQueryProviderProps {
    children: ReactNode;
}

export function ReactQueryProvider({ children }: ReactQueryProviderProps) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                // Most queries and mutations here are Server Actions. After a deploy a
                // tab still on the old build gets "action not found" for all of them —
                // reload once instead of rendering a logged-out, half-empty page.
                queryCache: new QueryCache({
                    onError: error => {
                        reloadOnVersionSkew(error);
                    },
                }),
                mutationCache: new MutationCache({
                    onError: error => {
                        reloadOnVersionSkew(error);
                    },
                }),
                defaultOptions: {
                    queries: {
                        staleTime: QUERY_STALE_TIME_MS,
                        gcTime: QUERY_GC_TIME_MS,
                        // A retry cannot fix a build mismatch; it only doubles the failure.
                        retry: (failureCount, error) =>
                            !isVersionSkewError(error) && failureCount < 1,
                        refetchOnWindowFocus: false,
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
