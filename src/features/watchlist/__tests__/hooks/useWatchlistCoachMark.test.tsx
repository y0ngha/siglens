vi.mock('@/shared/lib/nudgeSession', () => ({
    hasNudgeShownThisSession: vi.fn(() => false),
    markNudgeShownThisSession: vi.fn(),
}));

import { act, renderHook } from '@testing-library/react';
import { useWatchlistCoachMark } from '@/features/watchlist/hooks/useWatchlistCoachMark';
import {
    hasNudgeShownThisSession,
    markNudgeShownThisSession,
} from '@/shared/lib/nudgeSession';
import { publishSymbolAnalyzed } from '@/shared/lib/symbolAnalyzedSignal';
import { LOCAL_STORAGE_WATCHLIST_COACH_SEEN_KEY } from '@/shared/lib/storageKeys';

const mockSessionShown = vi.mocked(hasNudgeShownThisSession);
const mockMarkSession = vi.mocked(markNudgeShownThisSession);

describe('useWatchlistCoachMark', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        mockSessionShown.mockReturnValue(false);
    });

    it('분석 렌더 신호 전에는 보이지 않는다', () => {
        const { result } = renderHook(() =>
            useWatchlistCoachMark({ enabled: true })
        );
        expect(result.current.visible).toBe(false);
    });

    it('신호가 오면 보이고 세션 넛지 플래그를 적는다', () => {
        const { result } = renderHook(() =>
            useWatchlistCoachMark({ enabled: true })
        );
        act(() => publishSymbolAnalyzed('AAPL'));
        expect(result.current.visible).toBe(true);
        expect(mockMarkSession).toHaveBeenCalledTimes(1);
    });

    it('enabled=false(관심종목 있음·미하이드레이션)면 신호를 무시한다', () => {
        const { result } = renderHook(() =>
            useWatchlistCoachMark({ enabled: false })
        );
        act(() => publishSymbolAnalyzed('AAPL'));
        expect(result.current.visible).toBe(false);
        expect(mockMarkSession).not.toHaveBeenCalled();
    });

    it('이미 본 방문자(coach-seen)에게는 뜨지 않는다', () => {
        localStorage.setItem(LOCAL_STORAGE_WATCHLIST_COACH_SEEN_KEY, '1');
        const { result } = renderHook(() =>
            useWatchlistCoachMark({ enabled: true })
        );
        act(() => publishSymbolAnalyzed('AAPL'));
        expect(result.current.visible).toBe(false);
    });

    it('같은 세션에 넛지 모달이 먼저 떴으면 다음 세션으로 미룬다', () => {
        mockSessionShown.mockReturnValue(true);
        const { result } = renderHook(() =>
            useWatchlistCoachMark({ enabled: true })
        );
        act(() => publishSymbolAnalyzed('AAPL'));
        expect(result.current.visible).toBe(false);
        expect(
            localStorage.getItem(LOCAL_STORAGE_WATCHLIST_COACH_SEEN_KEY)
        ).toBeNull();
    });

    it('dismiss는 숨기고 coach-seen을 적어 다시 뜨지 않게 한다', () => {
        const { result } = renderHook(() =>
            useWatchlistCoachMark({ enabled: true })
        );
        act(() => publishSymbolAnalyzed('AAPL'));
        act(() => result.current.dismiss());
        expect(result.current.visible).toBe(false);
        expect(
            localStorage.getItem(LOCAL_STORAGE_WATCHLIST_COACH_SEEN_KEY)
        ).toBe('1');
        act(() => publishSymbolAnalyzed('AAPL'));
        expect(result.current.visible).toBe(false);
    });
});
