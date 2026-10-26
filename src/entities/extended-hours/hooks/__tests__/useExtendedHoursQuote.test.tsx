vi.mock(
    '@/entities/extended-hours/actions/getExtendedHoursQuoteAction',
    () => ({
        getExtendedHoursQuoteAction: vi.fn(),
    })
);
vi.mock('@/shared/hooks/useHumanInteracted', () => ({
    useHumanInteracted: vi.fn(),
}));

import { act, renderHook } from '@testing-library/react';
import {
    focusManager,
    QueryClient,
    QueryClientProvider,
} from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getExtendedHoursQuoteAction } from '@/entities/extended-hours/actions/getExtendedHoursQuoteAction';
import { useExtendedHoursQuote } from '@/entities/extended-hours/hooks/useExtendedHoursQuote';
import type { ExtendedHoursQuote } from '@/entities/extended-hours/model';
import { useHumanInteracted } from '@/shared/hooks/useHumanInteracted';
import {
    EXTENDED_QUOTE_REFETCH_MS,
    QUERY_KEYS,
} from '@/shared/config/queryConfig';
import { skipsVersionSkewReload } from '@/shared/lib/reloadOnVersionSkew';

const mockedAction = vi.mocked(getExtendedHoursQuoteAction);
const mockedHuman = vi.mocked(useHumanInteracted);

const PRE_MARKET = '2026-10-15T11:07:16Z';
const REGULAR_HOURS = '2026-10-15T16:00:00Z';

const PRE_QUOTE: ExtendedHoursQuote = {
    session: 'pre-market',
    price: 346.38,
    referenceClose: 342.96,
    change: 3.42,
    changePercent: 0.9972,
    tradedAtMs: 1792062432000,
};

const clients: QueryClient[] = [];

function wrapper() {
    const client = new QueryClient();
    clients.push(client);
    return function Wrapper({ children }: { children: ReactNode }) {
        return (
            <QueryClientProvider client={client}>
                {children}
            </QueryClientProvider>
        );
    };
}

async function advance(ms: number): Promise<void> {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
    });
}

