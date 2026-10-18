import { act, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChartPopoverPanel } from '../../ui/ChartPopoverPanel';

/** 트리거 rect를 테스트가 바꿀 수 있게 잡아 두는 하네스. */
const rect = { right: 300, bottom: 100 };

function Harness() {
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    return (
        <div data-testid="scroller">
            <button
                ref={el => {
                    triggerRef.current = el;
                    if (el)
                        el.getBoundingClientRect = () =>
                            ({
                                right: rect.right,
                                bottom: rect.bottom,
                            }) as DOMRect;
                }}
                type="button"
            >
                trigger
            </button>
            <ChartPopoverPanel
                triggerRef={triggerRef}
                panelRef={panelRef}
                id="p"
                label="패널"
                width={240}
            >
                <span>content</span>
            </ChartPopoverPanel>
        </div>
    );
}

function setViewport(width: number, height: number): void {
    Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: width,
    });
    Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: height,
    });
}

const panel = (): HTMLElement => screen.getByRole('group', { name: '패널' });

/** 이벤트 이름과 옵션으로 호출을 찾는다(인덱스에 기대지 않는다). */
const callsFor = (
    spy: ReturnType<typeof vi.spyOn>,
    name: string
): unknown[][] => spy.mock.calls.filter((call: unknown[]) => call[0] === name);

afterEach(() => {
    vi.restoreAllMocks();
    rect.right = 300;
    rect.bottom = 100;
});

describe('ChartPopoverPanel', () => {
    it('portals to body with the chart-popover marker and an inline fixed placement', () => {
        setViewport(1280, 900);
        render(<Harness />);
        expect(panel().parentElement).toBe(document.body);
        expect(panel()).toHaveAttribute('data-chart-popover');
        expect(panel().style.top).toBe('104px');
        expect(panel().style.left).toBe('60px');
        expect(panel().style.width).toBe('240px');
    });

    it('reserves the bottom safe-area inset in maxHeight', () => {
        setViewport(375, 400);
        render(<Harness />);
        // 400 - (100 + 4) - 8 = 288 에서 홈 인디케이터 영역을 더 뺀다.
        expect(panel().getAttribute('style')).toContain(
            'env(safe-area-inset-bottom'
        );
        expect(panel().getAttribute('style')).toContain('288px');
    });

    it('repositions on window resize', () => {
        setViewport(1280, 900);
        render(<Harness />);
        expect(panel().style.width).toBe('240px');
        act(() => {
            setViewport(200, 900);
            window.dispatchEvent(new Event('resize'));
        });
        // 뷰포트가 좁아지면 폭이 줄고(200 - 16) 왼쪽 여백 안으로 들어온다.
        expect(panel().style.width).toBe('184px');
        expect(panel().style.left).toBe('8px');
    });

    it('repositions on a scroll inside an ancestor (capture phase)', () => {
        setViewport(1280, 900);
        render(<Harness />);
        expect(panel().style.top).toBe('104px');
        act(() => {
            rect.bottom = 40;
            // scroll은 버블링하지 않는다 — window의 capture 리스너만 조상 스크롤을 잡는다.
            screen.getByTestId('scroller').dispatchEvent(new Event('scroll'));
        });
        expect(panel().style.top).toBe('44px');
    });

    it('registers scroll in the capture phase and removes both listeners with the same capture flag on unmount', () => {
        setViewport(1280, 900);
        const add = vi.spyOn(window, 'addEventListener');
        const remove = vi.spyOn(window, 'removeEventListener');
        const { unmount } = render(<Harness />);

        const addedScroll = callsFor(add, 'scroll');
        expect(addedScroll.some(([, , options]) => options === true)).toBe(
            true
        );
        expect(callsFor(add, 'resize')).not.toHaveLength(0);

        unmount();

        const removedScroll = callsFor(remove, 'scroll');
        expect(removedScroll.some(([, , options]) => options === true)).toBe(
            true
        );
        expect(callsFor(remove, 'resize')).not.toHaveLength(0);
        // 같은 핸들러를 같은 캡처 플래그로 뗀다.
        const addedHandler = addedScroll.find(
            ([, , options]) => options === true
        )?.[1];
        expect(
            removedScroll.some(
                ([, handler, options]) =>
                    handler === addedHandler && options === true
            )
        ).toBe(true);
    });

    it('removes the data-chart-popover marker from the body on unmount', () => {
        // globals.css의 `body:has([data-chart-popover])` 규칙이 배너·FAB을 숨긴다 —
        // 닫히면 표식이 사라져야 둘이 다시 보인다.
        setViewport(1280, 900);
        const { unmount } = render(<Harness />);
        expect(document.querySelector('[data-chart-popover]')).not.toBeNull();
        unmount();
        expect(document.querySelector('[data-chart-popover]')).toBeNull();
    });
});
