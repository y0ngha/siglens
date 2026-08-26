// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { usePricePaneSize } from '@/widgets/chart/hooks/usePricePaneSize';
import type { PaneIndices } from '@/widgets/chart/types';

vi.mock('lightweight-charts', () => ({}));

const PANE_INDICES = {} as PaneIndices;

const observed: Element[] = [];
let notify: (() => void) | null = null;
const mockDisconnect = vi.fn();

class MockResizeObserver {
    constructor(callback: () => void) {
        notify = callback;
    }
    observe = (el: Element): void => {
        observed.push(el);
    };
    unobserve = vi.fn();
    disconnect = mockDisconnect;
}

vi.stubGlobal('ResizeObserver', MockResizeObserver);

afterAll(() => {
    vi.unstubAllGlobals();
});

function makeContainer(width: number, canvasCount = 0): HTMLDivElement {
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: width });
    for (let i = 0; i < canvasCount; i += 1) {
        container.appendChild(document.createElement('canvas'));
    }
    return container;
}

function makeChart(paneHeights: number[]) {
    return {
        panes: () => paneHeights.map(height => ({ getHeight: () => height })),
    };
}

type Params = Parameters<typeof usePricePaneSize>;

function render(chart: unknown, container: HTMLDivElement | null) {
    return renderHook(() =>
        usePricePaneSize(
            { current: chart } as Params[0],
            { current: container } as Params[1],
            PANE_INDICES
        )
    );
}

describe('usePricePaneSize', () => {
    beforeEach(() => {
        observed.length = 0;
        notify = null;
        mockDisconnect.mockClear();
    });

    it('컨테이너가 없으면 0을 돌려준다', () => {
        const { result } = render(makeChart([200]), null);

        expect(result.current).toEqual({ width: 0, height: 0 });
    });

    it('다음 프레임에 pane 0 높이와 컨테이너 폭을 잰다', async () => {
        const { result } = render(makeChart([110, 45, 45]), makeContainer(246));

        await act(
            async () =>
                new Promise<void>(resolve =>
                    requestAnimationFrame(() => resolve())
                )
        );

        expect(result.current).toEqual({ width: 246, height: 110 });
    });

    it('차트가 아직 없으면 높이는 0으로 둔다', async () => {
        const { result } = render(null, makeContainer(246));

        await act(
            async () =>
                new Promise<void>(resolve =>
                    requestAnimationFrame(() => resolve())
                )
        );

        expect(result.current).toEqual({ width: 246, height: 0 });
    });

    it('wrapper뿐 아니라 내부 canvas도 관찰한다', () => {
        // wrapper는 pane 재분배로 크기가 변하지 않는다 — canvas를 봐야 pane
        // 높이 변화를 잡는다(usePaneLabels와 같은 이유).
        render(makeChart([110, 45]), makeContainer(246, 2));

        expect(observed).toHaveLength(3);
    });

    it('크기가 그대로면 같은 객체를 유지한다', async () => {
        const { result } = render(makeChart([110]), makeContainer(246));

        await act(
            async () =>
                new Promise<void>(resolve =>
                    requestAnimationFrame(() => resolve())
                )
        );
        const first = result.current;

        // ResizeObserver 콜백에서 무조건 새 객체를 만들면 관찰 루프가 돈다.
        await act(async () => {
            notify?.();
        });

        expect(result.current).toBe(first);
    });

    /**
     * effect의 return을 통째로 `undefined`로 바꿔도 파일이 초록이었다.
     * 정리 없이 언마운트하면 관찰자가 살아남아 사라진 컴포넌트에 setState를 걸고,
     * 예약된 프레임은 죽은 ref를 다시 읽는다.
     */
    it('unmount하면 관찰과 예약된 프레임을 모두 정리한다', () => {
        const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');
        const { unmount } = render(makeChart([110]), makeContainer(246));

        expect(mockDisconnect).not.toHaveBeenCalled();
        unmount();

        expect(mockDisconnect).toHaveBeenCalled();
        expect(cancelSpy).toHaveBeenCalled();
        cancelSpy.mockRestore();
    });
});
