import { act, renderHook } from '@testing-library/react';
import { useWatchlistPageTab } from '../hooks/useWatchlistPageTab';

function setUrl(url: string) {
    window.history.replaceState(null, '', url);
}

describe('useWatchlistPageTab', () => {
    beforeEach(() => {
        setUrl('/watchlist');
    });

    it('URL의 ?tab= 값으로 시작한다', () => {
        setUrl('/watchlist?tab=recent');
        const { result } = renderHook(() => useWatchlistPageTab());
        expect(result.current[0]).toBe('recent');
    });

    it('탭을 고르면 화면과 URL이 함께 바뀐다', () => {
        const { result } = renderHook(() => useWatchlistPageTab());
        act(() => result.current[1]('recent'));
        expect(result.current[0]).toBe('recent');
        expect(window.location.search).toBe('?tab=recent');
    });

    it('뒤로 가기가 오면 고른 탭 대신 URL을 다시 따른다', () => {
        const { result } = renderHook(() => useWatchlistPageTab());
        act(() => result.current[1]('recent'));
        act(() => {
            setUrl('/watchlist');
            window.dispatchEvent(new PopStateEvent('popstate'));
        });
        expect(result.current[0]).toBe('watchlist');
    });
});
