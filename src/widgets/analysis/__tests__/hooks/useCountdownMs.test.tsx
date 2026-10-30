// @vitest-environment jsdom
import { render, renderHook, act } from '@testing-library/react';
import { useLayoutEffect } from 'react';
import { useCountdownMs } from '@/widgets/analysis/hooks/useCountdownMs';

describe('useCountdownMs', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-27T00:00:00Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('when there is no end time', () => {
        it('returns 0 when there is no end time', () => {
            const { result } = renderHook(() => useCountdownMs(0));
            expect(result.current).toBe(0);
        });
    });

    describe('while counting down', () => {
        it('counts down once a second and stops at 0', () => {
            const until = Date.now() + 3000;
            const { result } = renderHook(() => useCountdownMs(until));
            expect(result.current).toBe(3000);

            act(() => {
                vi.advanceTimersByTime(1000);
            });
            expect(result.current).toBe(2000);

            act(() => {
                vi.advanceTimersByTime(5000);
            });
            expect(result.current).toBe(0);
            expect(vi.getTimerCount()).toBe(0);
        });

        it('restarts from a new end time while a countdown is running', () => {
            const first = Date.now() + 5000;
            const { result, rerender } = renderHook(
                ({ until }: { until: number }) => useCountdownMs(until),
                { initialProps: { until: first } }
            );
            act(() => {
                vi.advanceTimersByTime(1000);
            });
            expect(result.current).toBe(4000);

            const second = Date.now() + 30_000;
            rerender({ until: second });
            expect(result.current).toBe(30_000);
            // 이전 interval 은 정리되고 하나만 돈다.
            expect(vi.getTimerCount()).toBe(1);

            act(() => {
                vi.advanceTimersByTime(1000);
            });
            expect(result.current).toBe(29_000);
        });
    });

    describe('when the end time changes', () => {
        it('measures from the time the end time arrives, not from mount', () => {
            const { result, rerender } = renderHook(
                ({ until }: { until: number }) => useCountdownMs(until),
                { initialProps: { until: 0 } }
            );
            // 마운트 뒤 한참 지나 쿨다운이 생겨도 남은 시간이 그만큼 부풀지 않는다.
            act(() => {
                vi.advanceTimersByTime(60_000);
            });
            rerender({ until: Date.now() + 30_000 });
            expect(result.current).toBe(30_000);
        });

        it('keeps counting when the end time passes between render and effect', () => {
            // 렌더는 3ms 남은 값을 그렸는데, effect 가 돌기 전에(앞선 layout effect 동안) 시각이 지난 경우.
            // 시작 여부를 effect 에서 시계로 다시 판단하면 interval 이 없어 3ms 가 그대로 남는다.
            const until = Date.now() + 3;
            const seen: number[] = [];
            function Probe() {
                seen.push(useCountdownMs(until));
                return null;
            }
            function PassTime() {
                useLayoutEffect(() => {
                    vi.setSystemTime(until + 1);
                }, []);
                return null;
            }
            render(
                <>
                    <Probe />
                    <PassTime />
                </>
            );
            expect(seen.at(-1)).toBe(3);

            act(() => {
                vi.advanceTimersByTime(1000);
            });
            expect(seen.at(-1)).toBe(0);
            expect(vi.getTimerCount()).toBe(0);
        });
    });

    describe('on unmount', () => {
        it('clears its timer on unmount', () => {
            const until = Date.now() + 3000;
            const { unmount } = renderHook(() => useCountdownMs(until));
            expect(vi.getTimerCount()).toBe(1);
            unmount();
            expect(vi.getTimerCount()).toBe(0);
        });
    });
});
