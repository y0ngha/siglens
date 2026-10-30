import { act, renderHook } from '@testing-library/react';
import type { CalendarImpact } from '@y0ngha/siglens-core';
import type { CalendarGridEvent } from '@/widgets/economy/model/calendarTypes';
import { useCalendarSelection } from '@/widgets/economy/hooks/useCalendarSelection';
import { groupEventsByKstDay } from '@/widgets/economy/utils/calendarGrouping';

const ev = (date: string): CalendarGridEvent => ({
    date: `${date} 08:30:00`,
    event: `E ${date}`,
    impact: 'High',
    actual: null,
    estimate: 1,
    previous: 1,
    unit: '%',
});

const GROUPS = groupEventsByKstDay(
    [ev('2026-06-09'), ev('2026-06-17'), ev('2026-06-18')],
    'ko'
);
const HIGH: ReadonlySet<CalendarImpact> = new Set(['High']);

describe('useCalendarSelection', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-06-17T03:00:00Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('묵은 today로 시작해도 갱신된 실제 오늘로 기본 선택을 다시 고른다', async () => {
        const { result } = renderHook(() =>
            useCalendarSelection({
                groups: GROUPS,
                today: '2026-06-09',
                activeImpacts: HIGH,
            })
        );
        await vi.waitFor(() =>
            expect(result.current.todayKey).toBe('2026-06-17')
        );
        expect(result.current.selectedDateKey).toBe('2026-06-17');
    });

    it('활성 중요도가 바뀌어도 사용자가 고른 날을 다시 고르지 않는다', async () => {
        const { result, rerender } = renderHook(
            ({ impacts }) =>
                useCalendarSelection({
                    groups: GROUPS,
                    today: '2026-06-17',
                    activeImpacts: impacts,
                }),
            { initialProps: { impacts: HIGH } }
        );
        await vi.waitFor(() =>
            expect(result.current.selectedDateKey).toBe('2026-06-17')
        );
        act(() => result.current.selectDate('2026-06-18'));
        rerender({ impacts: new Set<CalendarImpact>(['Low']) });
        expect(result.current.selectedDateKey).toBe('2026-06-18');
    });

    it('사용자가 고른 날만 그 패널로 스크롤한다', async () => {
        const panel = document.createElement('div');
        panel.id = 'panel-2026-06-18';
        panel.scrollIntoView = vi.fn();
        document.body.append(panel);
        const { result } = renderHook(() =>
            useCalendarSelection({
                groups: GROUPS,
                today: '2026-06-17',
                activeImpacts: HIGH,
            })
        );
        await vi.waitFor(() =>
            expect(result.current.selectedDateKey).toBe('2026-06-17')
        );
        expect(panel.scrollIntoView).not.toHaveBeenCalled();

        act(() => result.current.selectDate('2026-06-18'));
        expect(panel.scrollIntoView).toHaveBeenCalledTimes(1);
        panel.remove();
    });
});
