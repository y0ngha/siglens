// @vitest-environment jsdom
/**
 * Unit tests for `useStrikeBarChart` — 공용 pointer 핸들러 훅.
 *
 * renderHook으로 마운트 후 포인터 이벤트 시뮬레이션을 통해
 * hoveredIndex / tooltipPos 상태 전환과 캐시 초기화를 검증한다.
 */
import { renderHook, act } from '@testing-library/react';
import type { PointerEvent } from 'react';
import { useStrikeBarChart } from '@/widgets/options/hooks/useStrikeBarChart';

vi.mock('@/widgets/options/utils/computeTooltipPos', () => ({
    computeTooltipPos: (_event: unknown, _rect: unknown) => ({ x: 100, y: 80 }),
}));

/** 최소 PointerEvent 형태 — 훅은 event를 computeTooltipPos에 그대로 전달하므로
 *  실제 필드 값은 mock이 처리한다. */
function makePointerEvent(): PointerEvent<SVGRectElement> {
    return {
        clientX: 200,
        clientY: 150,
    } as unknown as PointerEvent<SVGRectElement>;
}

/** containerRef.current에 할당할 최소 HTMLDivElement 스텁. */
function makeContainerDiv(): HTMLDivElement {
    const div = document.createElement('div');
    // getBoundingClientRect 스텁 — jsdom은 레이아웃을 계산하지 않아 기본값이 0이지만
    // 명시적 스텁으로 의도를 분명히 한다.
    div.getBoundingClientRect = () =>
        ({
            left: 0,
            top: 0,
            width: 600,
            height: 240,
        }) as DOMRect;
    return div;
}

describe('useStrikeBarChart', () => {
    it('초기 상태: hoveredIndex와 tooltipPos가 모두 null이다', () => {
        const { result } = renderHook(() => useStrikeBarChart());
        expect(result.current.hoveredIndex).toBeNull();
        expect(result.current.tooltipPos).toBeNull();
    });

    describe('handlePointerEnter', () => {
        it('containerRef.current가 null이면 상태를 변경하지 않는다 (early return)', () => {
            const { result } = renderHook(() => useStrikeBarChart());
            // containerRef.current는 기본적으로 null이므로 별도 설정 불필요.
            act(() => {
                result.current.handlePointerEnter(makePointerEvent(), 2);
            });
            expect(result.current.hoveredIndex).toBeNull();
            expect(result.current.tooltipPos).toBeNull();
        });

        it('containerRef.current가 있으면 hoveredIndex와 tooltipPos를 업데이트한다', () => {
            const { result } = renderHook(() => useStrikeBarChart());
            // containerRef에 div 주입
            Object.defineProperty(result.current.containerRef, 'current', {
                value: makeContainerDiv(),
                writable: true,
            });
            act(() => {
                result.current.handlePointerEnter(makePointerEvent(), 3);
            });
            expect(result.current.hoveredIndex).toBe(3);
            expect(result.current.tooltipPos).toEqual({ x: 100, y: 80 });
        });
    });

    describe('handlePointerMove', () => {
        it('cachedRectRef가 null이고 containerRef도 null이면 상태 변경 없음', () => {
            const { result } = renderHook(() => useStrikeBarChart());
            act(() => {
                result.current.handlePointerMove(makePointerEvent(), 1);
            });
            expect(result.current.hoveredIndex).toBeNull();
            expect(result.current.tooltipPos).toBeNull();
        });

        it('enter 후 move는 캐시된 rect를 사용해 tooltipPos를 업데이트한다', () => {
            const { result } = renderHook(() => useStrikeBarChart());
            Object.defineProperty(result.current.containerRef, 'current', {
                value: makeContainerDiv(),
                writable: true,
            });
            // enter로 캐시 생성
            act(() => {
                result.current.handlePointerEnter(makePointerEvent(), 0);
            });
            // move — 캐시 경로
            act(() => {
                result.current.handlePointerMove(makePointerEvent(), 1);
            });
            expect(result.current.hoveredIndex).toBe(1);
            expect(result.current.tooltipPos).toEqual({ x: 100, y: 80 });
        });

        it('enter 없이 move가 먼저 발사되면(모바일 경로) containerRef로 한 번 측정한다', () => {
            const { result } = renderHook(() => useStrikeBarChart());
            Object.defineProperty(result.current.containerRef, 'current', {
                value: makeContainerDiv(),
                writable: true,
            });
            // cachedRectRef는 null인 채로 move만 호출
            act(() => {
                result.current.handlePointerMove(makePointerEvent(), 2);
            });
            expect(result.current.hoveredIndex).toBe(2);
            expect(result.current.tooltipPos).toEqual({ x: 100, y: 80 });
        });
    });

    describe('handlePointerLeave', () => {
        it('leave 시 hoveredIndex·tooltipPos가 null로 초기화된다', () => {
            const { result } = renderHook(() => useStrikeBarChart());
            Object.defineProperty(result.current.containerRef, 'current', {
                value: makeContainerDiv(),
                writable: true,
            });
            // 먼저 enter로 상태 설정
            act(() => {
                result.current.handlePointerEnter(makePointerEvent(), 5);
            });
            expect(result.current.hoveredIndex).toBe(5);
            // leave로 초기화
            act(() => {
                result.current.handlePointerLeave();
            });
            expect(result.current.hoveredIndex).toBeNull();
            expect(result.current.tooltipPos).toBeNull();
        });

        it('leave 후 move가 발사되면 cachedRectRef가 초기화됐으므로 containerRef 경유 경로로 처리된다', () => {
            const { result } = renderHook(() => useStrikeBarChart());
            Object.defineProperty(result.current.containerRef, 'current', {
                value: makeContainerDiv(),
                writable: true,
            });
            act(() => {
                result.current.handlePointerEnter(makePointerEvent(), 0);
            });
            act(() => {
                result.current.handlePointerLeave();
            });
            // cachedRectRef가 null이므로 containerRef 경유 경로 실행
            act(() => {
                result.current.handlePointerMove(makePointerEvent(), 4);
            });
            expect(result.current.hoveredIndex).toBe(4);
            expect(result.current.tooltipPos).toEqual({ x: 100, y: 80 });
        });
    });
});
