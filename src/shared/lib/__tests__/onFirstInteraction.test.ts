// @vitest-environment jsdom
import { fireEvent } from '@testing-library/react';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
    type MockInstance,
} from 'vitest';

type Listener = (event: Event) => void;

async function load() {
    vi.resetModules();
    return import('@/shared/lib/onFirstInteraction');
}

function listenerFor(spy: MockInstance, type: string): Listener {
    const call = spy.mock.calls.find(c => c[0] === type);
    if (!call) throw new Error(`no listener for ${type}`);
    return call[1] as Listener;
}

const trusted = { isTrusted: true } as Event;
const untrusted = { isTrusted: false } as Event;

describe('onFirstInteraction', () => {
    let addSpy: MockInstance;
    let removeSpy: MockInstance;

    beforeEach(() => {
        addSpy = vi.spyOn(window, 'addEventListener');
        removeSpy = vi.spyOn(window, 'removeEventListener');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('pointerdown·keydown·wheel을 capture·passive로 듣는다', async () => {
        const { onFirstInteraction } = await load();
        onFirstInteraction(() => {});
        for (const type of ['pointerdown', 'keydown', 'wheel']) {
            const call = addSpy.mock.calls.find(c => c[0] === type);
            expect(call?.[2]).toEqual({ capture: true, passive: true });
        }
        // scroll은 window.scrollTo로도 나므로 듣지 않는다.
        expect(addSpy.mock.calls.find(c => c[0] === 'scroll')).toBeUndefined();
    });

    it('신뢰 이벤트에서 콜백을 한 번 실행하고 리스너를 전부 뗀다', async () => {
        const { onFirstInteraction } = await load();
        const callback = vi.fn();
        onFirstInteraction(callback);

        listenerFor(addSpy, 'keydown')(trusted);
        listenerFor(addSpy, 'pointerdown')(trusted);

        expect(callback).toHaveBeenCalledTimes(1);
        for (const type of ['pointerdown', 'keydown', 'wheel']) {
            expect(removeSpy.mock.calls.find(c => c[0] === type)).toBeDefined();
        }
    });

    it('합성 이벤트(isTrusted=false)는 무시한다', async () => {
        const { onFirstInteraction } = await load();
        const callback = vi.fn();
        onFirstInteraction(callback);

        listenerFor(addSpy, 'pointerdown')(untrusted);
        // 실제 jsdom 디스패치도 isTrusted=false다.
        fireEvent.pointerDown(window);
        fireEvent.keyDown(window, { key: 'a' });

        expect(callback).not.toHaveBeenCalled();
    });

    it('이미 입력이 있었으면 이후 호출은 즉시 실행한다 (SPA 이동)', async () => {
        const { onFirstInteraction } = await load();
        onFirstInteraction(() => {});
        listenerFor(addSpy, 'wheel')(trusted);

        const later = vi.fn();
        addSpy.mockClear();
        onFirstInteraction(later);

        expect(later).toHaveBeenCalledTimes(1);
        expect(addSpy).not.toHaveBeenCalled();
    });

    it('이미 입력이 있었을 때 반환된 해제 함수는 아무 일도 하지 않는다(no-op)', async () => {
        const { onFirstInteraction } = await load();
        onFirstInteraction(() => {});
        listenerFor(addSpy, 'wheel')(trusted);

        const later = vi.fn();
        const detach = onFirstInteraction(later);

        expect(() => detach()).not.toThrow();
        expect(later).toHaveBeenCalledTimes(1);
    });

    it('해제 함수를 부르면 입력이 와도 실행하지 않는다', async () => {
        const { onFirstInteraction } = await load();
        const callback = vi.fn();
        const detach = onFirstInteraction(callback);
        const handler = listenerFor(addSpy, 'pointerdown');

        detach();
        handler(trusted);

        expect(callback).not.toHaveBeenCalled();
    });
});
