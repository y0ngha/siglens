'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

const QUERY_STALE_TIME_MS = 60 * 1000;
const QUERY_GC_TIME_MS = 5 * 60 * 1000;

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
