// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { useSectorSignals } from '@/widgets/dashboard/hooks/useSectorSignals';
import { getSectorSignalsAction } from '@/entities/sector-signal/actions';
import type {
    DashboardTimeframe,
    SectorSignalsResult,
} from '@y0ngha/siglens-core';

vi.mock('@/entities/sector-signal/actions', () => ({
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
const TF_WEEK: DashboardTimeframe = '1Week';

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
            () => useSectorSignals(TF_DAY, SECTOR_RESULT),
            { wrapper }
        );
        // initialData가 있으므로 즉시 stocks를 가져와야 함
        expect(result.current.stocks).toHaveLength(1);
        client.clear();
    });

    it('(Happy) tf 변경 시 getSectorSignalsAction(newTf) 호출', async () => {
        mockAction.mockResolvedValue(SECTOR_RESULT);
        const { client, wrapper } = makeWrapper();
        const { rerender } = renderHook(
            ({ tf }: { tf: DashboardTimeframe }) => useSectorSignals(tf),
            { wrapper, initialProps: { tf: TF_DAY } }
        );

        await waitFor(() => {
            expect(mockAction).toHaveBeenCalledWith(TF_DAY);
        });

        rerender({ tf: TF_WEEK });

        await waitFor(() => {
            expect(mockAction).toHaveBeenCalledWith(TF_WEEK);
        });

        client.clear();
    });

    it('(Happy) non-default tf일 때 initialData는 무시된다', () => {
        mockAction.mockImplementation(() => new Promise(() => {}));
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(
            () => useSectorSignals(TF_WEEK, SECTOR_RESULT),
            { wrapper }
        );
        // 1Week는 default(1Day)가 아니므로 initialData 무시 → 빈 배열
        expect(result.current.stocks).toHaveLength(0);
        client.clear();
    });

    it('(Worst) fetch 실패 시 빈 stocks 반환', async () => {
        mockAction.mockRejectedValue(new Error('network error'));
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(() => useSectorSignals(TF_DAY), {
            wrapper,
        });

        await waitFor(() => {
            // retry=false이고 에러 시 data=undefined → fallback { computedAt: '', stocks: [] }
            expect(result.current.stocks).toHaveLength(0);
        });

        client.clear();
    });

    it('(Worst) data=undefined일 때 빈 fallback 반환', () => {
        mockAction.mockImplementation(() => new Promise(() => {}));
        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(() => useSectorSignals(TF_DAY), {
            wrapper,
        });
        // isPending 상태 — data=undefined이므로 fallback 사용
        expect(result.current.computedAt).toBe('');
        expect(result.current.stocks).toHaveLength(0);
        client.clear();
    });
});
