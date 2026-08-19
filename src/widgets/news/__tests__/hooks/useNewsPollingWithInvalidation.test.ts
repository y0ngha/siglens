// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useNewsPollingWithInvalidation } from '@/widgets/news/hooks/useNewsPollingWithInvalidation';
import type { NewsDisplayItem } from '@/shared/lib/types';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { NEWS_ROW_SERIALIZATION_LIMIT } from '@/widgets/news/constants';

const mockUseNewsCardPolling = vi.fn();

vi.mock('@/widgets/news/hooks/useNewsCardPolling', () => ({
    useNewsCardPolling: (
        symbol: string,
        items: NewsDisplayItem[],
        onComplete: (items: NewsDisplayItem[]) => void
    ) => mockUseNewsCardPolling(symbol, items, onComplete),
}));

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

const ENRICHED_ITEM = {
    id: '1',
    title: 'News 1',
    url: 'https://example.com/1',
    publishedAt: '2025-01-01T00:00:00Z',
    source: 'Test',
    symbol: 'AAPL',
    sentiment: 'bullish',
    priceImpact: 'high',
} as unknown as NewsDisplayItem;

const PENDING_ITEM = {
    id: '2',
    title: 'News 2',
    url: 'https://example.com/2',
    publishedAt: '2025-01-01T00:00:00Z',
    source: 'Test',
    symbol: 'AAPL',
    sentiment: null,
    priceImpact: null,
} as unknown as NewsDisplayItem;

describe('useNewsPollingWithInvalidation', () => {
    afterEach(() => {
        mockUseNewsCardPolling.mockReset();
    });

    /**
     * [회귀] 이 훅의 존재 이유는 "폴링이 끝났을 때 보강 수가 마운트 시점보다 늘었으면
     * 그 종목의 newsAnalysis 쿼리를 무효화한다" 하나뿐인데, 기존 두 케이스는
     * `expect.any(Function)`으로 위임만 확인하고 그 콜백을 **한 번도 호출하지 않는다**.
     * 훅 본문을 통째로 no-op으로 만들어도 108건이 통과했다(감사: 테스트 라운드 18).
     */
    it('보강이 늘어난 채로 폴링이 끝나면 newsAnalysis 쿼리를 무효화한다', () => {
        mockUseNewsCardPolling.mockReturnValue({
            items: [PENDING_ITEM],
            isPolling: true,
        });

        const { client, wrapper } = makeWrapper();
        const invalidate = vi.spyOn(client, 'invalidateQueries');
        renderHook(
            () => useNewsPollingWithInvalidation('AAPL', [PENDING_ITEM]),
            { wrapper }
        );

        const onComplete = mockUseNewsCardPolling.mock.calls[0]![2] as (
            items: NewsDisplayItem[]
        ) => void;
        act(() => onComplete([ENRICHED_ITEM, PENDING_ITEM]));

        expect(invalidate).toHaveBeenCalledWith({
            queryKey: QUERY_KEYS.newsAnalysisPrefix('AAPL'),
        });
        client.clear();
    });

    it('보강 수가 그대로면 무효화하지 않는다 — 무의미한 재조회 방지', () => {
        mockUseNewsCardPolling.mockReturnValue({
            items: [ENRICHED_ITEM],
            isPolling: false,
        });

        const { client, wrapper } = makeWrapper();
        const invalidate = vi.spyOn(client, 'invalidateQueries');
        renderHook(
            () => useNewsPollingWithInvalidation('AAPL', [ENRICHED_ITEM]),
            { wrapper }
        );

        const onComplete = mockUseNewsCardPolling.mock.calls[0]![2] as (
            items: NewsDisplayItem[]
        ) => void;
        act(() => onComplete([ENRICHED_ITEM]));

        expect(invalidate).not.toHaveBeenCalled();
        client.clear();
    });

    it('delegates to useNewsCardPolling and returns its result', () => {
        const pollingReturn = { items: [ENRICHED_ITEM], isPolling: false };
        mockUseNewsCardPolling.mockReturnValue(pollingReturn);

        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(
            () => useNewsPollingWithInvalidation('AAPL', [ENRICHED_ITEM]),
            { wrapper }
        );

        expect(result.current).toBe(pollingReturn);
        expect(mockUseNewsCardPolling).toHaveBeenCalledWith(
            'AAPL',
            [ENRICHED_ITEM],
            expect.any(Function)
        );
        client.clear();
    });

    it('passes initial items to useNewsCardPolling', () => {
        mockUseNewsCardPolling.mockReturnValue({
            items: [PENDING_ITEM],
            isPolling: true,
        });

        const { client, wrapper } = makeWrapper();
        renderHook(
            () => useNewsPollingWithInvalidation('AAPL', [PENDING_ITEM]),
            { wrapper }
        );

        expect(mockUseNewsCardPolling).toHaveBeenCalledWith(
            'AAPL',
            [PENDING_ITEM],
            expect.any(Function)
        );
        client.clear();
    });
});

/**
 * 직렬화 상한(`NEWS_ROW_SERIALIZATION_LIMIT`)이 훅의 **양쪽**에 걸려 있는지 고정한다.
 *
 * 서버는 상한만큼만 넘기는데 폴링이 부르는 액션에는 상한이 없다. 이 비대칭을
 * 방치하면 (1) 기준선은 50개에서 세고 비교는 1,400개에서 세게 되어 보강이 하나도
 * 진행되지 않아도 매 방문 무효화가 터지고(집계 AI 재분석), (2) "더보기 N개 남음"이
 * 첫 페인트 직후 튄다. 기존 케이스는 전부 1~2건짜리라 상한 분기를 밟지 못했다.
 */