describe('useExtendedHoursQuote', () => {
    beforeEach(() => {
        vi.useFakeTimers({
            toFake: [
                'Date',
                'setInterval',
                'clearInterval',
                'setTimeout',
                'clearTimeout',
            ],
        });
        mockedAction.mockReset();
        mockedAction.mockResolvedValue(PRE_QUOTE);
        mockedHuman.mockReturnValue(true);
        focusManager.setFocused(true);
    });

    afterEach(() => {
        focusManager.setFocused(undefined);
        clients.splice(0).forEach(c => c.clear());
        vi.useRealTimers();
    });

    it('사람 입력이 없으면 세션 안이어도 액션을 부르지 않는다(크롤러 방어)', async () => {
        vi.setSystemTime(new Date(PRE_MARKET));
        mockedHuman.mockReturnValue(false);

        const { result } = renderHook(() => useExtendedHoursQuote('AAPL'), {
            wrapper: wrapper(),
        });
        await advance(EXTENDED_QUOTE_REFETCH_MS * 3);

        expect(mockedAction).not.toHaveBeenCalled();
        expect(result.current).toBeNull();
    });

    it('확장 세션 밖에서는 입력이 있어도 액션을 부르지 않는다', async () => {
        vi.setSystemTime(new Date(REGULAR_HOURS));

        const { result } = renderHook(() => useExtendedHoursQuote('AAPL'), {
            wrapper: wrapper(),
        });
        await advance(EXTENDED_QUOTE_REFETCH_MS * 3);

        expect(mockedAction).not.toHaveBeenCalled();
        expect(result.current).toBeNull();
    });

    it('세션 안 + 사람 입력이면 심볼로 액션을 부르고 값을 돌려준다', async () => {
        vi.setSystemTime(new Date(PRE_MARKET));

        const { result } = renderHook(() => useExtendedHoursQuote('AAPL'), {
            wrapper: wrapper(),
        });
        await advance(1);

        expect(mockedAction).toHaveBeenCalledWith('AAPL');
        expect(result.current).toEqual(PRE_QUOTE);
    });

    it('60초마다 다시 받는다', async () => {
        vi.setSystemTime(new Date(PRE_MARKET));

        renderHook(() => useExtendedHoursQuote('AAPL'), { wrapper: wrapper() });
        await advance(1);
        expect(mockedAction).toHaveBeenCalledTimes(1);

        await advance(EXTENDED_QUOTE_REFETCH_MS);
        expect(mockedAction).toHaveBeenCalledTimes(2);
        await advance(EXTENDED_QUOTE_REFETCH_MS);
        expect(mockedAction).toHaveBeenCalledTimes(3);
        expect(EXTENDED_QUOTE_REFETCH_MS).toBe(60_000);
    });

    it('탭이 숨겨지면 폴링을 멈춘다', async () => {
        vi.setSystemTime(new Date(PRE_MARKET));

        renderHook(() => useExtendedHoursQuote('AAPL'), { wrapper: wrapper() });
        await advance(1);
        expect(mockedAction).toHaveBeenCalledTimes(1);

        act(() => focusManager.setFocused(false));
        await advance(EXTENDED_QUOTE_REFETCH_MS * 3);

        expect(mockedAction).toHaveBeenCalledTimes(1);
    });

    it('세션이 끝나면 이전 값을 숨기고 더는 받지 않는다', async () => {
        vi.setSystemTime(new Date('2026-10-15T13:28:30Z')); // 09:28:30 ET

        const { result } = renderHook(() => useExtendedHoursQuote('AAPL'), {
            wrapper: wrapper(),
        });
        await advance(1);
        expect(result.current).toEqual(PRE_QUOTE);
        const callsInSession = mockedAction.mock.calls.length;

        await advance(EXTENDED_QUOTE_REFETCH_MS * 2); // 09:30:30 ET — 정규장

        expect(result.current).toBeNull();
        expect(mockedAction.mock.calls.length).toBeLessThanOrEqual(
            callsInSession + 1
        );
        const after = mockedAction.mock.calls.length;
        await advance(EXTENDED_QUOTE_REFETCH_MS * 3);
        expect(mockedAction.mock.calls.length).toBe(after);
    });

    it('다른 세션 값이 도착하면(프리 중 애프터 값) 표시하지 않는다', async () => {
        vi.setSystemTime(new Date(PRE_MARKET));
        mockedAction.mockResolvedValue({
            ...PRE_QUOTE,
            session: 'after-hours',
        });

        const { result } = renderHook(() => useExtendedHoursQuote('AAPL'), {
            wrapper: wrapper(),
        });
        await advance(1);

        expect(mockedAction).toHaveBeenCalledTimes(1);
        expect(result.current).toBeNull();
    });

    it('액션이 null이면 null이다', async () => {
        vi.setSystemTime(new Date(PRE_MARKET));
        mockedAction.mockResolvedValue(null);

        const { result } = renderHook(() => useExtendedHoursQuote('AAPL'), {
            wrapper: wrapper(),
        });
        await advance(1);

        expect(result.current).toBeNull();
    });

    it('조회 실패가 전역 버전 스큐 새로고침을 일으키지 않도록 meta로 빠진다', async () => {
        vi.setSystemTime(new Date(PRE_MARKET));

        renderHook(() => useExtendedHoursQuote('AAPL'), {
            wrapper: wrapper(),
        });
        await advance(1);

        const query = clients
            .at(-1)
            ?.getQueryCache()
            .find({ queryKey: QUERY_KEYS.extendedQuote('AAPL') });
        expect(skipsVersionSkewReload(query?.meta)).toBe(true);
    });

    it('액션이 거부돼도 던지지 않고 재시도 없이 null이다', async () => {
        vi.setSystemTime(new Date(PRE_MARKET));
        mockedAction.mockRejectedValue(new Error('network'));

        const { result } = renderHook(() => useExtendedHoursQuote('AAPL'), {
            wrapper: wrapper(),
        });
        await advance(5_000);

        expect(mockedAction).toHaveBeenCalledTimes(1);
        expect(result.current).toBeNull();
    });
});
