// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import {
    readPopstateCount,
    usePickUntilPopstate,
    useUrlSearchParam,
} from '@/shared/hooks/useUrlSearchParam';

function setUrl(search: string): void {
    window.history.replaceState(null, '', search === '' ? '/' : `/?${search}`);
}

/** 뒤로/앞으로 가기 — 주소가 바뀐 뒤 브라우저가 popstate를 쏜다. */
function popTo(search: string): void {
    act(() => {
        setUrl(search);
        window.dispatchEvent(new PopStateEvent('popstate'));
    });
}

beforeEach(() => {
    setUrl('');
});

describe('useUrlSearchParam', () => {
    it('클라이언트 렌더에서는 현재 주소의 쿼리를 읽는다', () => {
        setUrl('tf=1Hour');
        const { result } = renderHook(() => useUrlSearchParam('tf'));
        expect(result.current).toBe('1Hour');
    });

    it('popstate가 오면 바뀐 주소로 다시 렌더한다', () => {
        setUrl('tf=1Hour');
        const { result } = renderHook(() => useUrlSearchParam('tf'));
        popTo('tf=4Hour');
        expect(result.current).toBe('4Hour');
    });

    it('서버 렌더 스냅샷은 null이다(정적 HTML이 방문자마다 같다)', () => {
        setUrl('tf=1Hour');
        const seen: (string | null)[] = [];
        function Probe() {
            seen.push(useUrlSearchParam('tf'));
            return null;
        }
        renderToString(createElement(Probe));
        expect(seen).toEqual([null]);
    });

    /**
     * 하이드레이션 렌더는 서버 HTML과 같아야 한다 — 서버 스냅샷(`null`)으로 렌더한 뒤에야
     * 실제 URL 값으로 다시 렌더한다. 첫 렌더부터 URL을 읽으면 React #418이다.
     */
    it('hydrate:true면 하이드레이션 렌더는 null, 그다음 URL 값이다', () => {
        setUrl('tf=1Hour');
        const seen: (string | null)[] = [];
        // 서버 HTML이 비어 있는 컨테이너 — 이 훅은 DOM을 그리지 않으므로 그대로 하이드레이션된다.
        const container = document.createElement('div');
        document.body.appendChild(container);
        const { result } = renderHook(
            () => {
                const value = useUrlSearchParam('tf');
                seen.push(value);
                return value;
            },
            { hydrate: true, container }
        );
        expect(seen[0]).toBeNull();
        expect(result.current).toBe('1Hour');
        container.remove();
    });

    it('한 번의 popstate에 구독자가 몇이든 카운터는 정확히 1 오른다', () => {
        const hooks = [1, 2, 3].map(() =>
            renderHook(() => useUrlSearchParam('tf'))
        );
        const before = readPopstateCount();
        popTo('tf=1Hour');
        expect(readPopstateCount()).toBe(before + 1);
        hooks.forEach(hook => hook.unmount());
    });

    it('마지막 구독자가 언마운트되면 window의 popstate 리스너를 뗀다', () => {
        const add = vi.spyOn(window, 'addEventListener');
        const remove = vi.spyOn(window, 'removeEventListener');
        try {
            const first = renderHook(() => useUrlSearchParam('tf'));
            const second = renderHook(() => useUrlSearchParam('sector'));
            const popstateAdds = add.mock.calls.filter(
                ([type]) => type === 'popstate'
            );
            // 구독자가 둘이어도 리스너는 하나다.
            expect(popstateAdds).toHaveLength(1);
            const handler = popstateAdds[0]?.[1];

            first.unmount();
            expect(
                remove.mock.calls.filter(([type]) => type === 'popstate')
            ).toHaveLength(0);

            second.unmount();
            expect(remove).toHaveBeenCalledWith('popstate', handler);
        } finally {
            add.mockRestore();
            remove.mockRestore();
        }
    });
});

describe('usePickUntilPopstate', () => {
    it('선택이 URL보다 우선한다', () => {
        setUrl('tf=1Hour');
        const { result } = renderHook(() => {
            const fromUrl = useUrlSearchParam('tf');
            const [picked, pick] = usePickUntilPopstate<string>();
            return { value: picked ?? fromUrl, pick };
        });
        expect(result.current.value).toBe('1Hour');

        act(() => {
            result.current.pick('4Hour');
        });
        // URL은 그대로 1Hour지만(선택은 구독자에게 알리지 않는다) 선택이 이긴다.
        expect(new URLSearchParams(window.location.search).get('tf')).toBe(
            '1Hour'
        );
        expect(result.current.value).toBe('4Hour');
    });

    it('popstate가 오면 선택이 무효가 되고 다시 URL을 따른다', () => {
        setUrl('tf=1Hour');
        const { result } = renderHook(() => {
            const fromUrl = useUrlSearchParam('tf');
            const [picked, pick] = usePickUntilPopstate<string>();
            return { picked, value: picked ?? fromUrl, pick };
        });
        act(() => {
            result.current.pick('4Hour');
        });
        expect(result.current.value).toBe('4Hour');

        popTo('tf=1Day');

        expect(result.current.picked).toBeNull();
        expect(result.current.value).toBe('1Day');
    });

    it('popstate 뒤에 다시 고르면 그 선택이 유효하다', () => {
        const { result } = renderHook(() => usePickUntilPopstate<string>());
        popTo('tf=1Day');
        act(() => {
            result.current[1]('5Min');
        });
        expect(result.current[0]).toBe('5Min');
    });
});
