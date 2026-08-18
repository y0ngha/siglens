// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { useWaitForNewsCards } from '@/widgets/news/hooks/useWaitForNewsCards';
import { getNewsCardsAction } from '@/entities/news-article/actions';
import type { NewsDisplayItem } from '@/shared/lib/types';
import {
    MAX_POLL_DURATION_MS,
    EMPTY_SNAPSHOT_MAX_POLLS,
} from '@/shared/config/cardPollingConfig';

vi.mock('@/entities/news-article/actions', () => ({
    getNewsCardsAction: vi.fn(),
}));

// 폴링 간격만 줄이고 상한들은 실제 값을 쓴다 — 여기서 리터럴을 복제하면
// `cardPollingConfig`가 단일 출처라는 계약이 조용히 깨진다.
vi.mock('@/widgets/news/constants', async importOriginal => ({
    ...(await importOriginal<typeof import('@/widgets/news/constants')>()),
    POLL_INTERVAL_MS: 50,
    MAX_CONSECUTIVE_FAILURES: 2,
}));

const mockGetCards = getNewsCardsAction as ReturnType<typeof vi.fn>;

const ENRICHED_ITEM = {
    id: '1',
    title: 'News 1',
    sentiment: 'bullish',
    priceImpact: 'high',
} as unknown as NewsDisplayItem;

const PENDING_ITEM = {
    id: '2',
    title: 'News 2',
    sentiment: null,
    priceImpact: null,
} as unknown as NewsDisplayItem;

describe('useWaitForNewsCards', () => {
    afterEach(() => {
        mockGetCards.mockReset();
        vi.restoreAllMocks();
    });

    it('returns isReady true immediately when initiallyReady is true', () => {
        const { result } = renderHook(() => useWaitForNewsCards('AAPL', true));
        expect(result.current.isReady).toBe(true);
        expect(result.current.pollError).toBeNull();
    });

    it('returns isReady false initially when initiallyReady is false', () => {
        mockGetCards.mockResolvedValue([PENDING_ITEM]);
        const { result } = renderHook(() => useWaitForNewsCards('AAPL', false));
        expect(result.current.isReady).toBe(false);
    });

    it('becomes ready when polling returns enriched cards', async () => {
        mockGetCards.mockResolvedValue([ENRICHED_ITEM]);
        const { result } = renderHook(() => useWaitForNewsCards('AAPL', false));

        await waitFor(() => {
            expect(result.current.isReady).toBe(true);
        });
    });

    it('does not call getNewsCardsAction when initiallyReady is true', () => {
        renderHook(() => useWaitForNewsCards('AAPL', true));
        expect(mockGetCards).not.toHaveBeenCalled();
    });

    /**
     * [회귀] `cardPollingConfig`의 계약은 "5분 안에 안 채워지면 포기"이고 형제 훅
     * (`useNewsCardPolling`)은 지키고 있었는데 이 훅만 상한이 없었다 — 보강될 카드가
     * 없는 종목에서 탭이 열려 있는 내내 3초마다 server action POST + Neon 조회가
     * 나갔다(감사: 비용 라운드 13).
     */
    it('MAX_POLL_DURATION_MS를 넘기면 폴링을 멈춘다', async () => {
        mockGetCards.mockResolvedValue([PENDING_ITEM]);
        const nowSpy = vi.spyOn(Date, 'now');
        const t0 = 1_700_000_000_000;
        nowSpy.mockReturnValue(t0);

        renderHook(() => useWaitForNewsCards('AAPL', false));

        await waitFor(() => expect(mockGetCards).toHaveBeenCalled());
        const callsBeforeDeadline = mockGetCards.mock.calls.length;

        // 시계를 상한 너머로 밀면 다음 tick에서 스스로 접는다.
        nowSpy.mockReturnValue(t0 + MAX_POLL_DURATION_MS + 1);
        await new Promise(resolve => setTimeout(resolve, 160)); // 3 tick 분량

        expect(mockGetCards.mock.calls.length).toBe(callsBeforeDeadline);
    });

    it('기사가 아예 없으면 EMPTY_SNAPSHOT_MAX_POLLS에서 접는다', async () => {
        // 빈 목록은 보강될 것이 없다 — 5분을 다 기다릴 이유가 없다.
        mockGetCards.mockResolvedValue([]);
        renderHook(() => useWaitForNewsCards('AAPL', false));

        await waitFor(
            () =>
                expect(mockGetCards.mock.calls.length).toBe(
                    EMPTY_SNAPSHOT_MAX_POLLS
                ),
            { timeout: 3_000 }
        );

        const settled = mockGetCards.mock.calls.length;
        await new Promise(resolve => setTimeout(resolve, 160));
        expect(mockGetCards.mock.calls.length).toBe(settled);
    });

    it('기사가 있지만 아직 보강 전이면 20회에서 접지 않는다', async () => {
        // 조기 종료는 "기사가 아예 없다"에만 걸려야 한다. 이 조건이 빠지면 무조건
        // 20회(60초)에서 접혀 5분 계약이 사라지고, 하필 LLM 보강을 기다리는
        // 꼬리 케이스가 그 대상이다(감사 라운드 14).
        mockGetCards.mockResolvedValue([PENDING_ITEM]);
        renderHook(() => useWaitForNewsCards('AAPL', false));

        await waitFor(
            () =>
                expect(mockGetCards.mock.calls.length).toBeGreaterThan(
                    EMPTY_SNAPSHOT_MAX_POLLS
                ),
            { timeout: 3_000 }
        );
    });

    it('종목이 바뀌면 옛 종목의 늦은 응답으로 isReady를 열지 않는다', async () => {
        // `clearInterval`은 다음 tick만 막는다 — 이미 날아간 요청의 응답이 늦게
        // 도착해 새 종목의 상태를 건드리면, 카드가 보강되지 않은 종목에서 분석
        // 패널이 열리고 core의 `no_news` 에러가 영구 캐시된다.
        let resolveStale: ((items: NewsDisplayItem[]) => void) | undefined;
        mockGetCards.mockImplementationOnce(
            () =>
                new Promise<NewsDisplayItem[]>(resolve => {
                    resolveStale = resolve;
                })
        );

        const { rerender, result } = renderHook(
            ({ symbol }) => useWaitForNewsCards(symbol, false),
            { initialProps: { symbol: 'AAPL' } }
        );

        await waitFor(() => expect(resolveStale).toBeDefined());

        // 새 종목은 보강된 카드가 없다.
        mockGetCards.mockResolvedValue([PENDING_ITEM]);
        rerender({ symbol: 'MSFT' });

        // 옛 종목의 응답이 이제 도착한다.
        resolveStale?.([ENRICHED_ITEM]);
        await new Promise(resolve => setTimeout(resolve, 120));

        expect(result.current.isReady).toBe(false);
    });

    it('sets pollError after consecutive failures', async () => {
        mockGetCards.mockRejectedValue(new Error('fetch failed'));
        const { result } = renderHook(() => useWaitForNewsCards('AAPL', false));

        await waitFor(() => {
            expect(result.current.pollError).not.toBeNull();
        });

        expect(result.current.pollError?.message).toBe('fetch failed');
    });
});
