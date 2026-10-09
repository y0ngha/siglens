import { act, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';
import { GUIDE_FILTER_ALL } from '../../lib/guideBrowse';
import { useGuideBrowserState } from '../useGuideBrowserState';

function setUrl(url: string) {
    window.history.replaceState(null, '', url);
}

function firePopstate(url: string) {
    act(() => {
        setUrl(url);
        window.dispatchEvent(new PopStateEvent('popstate'));
    });
}

beforeEach(() => {
    setUrl('/guide');
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('useGuideBrowserState', () => {
    it('서버 렌더는 URL을 읽지 않아 항상 필터 없음이다', () => {
        function Probe() {
            const { state } = useGuideBrowserState();
            return createElement('p', null, `${state.query}|${state.category}`);
        }
        setUrl('/guide?q=rsi&c=indicators');
        // renderToString은 서버 스냅샷(getServerSnapshot)을 쓴다.
        expect(renderToString(createElement(Probe))).toContain(
            `<p>|${GUIDE_FILTER_ALL}</p>`
        );
    });

    it('마운트 후 URL의 ?q=·?c=를 상태로 읽는다', () => {
        setUrl('/guide?q=rsi&c=indicators');

        const { result } = renderHook(() => useGuideBrowserState());

        expect(result.current.state).toEqual({
            query: 'rsi',
            category: 'indicators',
        });
    });

    it('알 수 없는 ?c=는 전체로, 긴 ?q=는 상한에서 자른다', () => {
        setUrl(`/guide?q=${'a'.repeat(100)}&c=nope`);

        const { result } = renderHook(() => useGuideBrowserState());

        expect(result.current.state.category).toBe(GUIDE_FILTER_ALL);
        expect(result.current.state.query).toHaveLength(60);
    });

    it('setQuery는 상태를 바꾸고 replaceState로 URL을 쓴다(이력은 쌓지 않는다)', () => {
        const replace = vi.spyOn(window.history, 'replaceState');
        const push = vi.spyOn(window.history, 'pushState');
        const { result } = renderHook(() => useGuideBrowserState());

        act(() => result.current.setQuery('macd'));

        expect(result.current.state.query).toBe('macd');
        expect(window.location.search).toBe('?q=macd');
        expect(replace).toHaveBeenCalledWith(null, '', '/guide?q=macd');
        expect(push).not.toHaveBeenCalled();
    });

    it('setQuery는 입력을 상한 길이로 자른다', () => {
        const { result } = renderHook(() => useGuideBrowserState());

        act(() => result.current.setQuery('b'.repeat(80)));

        expect(result.current.state.query).toBe('b'.repeat(60));
    });

    it('setCategory는 ?c=를 쓰고 질의를 유지한다', () => {
        setUrl('/guide?q=rsi');
        const { result } = renderHook(() => useGuideBrowserState());

        act(() => result.current.setCategory('strategies'));

        expect(result.current.state).toEqual({
            query: 'rsi',
            category: 'strategies',
        });
        expect(new URLSearchParams(window.location.search).get('c')).toBe(
            'strategies'
        );
        expect(new URLSearchParams(window.location.search).get('q')).toBe(
            'rsi'
        );
    });

    it('경로의 해시는 URL을 다시 쓸 때 보존한다', () => {
        setUrl('/guide#top');
        const { result } = renderHook(() => useGuideBrowserState());

        act(() => result.current.setQuery('rsi'));

        expect(window.location.hash).toBe('#top');
        expect(window.location.search).toBe('?q=rsi');
    });

    it('reset은 상태와 쿼리스트링을 모두 지운다', () => {
        setUrl('/guide?q=rsi&c=indicators');
        const { result } = renderHook(() => useGuideBrowserState());

        act(() => result.current.reset());

        expect(result.current.state).toEqual({
            query: '',
            category: GUIDE_FILTER_ALL,
        });
        expect(window.location.search).toBe('');
        expect(`${window.location.pathname}`).toBe('/guide');
    });

    it('질의를 비우면 ?q=가 URL에서 빠진다', () => {
        const { result } = renderHook(() => useGuideBrowserState());
        act(() => result.current.setQuery('rsi'));

        act(() => result.current.setQuery(''));

        expect(window.location.search).toBe('');
    });

    it('popstate가 오면 선택보다 URL을 따른다', () => {
        const { result } = renderHook(() => useGuideBrowserState());
        act(() => result.current.setQuery('rsi'));
        expect(result.current.state.query).toBe('rsi');

        firePopstate('/guide?q=macd&c=indicators');

        expect(result.current.state).toEqual({
            query: 'macd',
            category: 'indicators',
        });
    });

    it('언마운트하면 popstate 리스너를 뗀다', () => {
        const remove = vi.spyOn(window, 'removeEventListener');
        const { unmount } = renderHook(() => useGuideBrowserState());

        unmount();

        expect(remove).toHaveBeenCalledWith('popstate', expect.any(Function));
    });

    describe('fixedCategory', () => {
        it('?c=를 무시하고 고정 분류를 쓴다', () => {
            setUrl('/guide/indicators?q=rsi&c=strategies');

            const { result } = renderHook(() =>
                useGuideBrowserState('indicators')
            );

            expect(result.current.state).toEqual({
                query: 'rsi',
                category: 'indicators',
            });
        });

        it('setQuery는 ?c=를 쓰지 않는다', () => {
            setUrl('/guide/indicators');
            const { result } = renderHook(() =>
                useGuideBrowserState('indicators')
            );

            act(() => result.current.setQuery('rsi'));

            expect(window.location.search).toBe('?q=rsi');
            expect(result.current.state.category).toBe('indicators');
        });

        it('setCategory를 불러도 고정 분류가 유지되고 ?c=는 URL에 안 실린다', () => {
            setUrl('/guide/indicators');
            const { result } = renderHook(() =>
                useGuideBrowserState('indicators')
            );

            act(() => result.current.setCategory('strategies'));

            expect(result.current.state.category).toBe('indicators');
            expect(window.location.search).toBe('');
        });

        it('reset은 질의만 지우고 고정 분류는 유지한다', () => {
            setUrl('/guide/indicators?q=rsi');
            const { result } = renderHook(() =>
                useGuideBrowserState('indicators')
            );

            act(() => result.current.reset());

            expect(result.current.state).toEqual({
                query: '',
                category: 'indicators',
            });
            expect(window.location.search).toBe('');
        });
    });
});
