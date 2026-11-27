import { renderHook, act } from '@testing-library/react';
import type React from 'react';
import {
    usePanelResize,
    PANEL_MIN_WIDTH,
    PANEL_MAX_WIDTH,
    resolvePanelMaxWidth,
} from '@/views/symbol/hooks/usePanelResize';

describe('usePanelResize', () => {
    // 드래그 반영은 프레임당 한 번이다(`useDragListener`) — 각 mousemove 뒤에 프레임을 넘긴다.
    beforeEach(() => {
        vi.useFakeTimers({
            toFake: ['requestAnimationFrame', 'cancelAnimationFrame'],
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('defaults panelWidth to PANEL_MAX_WIDTH', () => {
        const { result } = renderHook(() => usePanelResize());
        expect(result.current.panelWidth).toBe(PANEL_MAX_WIDTH);
    });

    it('defaults isDragging to false', () => {
        const { result } = renderHook(() => usePanelResize());
        expect(result.current.isDragging).toBe(false);
    });

    it('shrinks panel when dragged rightward (positive deltaX)', () => {
        const { result } = renderHook(() => usePanelResize());

        act(() => {
            result.current.handleDragStart({
                button: 0,
                clientX: 500,
                preventDefault: vi.fn(),
            } as unknown as React.MouseEvent);
        });

        act(() => {
            document.dispatchEvent(
                new MouseEvent('mousemove', { clientX: 600 })
            );
        });
        act(() => {
            vi.advanceTimersToNextFrame();
        });

        // deltaX = 600 - 500 = 100, panelWidth = 640 - 100 = 540
        expect(result.current.panelWidth).toBe(PANEL_MAX_WIDTH - 100);
    });

    it('clamps panel width to minimum', () => {
        const { result } = renderHook(() => usePanelResize());

        act(() => {
            result.current.handleDragStart({
                button: 0,
                clientX: 100,
                preventDefault: vi.fn(),
            } as unknown as React.MouseEvent);
        });

        act(() => {
            document.dispatchEvent(
                new MouseEvent('mousemove', { clientX: 2000 })
            );
        });
        act(() => {
            vi.advanceTimersToNextFrame();
        });

        expect(result.current.panelWidth).toBe(PANEL_MIN_WIDTH);
    });

    it('clamps panel width to maximum', () => {
        const { result } = renderHook(() => usePanelResize());

        act(() => {
            result.current.handleDragStart({
                button: 0,
                clientX: 500,
                preventDefault: vi.fn(),
            } as unknown as React.MouseEvent);
        });

        act(() => {
            document.dispatchEvent(
                new MouseEvent('mousemove', { clientX: -2000 })
            );
        });
        act(() => {
            vi.advanceTimersToNextFrame();
        });

        expect(result.current.panelWidth).toBe(PANEL_MAX_WIDTH);
    });

    it('폭이 최대에 걸려 그대로면 드래그 프레임이 와도 다시 렌더하지 않는다', () => {
        let renders = 0;
        const { result } = renderHook(() => {
            renders += 1;
            return usePanelResize();
        });
        act(() => {
            result.current.handleDragStart({
                button: 0,
                clientX: 500,
                preventDefault: vi.fn(),
            } as unknown as React.MouseEvent);
        });
        const rendersAfterDragStart = renders;

        for (const clientX of [400, 300, 200]) {
            act(() => {
                document.dispatchEvent(
                    new MouseEvent('mousemove', { clientX })
                );
            });
            act(() => {
                vi.advanceTimersToNextFrame();
            });
        }

        expect(result.current.panelWidth).toBe(PANEL_MAX_WIDTH);
        expect(renders).toBe(rendersAfterDragStart);
    });

    it('handles ArrowLeft to shrink panel', () => {
        const { result } = renderHook(() => usePanelResize());

        act(() => {
            result.current.handleKeyDown({
                key: 'ArrowLeft',
                preventDefault: vi.fn(),
            } as unknown as React.KeyboardEvent);
        });

        expect(result.current.panelWidth).toBe(PANEL_MAX_WIDTH - 10);
    });

    it('handles ArrowRight to grow panel', () => {
        const { result } = renderHook(() => usePanelResize());

        act(() => {
            result.current.handleKeyDown({
                key: 'ArrowLeft',
                preventDefault: vi.fn(),
            } as unknown as React.KeyboardEvent);
        });

        act(() => {
            result.current.handleKeyDown({
                key: 'ArrowRight',
                preventDefault: vi.fn(),
            } as unknown as React.KeyboardEvent);
        });

        expect(result.current.panelWidth).toBe(PANEL_MAX_WIDTH);
    });

    it('ignores non-arrow keys', () => {
        const { result } = renderHook(() => usePanelResize());
        const preventDefault = vi.fn();

        act(() => {
            result.current.handleKeyDown({
                key: 'Enter',
                preventDefault,
            } as unknown as React.KeyboardEvent);
        });

        expect(result.current.panelWidth).toBe(PANEL_MAX_WIDTH);
        expect(preventDefault).not.toHaveBeenCalled();
    });

    it('PANEL_MIN_WIDTH is less than PANEL_MAX_WIDTH', () => {
        expect(PANEL_MIN_WIDTH).toBeLessThan(PANEL_MAX_WIDTH);
    });

    describe('태블릿 폭 상한(차트 열 55% 보장)', () => {
        const originalInnerWidth = window.innerWidth;
        const setViewport = (width: number): void => {
            Object.defineProperty(window, 'innerWidth', {
                configurable: true,
                value: width,
            });
        };
        afterEach(() => setViewport(originalInnerWidth));

        it('resolvePanelMaxWidth: xl 미만에서는 행의 45%에서 핸들 폭을 뺀 값', () => {
            expect(resolvePanelMaxWidth(820, 820)).toBe(365);
        });

        it('resolvePanelMaxWidth: xl 이상이거나 행 폭을 모르면 PANEL_MAX_WIDTH', () => {
            expect(resolvePanelMaxWidth(820, 1280)).toBe(PANEL_MAX_WIDTH);
            expect(resolvePanelMaxWidth(null, 820)).toBe(PANEL_MAX_WIDTH);
            expect(resolvePanelMaxWidth(0, 820)).toBe(PANEL_MAX_WIDTH);
        });

        it('resolvePanelMaxWidth: 아주 좁아도 PANEL_MIN_WIDTH 아래로 내려가지 않고, 넓은 행에서는 PANEL_MAX_WIDTH를 넘지 않는다', () => {
            expect(resolvePanelMaxWidth(300, 768)).toBe(PANEL_MIN_WIDTH);
            expect(resolvePanelMaxWidth(1600, 1000)).toBe(PANEL_MAX_WIDTH);
        });

        it('키보드로 넓혀도 상한을 넘지 않고, 줄일 때는 보이는 폭에서 출발한다', () => {
            setViewport(820);
            const { result } = renderHook(() => usePanelResize(() => 820));
            const key = (k: string): void =>
                act(() => {
                    result.current.handleKeyDown({
                        key: k,
                        preventDefault: vi.fn(),
                    } as unknown as React.KeyboardEvent);
                });

            key('ArrowRight');
            expect(result.current.panelWidth).toBe(365);
            key('ArrowLeft');
            expect(result.current.panelWidth).toBe(355);
        });

        it('구분선 값(valuenow·valuemax)은 그려지는 폭과 같고, 창 크기가 바뀌면 갱신된다', () => {
            setViewport(820);
            const row = { width: 820 };
            const { result } = renderHook(() =>
                usePanelResize(() => row.width)
            );

            expect(result.current.panelMaxWidth).toBe(365);
            expect(result.current.displayWidth).toBe(365);
            // 저장된 폭(640)은 그대로 두고 표시 폭만 깎인다.
            expect(result.current.panelWidth).toBe(PANEL_MAX_WIDTH);

            row.width = 1000;
            setViewport(1000);
            act(() => {
                window.dispatchEvent(new Event('resize'));
            });

            expect(result.current.panelMaxWidth).toBe(446);
            expect(result.current.displayWidth).toBe(446);
        });

        it('xl 이상에서는 기존 값(640)을 그대로 보고한다', () => {
            setViewport(1440);
            const { result } = renderHook(() => usePanelResize(() => 1400));

            expect(result.current.panelMaxWidth).toBe(PANEL_MAX_WIDTH);
            expect(result.current.displayWidth).toBe(PANEL_MAX_WIDTH);
        });

        it('드래그로 왼쪽으로 끌어도 상한을 넘지 않는다', () => {
            setViewport(820);
            const { result } = renderHook(() => usePanelResize(() => 820));

            act(() => {
                result.current.handleDragStart({
                    button: 0,
                    clientX: 500,
                    preventDefault: vi.fn(),
                } as unknown as React.MouseEvent);
            });
            act(() => {
                document.dispatchEvent(
                    new MouseEvent('mousemove', { clientX: 100 })
                );
            });
            act(() => {
                vi.advanceTimersToNextFrame();
            });

            expect(result.current.panelWidth).toBe(365);
        });

        it('드래그는 깎여 보이는 폭에서 출발한다(오른쪽으로 20px → 345)', () => {
            setViewport(820);
            const { result } = renderHook(() => usePanelResize(() => 820));

            act(() => {
                result.current.handleDragStart({
                    button: 0,
                    clientX: 500,
                    preventDefault: vi.fn(),
                } as unknown as React.MouseEvent);
            });
            act(() => {
                document.dispatchEvent(
                    new MouseEvent('mousemove', { clientX: 520 })
                );
            });
            act(() => {
                vi.advanceTimersToNextFrame();
            });

            expect(result.current.panelWidth).toBe(345);
        });
    });
});
