// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import type { RecentSearchEntry } from '@/entities/ticker';
import { useRecentSearches } from '@/features/ticker-search/hooks/useRecentSearches';

const RECENT_SEARCHES_EVENT = 'siglens:recent-searches-change';

// 저장 단위는 `{ symbol, label }`이다. `string[]`로 선언돼 있던 것은 형태를
// 바꾸기 전(2026-08)의 잔재다.
const mockGetRecentSearches = vi.fn<() => RecentSearchEntry[]>(() => []);
const mockAddRecentSearch = vi.fn();
const mockRemoveRecentSearch = vi.fn();
const mockClearRecentSearches = vi.fn();
const mockRelabelRecentSearches = vi.fn();
const mockGetAssetLabelsAction = vi.fn<
    (symbols: string[]) => Promise<{
        labels: Record<string, string>;
        failed: string[];
    }>
>(async () => ({ labels: {}, failed: [] }));

vi.mock('@/entities/ticker', () => ({
    getRecentSearches: (...args: unknown[]) =>
        mockGetRecentSearches(...(args as [])),
    addRecentSearch: (...args: unknown[]) =>
        mockAddRecentSearch(...(args as [string])),
    removeRecentSearch: (...args: unknown[]) =>
        mockRemoveRecentSearch(...(args as [string])),
    clearRecentSearches: (...args: unknown[]) =>
        mockClearRecentSearches(...(args as [])),
    relabelRecentSearches: (...args: unknown[]) =>
        mockRelabelRecentSearches(...(args as [Record<string, string>])),
    RECENT_SEARCHES_STORAGE_KEY: 'siglens:recent-searches',
}));

/**
 * 회사명 백필이 부르는 서버 액션. mock하지 않으면 라벨이 심볼과 같은 픽스처마다
 * 실제 액션이 유닛 테스트에서 호출되고, 그 실패는 `.catch`에 삼켜져 초록으로
 * 통과한다(CONVENTIONS.md External API Mocking).
 */
vi.mock('@/entities/ticker/actions', () => ({
    getAssetLabelsAction: (...args: unknown[]) =>
        mockGetAssetLabelsAction(...(args as [string[]])),
}));

describe('useRecentSearches', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetRecentSearches.mockReturnValue([]);
        mockGetAssetLabelsAction.mockResolvedValue({ labels: {}, failed: [] });
    });

    it('returns an empty recentSearches array initially', () => {
        const { result } = renderHook(() => useRecentSearches());

        expect(result.current.recentSearches).toEqual([]);
    });

    it('returns addSearch, removeSearch, and clearAll functions', () => {
        const { result } = renderHook(() => useRecentSearches());

        expect(typeof result.current.addSearch).toBe('function');
        expect(typeof result.current.removeSearch).toBe('function');
        expect(typeof result.current.clearAll).toBe('function');
    });

    it('calls addRecentSearch when addSearch is invoked', () => {
        const { result } = renderHook(() => useRecentSearches());

        act(() => {
            result.current.addSearch('AAPL');
        });

        expect(mockAddRecentSearch).toHaveBeenCalledWith('AAPL');
    });

    it('calls removeRecentSearch when removeSearch is invoked', () => {
        const { result } = renderHook(() => useRecentSearches());

        act(() => {
            result.current.removeSearch('AAPL');
        });

        expect(mockRemoveRecentSearch).toHaveBeenCalledWith('AAPL');
    });

    it('calls clearRecentSearches when clearAll is invoked', () => {
        const { result } = renderHook(() => useRecentSearches());

        act(() => {
            result.current.clearAll();
        });

        expect(mockClearRecentSearches).toHaveBeenCalled();
    });

    it('dispatches a custom event when addSearch is called', () => {
        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
        const { result } = renderHook(() => useRecentSearches());

        act(() => {
            result.current.addSearch('MSFT');
        });

        const dispatched = dispatchSpy.mock.calls.find(
            call => (call[0] as Event).type === RECENT_SEARCHES_EVENT
        );
        expect(dispatched).toBeDefined();

        dispatchSpy.mockRestore();
    });

    it('dispatches a custom event when removeSearch is called', () => {
        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
        const { result } = renderHook(() => useRecentSearches());

        act(() => {
            result.current.removeSearch('MSFT');
        });

        const dispatched = dispatchSpy.mock.calls.find(
            call => (call[0] as Event).type === RECENT_SEARCHES_EVENT
        );
        expect(dispatched).toBeDefined();

        dispatchSpy.mockRestore();
    });

    it('dispatches a custom event when clearAll is called', () => {
        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
        const { result } = renderHook(() => useRecentSearches());

        act(() => {
            result.current.clearAll();
        });

        const dispatched = dispatchSpy.mock.calls.find(
            call => (call[0] as Event).type === RECENT_SEARCHES_EVENT
        );
        expect(dispatched).toBeDefined();

        dispatchSpy.mockRestore();
    });

    it('returns stable callback references across re-renders', () => {
        const { result, rerender } = renderHook(() => useRecentSearches());
        const firstAdd = result.current.addSearch;
        const firstRemove = result.current.removeSearch;
        const firstClear = result.current.clearAll;

        rerender();

        expect(result.current.addSearch).toBe(firstAdd);
        expect(result.current.removeSearch).toBe(firstRemove);
        expect(result.current.clearAll).toBe(firstClear);
    });
});