describe('useNewsPollingWithInvalidation — 직렬화 상한', () => {
    afterEach(() => {
        mockUseNewsCardPolling.mockReset();
    });

    /** enriched n개 + pending (total-n)개. */
    function rows(total: number, enriched: number, prefix: string) {
        return Array.from({ length: total }, (_, i) =>
            i < enriched
                ? ({
                      ...ENRICHED_ITEM,
                      id: `${prefix}e${i}`,
                  } as NewsDisplayItem)
                : ({ ...PENDING_ITEM, id: `${prefix}p${i}` } as NewsDisplayItem)
        );
    }

    it('상한 밖에서만 보강이 늘어난 것은 무효화 사유가 아니다 — 기준선 모집단 오염 방지', () => {
        const initial = rows(NEWS_ROW_SERIALIZATION_LIMIT, 3, 'a');
        mockUseNewsCardPolling.mockReturnValue({
            items: initial,
            isPolling: true,
        });

        const { client, wrapper } = makeWrapper();
        const invalidate = vi.spyOn(client, 'invalidateQueries');
        renderHook(() => useNewsPollingWithInvalidation('AAPL', initial), {
            wrapper,
        });

        // 앞 50개의 enriched는 3개 그대로. 뒤쪽(화면에 닿지 않는 구간)만 전부 보강됐다.
        const onComplete = mockUseNewsCardPolling.mock.calls[0]![2] as (
            i: NewsDisplayItem[]
        ) => void;
        act(() => onComplete([...initial, ...rows(200, 200, 'b')]));

        expect(invalidate).not.toHaveBeenCalled();
        client.clear();
    });

    it('반환 목록도 같은 상한으로 자르되 앞(최신)을 남긴다', () => {
        const polled = rows(NEWS_ROW_SERIALIZATION_LIMIT + 137, 0, 'p');
        mockUseNewsCardPolling.mockReturnValue({
            items: polled,
            isPolling: false,
        });

        const { client, wrapper } = makeWrapper();
        const { result } = renderHook(
            () =>
                useNewsPollingWithInvalidation(
                    'AAPL',
                    polled.slice(0, NEWS_ROW_SERIALIZATION_LIMIT)
                ),
            { wrapper }
        );

        expect(result.current.items).toHaveLength(NEWS_ROW_SERIALIZATION_LIMIT);
        // slice(-N)으로 뒤집히면 첫 항목이 달라진다.
        expect(result.current.items[0]!.id).toBe('pp0');
        client.clear();
    });

    it('심볼이 바뀌면 기준선을 새 목록으로 다시 잡는다', () => {
        const aapl = rows(10, 8, 'a'); // enriched 8
        mockUseNewsCardPolling.mockReturnValue({
            items: aapl,
            isPolling: true,
        });

        const { client, wrapper } = makeWrapper();
        const invalidate = vi.spyOn(client, 'invalidateQueries');
        const { rerender } = renderHook(
            ({ sym, items }: { sym: string; items: NewsDisplayItem[] }) =>
                useNewsPollingWithInvalidation(sym, items),
            { wrapper, initialProps: { sym: 'AAPL', items: aapl } }
        );

        // 종목 이동: 새 심볼의 초기 목록은 enriched 1개뿐이다.
        const msft = rows(10, 1, 'm');
        mockUseNewsCardPolling.mockReturnValue({
            items: msft,
            isPolling: true,
        });
        rerender({ sym: 'MSFT', items: msft });

        // 기준선이 이전 심볼(8)로 남아 있으면 아래 2개는 8을 못 넘어 무효화가 안 난다.
        const onComplete = mockUseNewsCardPolling.mock.calls.at(-1)![2] as (
            i: NewsDisplayItem[]
        ) => void;
        act(() => onComplete(rows(10, 2, 'm')));

        expect(invalidate).toHaveBeenCalledWith({
            queryKey: QUERY_KEYS.newsAnalysisPrefix('MSFT'),
        });
        client.clear();
    });

    it('상한 밖 보강은 기준선도 오염시키지 않는다 — 무효화가 영영 안 되는 거울상', () => {
        // 앞 50개 중 enriched는 3개뿐이고, 상한 밖 150개는 전부 enriched다.
        const initial = [
            ...rows(NEWS_ROW_SERIALIZATION_LIMIT, 3, 'a'),
            ...rows(150, 150, 'z'),
        ];
        mockUseNewsCardPolling.mockReturnValue({
            items: initial,
            isPolling: true,
        });

        const { client, wrapper } = makeWrapper();
        const invalidate = vi.spyOn(client, 'invalidateQueries');
        renderHook(() => useNewsPollingWithInvalidation('AAPL', initial), {
            wrapper,
        });

        const onComplete = mockUseNewsCardPolling.mock.calls[0]![2] as (
            i: NewsDisplayItem[]
        ) => void;
        // 상한 **안쪽**에서 3 → 10으로 실제 보강이 진행됐다.
        act(() =>
            onComplete([
                ...rows(NEWS_ROW_SERIALIZATION_LIMIT, 10, 'a'),
                ...rows(150, 150, 'z'),
            ])
        );

        // 기준선이 capRows를 안 거치면 1,400 기준이 되어 이 무효화가 영영 안 난다.
        expect(invalidate).toHaveBeenCalled();
        client.clear();
    });
});
