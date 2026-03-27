'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { QUERY_GC_TIME_MS, QUERY_STALE_TIME_MS } from '@/lib/queryKeys';

interface ReactQueryProviderProps {
    children: React.ReactNode;
}

export function ReactQueryProvider({ children }: ReactQueryProviderProps) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: QUERY_STALE_TIME_MS,
                        gcTime: QUERY_GC_TIME_MS,
                        retry: 1,
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