/**
 * 회사명 백필.
 *
 * `requestedLabelSymbols`는 훅 모듈의 **모듈 레벨 상태**라 이 파일 안의 테스트끼리
 * 공유된다(로드당 한 번이라는 계약 자체가 그렇다). 리셋하는 대신 테스트마다 다른
 * 심볼을 쓴다 — 모듈을 다시 불러오면 검증하려는 "두 번 묻지 않는다"가 사라진다.
 */
describe('useRecentSearches — 회사명 백필', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAssetLabelsAction.mockResolvedValue({ labels: {}, failed: [] });
    });

    it('라벨이 심볼과 같은 항목만 조회한다', async () => {
        mockGetRecentSearches.mockReturnValue([
            { symbol: 'BF1', label: 'BF1' },
            { symbol: 'BF2', label: '이미 회사명' },
        ]);

        await act(async () => {
            renderHook(() => useRecentSearches());
        });

        expect(mockGetAssetLabelsAction).toHaveBeenCalledWith(['BF1']);
    });

    it('받은 이름을 relabelRecentSearches에 넘긴다', async () => {
        mockGetRecentSearches.mockReturnValue([
            { symbol: 'BF3', label: 'BF3' },
        ]);
        mockGetAssetLabelsAction.mockResolvedValue({
            labels: { BF3: '비에프삼' },
            failed: [],
        });

        await act(async () => {
            renderHook(() => useRecentSearches());
        });

        expect(mockRelabelRecentSearches).toHaveBeenCalledWith({
            BF3: '비에프삼',
        });
    });

    it('같은 심볼을 로드당 두 번 묻지 않는다', async () => {
        mockGetRecentSearches.mockReturnValue([
            { symbol: 'BF4', label: 'BF4' },
        ]);

        await act(async () => {
            renderHook(() => useRecentSearches());
        });
        await act(async () => {
            renderHook(() => useRecentSearches());
        });

        expect(mockGetAssetLabelsAction).toHaveBeenCalledTimes(1);
    });

    it('이름 없이 성공한 심볼은 다시 묻지 않는다', async () => {
        // 결과가 바뀌지 않는 조회다. 되물으면 오버레이를 열 때마다 왕복이 는다.
        mockGetRecentSearches.mockReturnValue([
            { symbol: 'BF5', label: 'BF5' },
        ]);
        mockGetAssetLabelsAction.mockResolvedValue({ labels: {}, failed: [] });

        await act(async () => {
            renderHook(() => useRecentSearches());
        });
        await act(async () => {
            renderHook(() => useRecentSearches());
        });

        expect(mockGetAssetLabelsAction).toHaveBeenCalledTimes(1);
        expect(mockRelabelRecentSearches).not.toHaveBeenCalled();
    });

    it('조회에 실패한 심볼은 다음 마운트에서 다시 시도한다', async () => {
        mockGetRecentSearches.mockReturnValue([
            { symbol: 'BF6', label: 'BF6' },
        ]);
        mockGetAssetLabelsAction.mockResolvedValue({
            labels: {},
            failed: ['BF6'],
        });

        await act(async () => {
            renderHook(() => useRecentSearches());
        });
        await act(async () => {
            renderHook(() => useRecentSearches());
        });

        expect(mockGetAssetLabelsAction).toHaveBeenCalledTimes(2);
    });

    it('왕복 자체가 깨지면 배치 전체를 다시 시도한다', async () => {
        mockGetRecentSearches.mockReturnValue([
            { symbol: 'BF7', label: 'BF7' },
        ]);
        mockGetAssetLabelsAction.mockRejectedValueOnce(new Error('network'));

        await act(async () => {
            renderHook(() => useRecentSearches());
        });
        await act(async () => {
            renderHook(() => useRecentSearches());
        });

        expect(mockGetAssetLabelsAction).toHaveBeenCalledTimes(2);
    });
});
