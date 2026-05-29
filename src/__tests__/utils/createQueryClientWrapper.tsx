import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';

/**
 * 테스트용 QueryClient와 그것을 주입하는 Provider wrapper를 함께 생성한다.
 *
 * - retry: false — 실패한 query를 재시도하며 대기하지 않게 해 테스트가 즉시 끝나도록 한다.
 * - client를 함께 반환하는 이유: hook 테스트가 afterEach에서 client.clear()로 캐시를
 *   정리해 describe 간 query 상태가 누수되지 않게 하려면 인스턴스 핸들이 필요하다.
 *   wrapper만 필요한 컴포넌트 테스트는 `.wrapper`만 구조분해해 쓰면 된다.
 */
export function createQueryClientWrapper(): {
    wrapper: (props: { children: ReactNode }) => ReactElement;
    client: QueryClient;
} {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    function Wrapper({ children }: { children: ReactNode }): ReactElement {
        return (
            <QueryClientProvider client={client}>
                {children}
            </QueryClientProvider>
        );
    }
    return { wrapper: Wrapper, client };
}
