import type { CalendarImpact } from '@y0ngha/siglens-core';
import type { CalendarGridEvent } from '@/widgets/economy/model/calendarTypes';
import {
    groupEventsByKstDay,
    pickDefaultDateKey,
} from '@/widgets/economy/utils/calendarGrouping';

const ev = (
    date: string,
    impact: CalendarImpact = 'High',
    event = `E ${date}`
): CalendarGridEvent => ({
    date,
    event,
    impact,
    actual: null,
    estimate: 1,
    previous: 1,
    unit: '%',
});

const HIGH_MEDIUM: ReadonlySet<CalendarImpact> = new Set(['High', 'Medium']);

describe('groupEventsByKstDay', () => {
    it('KST 날짜로 묶고 날짜순·시각순으로 정렬하며 두 시각 표기를 함께 채운다', () => {
        const groups = groupEventsByKstDay(
            [
                ev('2026-06-20 12:00:00', 'High', 'late'),
                ev('2026-06-18 08:30:00'),
                ev('2026-06-20 01:00:00', 'High', 'early'),
            ],
            'ko'
        );
        expect(groups.map(g => g.dateKey)).toEqual([
            '2026-06-18',
            '2026-06-20',
        ]);
        expect(groups[1].events.map(e => e.original.event)).toEqual([
            'early',
            'late',
        ]);
        expect(groups[1].events[0].kstTimeLabel).toMatch(/오전|오후/);
        expect(groups[1].events[0].inlineTimeLabel).not.toMatch(/오전|오후/);
    });
});

describe('pickDefaultDateKey', () => {
    const groups = groupEventsByKstDay(
        [
            ev('2026-06-18 08:30:00'),
            ev('2026-06-20 01:00:00', 'Low'),
            ev('2026-06-22 01:00:00'),
        ],
        'ko'
    );

    // 기본으로 꺼진 Low만 있는 날을 고르면 목록이 빈 패널이 열린다.
    it('활성 중요도 이벤트가 있는 날을 먼저 고른다', () => {
        expect(pickDefaultDateKey(groups, '2026-06-20', HIGH_MEDIUM)).toBe(
            '2026-06-22'
        );
    });

    it('활성 중요도 이벤트가 어디에도 없으면 전체에서 고른다', () => {
        expect(pickDefaultDateKey(groups, '2026-06-20', new Set())).toBe(
            '2026-06-20'
        );
    });

    it('미래가 없으면 가장 이른 날, 그룹이 없으면 빈 키', () => {
        expect(pickDefaultDateKey(groups, '2026-07-01', HIGH_MEDIUM)).toBe(
            '2026-06-18'
        );
        expect(pickDefaultDateKey([], '2026-07-01', HIGH_MEDIUM)).toBe('');
    });
});
