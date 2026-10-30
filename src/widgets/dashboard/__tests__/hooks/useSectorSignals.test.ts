// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { useSectorSignals } from '@/widgets/dashboard/hooks/useSectorSignals';
import { getSectorSignalsAction } from '@/entities/sector-signal/actions/getSectorSignalsAction';
import type {
    DashboardTimeframe,
    SectorSignalsResult,
} from '@y0ngha/siglens-core';

vi.mock('@/entities/sector-signal/actions/getSectorSignalsAction', () => ({
    getSectorSignalsAction: vi.fn(),
}));

vi.mock('@/shared/config/dashboard-tickers', () => ({
    DEFAULT_DASHBOARD_TIMEFRAME: '1Day',
}));

const mockAction = getSectorSignalsAction as ReturnType<typeof vi.fn>;

function makeWrapper() {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return {
        client,
        wrapper: ({ children }: { children: ReactNode }) =>
            createElement(QueryClientProvider, { client }, children),
    };
}

const TF_DAY: DashboardTimeframe = '1Day';
const TF_HOUR: DashboardTimeframe = '1Hour';

const SECTOR_RESULT: SectorSignalsResult = {
    computedAt: '2025-01-01T00:00:00Z',
    stocks: [
        {
            symbol: 'AAPL',
            koreanName: 'Apple',
            sectorSymbol: 'XLK',
            price: 150,
            changePercent: 1.5,
            trend: 'uptrend' as const,
            signals: [],
        },
    ],
};

describe('useSectorSignals', () => {
    afterEach(() => {
        mockAction.mockReset();
    });

    it('(Happy) 기본 tf seed — default tf면 initialData를 즉시 반환한다', async () => {
        mockAction.mockResolvedValue(SECTOR_RESULT);
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(
            () => useSectorSignals('us', TF_DAY, SECTOR_RESULT),
            { wrapper }
        );
        // initialData가 있으므로 조회 전에도 곧바로 ready다
        expect(result.current.status).toBe('ready');
        expect(result.current.data).toEqual(SECTOR_RESULT);
        client.clear();
    });

    it('(Happy) tf 변경 시 getSectorSignalsAction(newTf) 호출', async () => {
        mockAction.mockResolvedValue(SECTOR_RESULT);
        const { client, wrapper } = makeWrapper();
        const { rerender } = renderHook(
            ({ tf }: { tf: DashboardTimeframe }) => useSectorSignals('us', tf),
            {
                wrapper,
                initialProps: { tf: TF_DAY as DashboardTimeframe },
            }
        );

        await waitFor(() => {
            expect(mockAction).toHaveBeenCalledWith('us', TF_DAY);
        });

        rerender({ tf: TF_HOUR });

        await waitFor(() => {
            expect(mockAction).toHaveBeenCalledWith('us', TF_HOUR);
        });

        client.clear();
    });

    it('(Happy) non-default tf일 때 initialData는 무시되고 loading이다', () => {
        mockAction.mockImplementation(() => new Promise(() => {}));
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(
            () => useSectorSignals('us', TF_HOUR, SECTOR_RESULT),
            { wrapper }
        );
        // 1Hour는 default(1Day)가 아니므로 initialData 무시 → 데이터 없음
        expect(result.current.status).toBe('loading');
        expect(result.current.data).toBeUndefined();
        client.clear();
    });

    it('(Happy) 조회가 끝나면 ready와 데이터를 노출한다', async () => {
        mockAction.mockResolvedValue(SECTOR_RESULT);
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(() => useSectorSignals('us', TF_DAY), {
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.status).toBe('ready');
        });
        expect(result.current.data).toEqual(SECTOR_RESULT);
        client.clear();
    });

    it('(Worst) fetch 실패 시 error 상태이고 데이터는 없다', async () => {
        mockAction.mockRejectedValue(new Error('network error'));
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(() => useSectorSignals('us', TF_DAY), {
            wrapper,
        });

        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });
        expect(result.current.data).toBeUndefined();
        client.clear();
    });

    it('(Worst) 조회 중에는 빈 결과를 꾸며내지 않고 loading이다', () => {
        mockAction.mockImplementation(() => new Promise(() => {}));
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(() => useSectorSignals('us', TF_DAY), {
            wrapper,
        });
        expect(result.current.status).toBe('loading');
        expect(result.current.data).toBeUndefined();
        client.clear();
    });

    it('(Worst) 실패 뒤 retry를 부르면 다시 조회해 ready가 된다', async () => {
        mockAction.mockRejectedValueOnce(new Error('network error'));
        mockAction.mockResolvedValue(SECTOR_RESULT);
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(() => useSectorSignals('us', TF_DAY), {
            wrapper,
        });
        await waitFor(() => {
            expect(result.current.status).toBe('error');
        });

        act(() => {
            result.current.retry();
        });

        await waitFor(() => {
            expect(result.current.status).toBe('ready');
        });
        expect(result.current.data).toEqual(SECTOR_RESULT);
        client.clear();
    });
});
