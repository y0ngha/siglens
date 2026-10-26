import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useDisabledServerKeyModels } from '@/features/symbol-model/hooks/useDisabledServerKeyModels';
import { MODEL_AVAILABILITY_PATH } from '@/shared/lib/modelAvailability';

const fetchMock = vi.fn();

function wrapper({ children }: { children: ReactNode }) {
    const client = new QueryClient();
    return (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
}

describe('useDisabledServerKeyModels', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', fetchMock);
        fetchMock.mockReset();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('목록을 받으면 settled로 바뀌고 꺼진 모델을 돌려준다', async () => {
        fetchMock.mockResolvedValue(
            Response.json({ disabledModels: ['claude-haiku-5-5'] })
        );

        const { result } = renderHook(() => useDisabledServerKeyModels(), {
            wrapper,
        });

        await waitFor(() => expect(result.current.isSettled).toBe(true));
        expect(result.current.models).toEqual(['claude-haiku-5-5']);
        expect(fetchMock).toHaveBeenCalledWith(MODEL_AVAILABILITY_PATH);
    });

    it('조회가 실패해도 settled로 진행하고 빈 목록을 돌려준다', async () => {
        fetchMock.mockResolvedValue(new Response('', { status: 500 }));

        const { result } = renderHook(() => useDisabledServerKeyModels(), {
            wrapper,
        });

        await waitFor(() => expect(result.current.isSettled).toBe(true));
        expect(result.current.models).toEqual([]);
    });
});
