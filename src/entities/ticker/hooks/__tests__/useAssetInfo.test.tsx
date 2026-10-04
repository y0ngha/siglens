vi.mock('@/entities/ticker/actions/getAssetInfoAction', () => ({
    getAssetInfoAction: vi.fn(),
}));

import { renderHook, waitFor } from '@testing-library/react';
import {
    QueryClient,
    QueryClientProvider,
    dehydrate,
    hydrate,
} from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { assetInfoSeedUpdatedAt } from '@/shared/config/assetInfoSeed';
import type { ReactNode } from 'react';
import { getAssetInfoAction } from '@/entities/ticker/actions/getAssetInfoAction';
import { useAssetInfo } from '@/entities/ticker/hooks/useAssetInfo';
import type { AssetInfo } from '@/shared/lib/types';

const MOCK_ASSET_INFO: AssetInfo = {
    name: 'Apple Inc.',
    koreanName: '애플',
    fmpSymbol: 'AAPL',
} as AssetInfo;

const queryClients: QueryClient[] = [];

function makeWrapper() {
    const client = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    });
    queryClients.push(client);
    return function Wrapper({ children }: { children: ReactNode }) {
        return (
            <QueryClientProvider client={client}>
                {children}
            </QueryClientProvider>
        );
    };
}

describe('useAssetInfo', () => {
    afterEach(() => {
        queryClients.splice(0).forEach(c => c.clear());
    });

    it('returns undefined while loading', () => {
        (getAssetInfoAction as ReturnType<typeof vi.fn>).mockImplementation(
            () => new Promise(() => {})
        );

        const { result } = renderHook(() => useAssetInfo('AAPL'), {
            wrapper: makeWrapper(),
        });

        expect(result.current).toBeUndefined();
    });

    it('returns asset info after fetch resolves', async () => {
        (getAssetInfoAction as ReturnType<typeof vi.fn>).mockResolvedValue(
            MOCK_ASSET_INFO
        );

        const { result } = renderHook(() => useAssetInfo('AAPL'), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => {
            expect(result.current).toEqual(MOCK_ASSET_INFO);
        });
    });

    it('returns undefined when fetch resolves with null', async () => {
        (getAssetInfoAction as ReturnType<typeof vi.fn>).mockResolvedValue(
            null
        );

        const { result } = renderHook(() => useAssetInfo('UNKNOWN'), {
            wrapper: makeWrapper(),
        });

        await waitFor(() => {
            expect(result.current).toBeUndefined();
        });
    });

    /**
     * 종목 레이아웃은 ISR HTML 결정성을 위해 시드를 고정 `updatedAt`으로 심는다 — 고정
     * staleTime으로는 그 시드가 항상 stale이다. 그렇다고 마운트마다 다시 받으면 모든 종목
     * 페이지뷰가 Server Action 큐에 불필요한 왕복을 하나 끼워 넣는다.
     *
     * 시드는 서버가 실제로 쓰는 경로(`setQueryData` → `dehydrate` → `hydrate`)로 넣는다.
     * 클라이언트 캐시에 직접 넣으면 하이드레이션이 `updatedAt`을 보존하는지는 못 본다.
     */
    describe('서버 시드', () => {
        function seededWrapper(degraded: boolean) {
            const server = new QueryClient();
            server.setQueryData(QUERY_KEYS.assetInfo('AAPL'), MOCK_ASSET_INFO, {
                updatedAt: assetInfoSeedUpdatedAt(degraded),
            });
            const Wrapper = makeWrapper();
            const client = queryClients.at(-1) as QueryClient;
            hydrate(client, dehydrate(server));
            return Wrapper;
        }
        const action = getAssetInfoAction as ReturnType<typeof vi.fn>;
        /** 하이드레이션 게이트(useHydrated)가 열리고 요청이 나갈 시간을 준다. */
        const settle = () => new Promise(resolve => setTimeout(resolve, 30));

        beforeEach(() => {
            action.mockReset();
            action.mockResolvedValue({ ...MOCK_ASSET_INFO, name: 'Refetched' });
        });

        it('정상 조회된 시드는 마운트 때 다시 받지 않는다', async () => {
            const { result } = renderHook(() => useAssetInfo('AAPL'), {
                wrapper: seededWrapper(false),
            });

            expect(result.current).toEqual(MOCK_ASSET_INFO);
            await settle();
            expect(action).not.toHaveBeenCalled();
        });

        it('장애 폴백으로 푼 시드는 다시 받아 스스로 고친다', async () => {
            const { result } = renderHook(() => useAssetInfo('AAPL'), {
                wrapper: seededWrapper(true),
            });

            expect(result.current).toEqual(MOCK_ASSET_INFO);
            await waitFor(() => expect(result.current?.name).toBe('Refetched'));
            expect(action).toHaveBeenCalledTimes(1);
        });
    });
});
