vi.mock('@/entities/ticker/actions', () => ({
    getAssetInfoAction: vi.fn(),
}));

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { getAssetInfoAction } from '@/entities/ticker/actions';
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
});
