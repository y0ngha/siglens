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
    skipsVersionSkewReload,
} from '@/shared/lib/reloadOnVersionSkew';

interface ReactQueryProviderProps {
    readonly children: ReactNode;
}

/**
 * 탭 하나에 하나뿐인 React Query 클라이언트. 메인 호스트는 앱 크롬(`_components/SiteChrome.tsx`)이,
 * ai 호스트는 `ai/[locale]/layout.tsx`가 감싼다.
 *
 * 쿼리·뮤테이션 대부분이 Server Action이라, 배포 뒤 옛 빌드에 남은 탭은 전부 "action not found"를
 * 받는다. 로그아웃된 듯 반쯤 빈 페이지를 그리는 대신 한 번 새로고침한다(`reloadOnVersionSkew`).
 */
export function ReactQueryProvider({ children }: ReactQueryProviderProps) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                queryCache: new QueryCache({
                    onError: (error, query) => {
                        if (skipsVersionSkewReload(query.meta)) return;
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
                        // 빌드 불일치는 재시도로 고쳐지지 않는다 — 실패만 두 배가 된다.
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
