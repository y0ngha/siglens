/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import type { NewsDisplayItem } from '@/domain/types';
import { getNewsCardsAction } from '@/infrastructure/market/getNewsCardsAction';
import {
    MAX_CONSECUTIVE_FAILURES,
    MAX_POLL_DURATION_MS,
    POLL_INTERVAL_MS,
    useNewsCardPolling,
} from '@/components/news/hooks/useNewsCardPolling';

jest.mock('@/infrastructure/market/getNewsCardsAction', () => ({
    getNewsCardsAction: jest.fn(),
}));

const mockGetNewsCardsAction = getNewsCardsAction as jest.MockedFunction<
    typeof getNewsCardsAction
>;

const READY_ITEM: NewsDisplayItem = {
    id: 'news-1',
    publishedAt: '2026-05-06T00:00:00.000Z',
    titleEn: 'AAPL announces new product',
    titleKo: '애플, 신제품 발표',
    sentiment: 'bullish',
    category: 'earnings',
    bodyKo: '애플은 신제품 발표 이후 수요 기대가 커졌다고 밝혔습니다.',
    summaryKo: '신제품 발표가 투자심리에 긍정적으로 작용했습니다.',
    priceImpact: 'medium',
    url: 'https://example.com/news-1',
    source: 'Example',
};

const PENDING_ITEM: NewsDisplayItem = {
    ...READY_ITEM,
    id: 'news-pending',
    sentiment: null,
    priceImpact: null,
    category: null,
    bodyKo: null,
    summaryKo: null,
};

