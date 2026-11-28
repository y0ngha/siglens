// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { useAdActivation } from '@/features/ad-slot/hooks/useAdActivation';

const currentUser = vi.hoisted(() => ({
    value: { data: null as { tier: string } | null, isPending: false },
}));
vi.mock('@/entities/auth/hooks/useCurrentUser', () => ({
    useCurrentUser: () => currentUser.value,
}));

const human = vi.hoisted(() => ({
    fire: undefined as (() => void) | undefined,
}));
vi.mock('@/shared/lib/beacon', () => ({
    sendOnHumanInteraction: (send: () => void) => {
        human.fire = send;
        return undefined;
    },
}));

let intersect: ((isIntersecting: boolean) => void) | undefined;
const disconnect = vi.fn();
class FakeIntersectionObserver {
    constructor(callback: IntersectionObserverCallback) {
        intersect = isIntersecting =>
            callback(
                [{ isIntersecting } as IntersectionObserverEntry],
                this as unknown as IntersectionObserver
            );
    }
    observe = vi.fn();
    disconnect = disconnect;
}

function boxRef(): HTMLElement {
    return document.createElement('div');
}

beforeEach(() => {
    currentUser.value = { data: null, isPending: false };
    human.fire = undefined;
    intersect = undefined;
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('useAdActivation', () => {
    it('stays inactive until a person interacts', () => {
        const { result } = renderHook(() => useAdActivation(boxRef(), 'eager'));
        expect(result.current.active).toBe(false);

        act(() => human.fire?.());
        expect(result.current.active).toBe(true);
    });

    it('waits for the user lookup before activating', () => {
        currentUser.value = { data: null, isPending: true };
        const { result, rerender } = renderHook(() =>
            useAdActivation(boxRef(), 'eager')
        );
        act(() => human.fire?.());
        expect(result.current).toEqual({ tier: 'pending', active: false });

        currentUser.value = { data: null, isPending: false };
        rerender();
        expect(result.current).toEqual({ tier: 'show', active: true });
    });

    it('never activates for pro members', () => {
        currentUser.value = { data: { tier: 'pro' }, isPending: false };
        const { result } = renderHook(() => useAdActivation(boxRef(), 'eager'));
        act(() => human.fire?.());
        expect(result.current).toEqual({ tier: 'hide', active: false });
    });

    it('activates a lazy slot only once it nears the viewport', () => {
        const ref = boxRef();
        const { result } = renderHook(() => useAdActivation(ref, 'lazy'));
        act(() => human.fire?.());
        expect(result.current.active).toBe(false);

        act(() => intersect?.(false));
        expect(result.current.active).toBe(false);

        act(() => intersect?.(true));
        expect(result.current.active).toBe(true);
        expect(disconnect).toHaveBeenCalled();
    });

    // 등급이 `hide`면 상자가 렌더되지 않아 노드가 없다. 나중에 등급이 바뀌어 상자가 생기면 그때
    // 관찰을 시작해야 한다 — 노드 대신 ref 객체를 deps에 두면 영영 시작하지 않는다.
    it('starts observing a lazy slot once its box appears', () => {
        let box: HTMLElement | null = null;
        const { result, rerender } = renderHook(() =>
            useAdActivation(box, 'lazy')
        );
        act(() => human.fire?.());
        expect(intersect).toBeUndefined();

        box = boxRef();
        rerender();
        act(() => intersect?.(true));
        expect(result.current.active).toBe(true);
    });

    it('does not observe an eager slot', () => {
        renderHook(() => useAdActivation(boxRef(), 'eager'));
        expect(intersect).toBeUndefined();
    });
});