describe('useNewsCardPolling', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        mockGetNewsCardsAction.mockReset();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('초기 뉴스가 비어 있으면 폴링 상태로 시작하고 새 카드를 반영한 뒤 확인 카드를 닫는다', async () => {
        mockGetNewsCardsAction.mockResolvedValue([READY_ITEM]);

        const { result } = renderHook(() => useNewsCardPolling('AAPL', []));

        expect(result.current.items).toEqual([]);
        expect(result.current.isPolling).toBe(true);

        await act(async () => {
            await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
        });

        expect(mockGetNewsCardsAction).toHaveBeenCalledWith('AAPL');
        expect(result.current.items).toEqual([READY_ITEM]);
        expect(result.current.isPolling).toBe(true);

        await act(async () => {
            await jest.advanceTimersByTimeAsync(12_000);
        });

        expect(result.current.isPolling).toBe(false);
        expect(mockGetNewsCardsAction).toHaveBeenCalledTimes(5);
    });

    it('초기 뉴스가 비어 있고 계속 비어 있으면 제한 이후 폴링을 멈춘다', async () => {
        mockGetNewsCardsAction.mockResolvedValue([]);

        const { result } = renderHook(() => useNewsCardPolling('AAPL', []));

        await act(async () => {
            await jest.advanceTimersByTimeAsync(60_000);
        });

        expect(mockGetNewsCardsAction).toHaveBeenCalledTimes(20);
        expect(result.current.items).toEqual([]);
        expect(result.current.isPolling).toBe(false);
    });

    it('최신 뉴스 확인 카드를 닫은 뒤에도 pending 카드 분석 상태는 계속 폴링한다', async () => {
        let callCount = 0;
        mockGetNewsCardsAction.mockImplementation(async () => {
            callCount += 1;
            return callCount <= 5 ? [PENDING_ITEM] : [READY_ITEM];
        });

        const { result } = renderHook(() =>
            useNewsCardPolling('AAPL', [PENDING_ITEM])
        );

        await act(async () => {
            await jest.advanceTimersByTimeAsync(15_000);
        });

        expect(mockGetNewsCardsAction).toHaveBeenCalledTimes(5);
        expect(result.current.items).toEqual([PENDING_ITEM]);
        expect(result.current.isPolling).toBe(false);

        await act(async () => {
            await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
        });

        expect(mockGetNewsCardsAction).toHaveBeenCalledTimes(6);
        expect(result.current.items).toEqual([READY_ITEM]);
    });

    it('pending 카드 분석 상태는 20회 제한 이후에도 계속 폴링한다', async () => {
        let callCount = 0;
        mockGetNewsCardsAction.mockImplementation(async () => {
            callCount += 1;
            return callCount <= 20 ? [PENDING_ITEM] : [READY_ITEM];
        });

        const { result } = renderHook(() =>
            useNewsCardPolling('AAPL', [PENDING_ITEM])
        );

        await act(async () => {
            await jest.advanceTimersByTimeAsync(60_000);
        });

        expect(mockGetNewsCardsAction).toHaveBeenCalledTimes(20);
        expect(result.current.isPolling).toBe(false);
        expect(result.current.items).toEqual([PENDING_ITEM]);

        await act(async () => {
            await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
        });

        expect(mockGetNewsCardsAction).toHaveBeenCalledTimes(21);
        expect(result.current.items).toEqual([READY_ITEM]);
    });

    it('초기 뉴스가 모두 분석 완료 상태여도 최신 뉴스 확인을 짧게 폴링한다', async () => {
        mockGetNewsCardsAction.mockResolvedValue([READY_ITEM]);

        const { result } = renderHook(() =>
            useNewsCardPolling('AAPL', [READY_ITEM])
        );

        expect(result.current.items).toEqual([READY_ITEM]);
        expect(result.current.isPolling).toBe(true);

        await act(async () => {
            await jest.advanceTimersByTimeAsync(15_000);
        });

        expect(mockGetNewsCardsAction).toHaveBeenCalledTimes(5);
        expect(result.current.isPolling).toBe(false);
    });

    it('분석 완료로 폴링 종료 시 onPollingComplete를 최종 아이템과 함께 호출한다', async () => {
        const onComplete = jest.fn();
        mockGetNewsCardsAction.mockResolvedValue([READY_ITEM]);

        renderHook(() => useNewsCardPolling('AAPL', [READY_ITEM], onComplete));

        await act(async () => {
            await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 5);
        });

        expect(onComplete).toHaveBeenCalledTimes(1);
        expect(onComplete).toHaveBeenCalledWith([READY_ITEM]);
    });

    it('최대 폴링 시간 초과 시 아이템이 있으면 onPollingComplete를 호출한다', async () => {
        const onComplete = jest.fn();
        // PENDING items never become READY → polling continues until timeout
        mockGetNewsCardsAction.mockResolvedValue([PENDING_ITEM]);

        renderHook(() =>
            useNewsCardPolling('AAPL', [PENDING_ITEM], onComplete)
        );

        await act(async () => {
            await jest.advanceTimersByTimeAsync(
                MAX_POLL_DURATION_MS + POLL_INTERVAL_MS
            );
        });

        expect(onComplete).toHaveBeenCalledTimes(1);
        expect(onComplete).toHaveBeenCalledWith([PENDING_ITEM]);
    });

    it('빈 뉴스 목록으로 폴링이 종료되면 onPollingComplete를 호출하지 않는다', async () => {
        const onComplete = jest.fn();
        mockGetNewsCardsAction.mockResolvedValue([]);

        renderHook(() => useNewsCardPolling('AAPL', [], onComplete));

        await act(async () => {
            await jest.advanceTimersByTimeAsync(60_000);
        });

        expect(onComplete).not.toHaveBeenCalled();
    });

    it('연속 실패로 폴링이 종료되면 onPollingComplete를 호출하지 않는다', async () => {
        const onComplete = jest.fn();
        mockGetNewsCardsAction.mockRejectedValue(new Error('db unavailable'));
        const errorSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        renderHook(() => useNewsCardPolling('AAPL', [READY_ITEM], onComplete));

        await act(async () => {
            await jest.advanceTimersByTimeAsync(
                POLL_INTERVAL_MS * MAX_CONSECUTIVE_FAILURES
            );
        });

        expect(onComplete).not.toHaveBeenCalled();
        errorSpy.mockRestore();
    });

    it('뉴스 스냅샷 조회가 연속 실패하면 폴링을 멈추고 pollError를 노출한다', async () => {
        const dbError = new Error('db unavailable');
        mockGetNewsCardsAction.mockRejectedValue(dbError);
        const errorSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        const { result } = renderHook(() =>
            useNewsCardPolling('AAPL', [READY_ITEM])
        );

        // MAX_CONSECUTIVE_FAILURES 회 연속 실패 시 pollError가 설정되고 인터벌이 정리된다.
        await act(async () => {
            await jest.advanceTimersByTimeAsync(
                POLL_INTERVAL_MS * MAX_CONSECUTIVE_FAILURES
            );
        });

        expect(mockGetNewsCardsAction).toHaveBeenCalledTimes(
            MAX_CONSECUTIVE_FAILURES
        );
        expect(result.current.isPolling).toBe(false);
        expect(result.current.pollError).toBe(dbError);

        // 폴링이 멈췄는지 확인 — 추가 시간 진행 후에도 호출 횟수가 늘지 않아야 한다.
        await act(async () => {
            await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 10);
        });
        expect(mockGetNewsCardsAction).toHaveBeenCalledTimes(
            MAX_CONSECUTIVE_FAILURES
        );

        errorSpy.mockRestore();
    });
});
