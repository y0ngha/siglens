import type { CalendarGridEvent } from '@/widgets/economy/model/calendarTypes';
import { buildValueParts } from '@/widgets/economy/utils/calendarValueParts';

const t = (key: string, values: { v0: string }) =>
    `${key.split('.')[1]}:${values.v0}`;

const ev = (patch: Partial<CalendarGridEvent>): CalendarGridEvent =>
    ({
        date: '2026-06-20 08:30:00',
        event: 'CPI',
        impact: 'High',
        actual: null,
        estimate: null,
        previous: null,
        unit: '',
        ...patch,
    }) as CalendarGridEvent;

describe('buildValueParts', () => {
    it('유한수인 조각만 예상·이전·실제 순으로 낸다', () => {
        expect(
            buildValueParts(
                ev({ estimate: 1, previous: 2, actual: 3 }),
                t,
                'en'
            )
        ).toEqual(['forecastPart:1', 'previousPart:2', 'actualPart:3']);
        expect(buildValueParts(ev({ previous: Number.NaN }), t, 'en')).toEqual(
            []
        );
    });

    it('기준값이 없는데 실제가 0이면 자리표시값으로 보고 뺀다', () => {
        expect(buildValueParts(ev({ actual: 0 }), t, 'en')).toEqual([]);
    });

    it('기준값이 있으면 실제 0도 싣는다', () => {
        expect(
            buildValueParts(ev({ previous: 1, actual: 0 }), t, 'en')
        ).toEqual(['previousPart:1', 'actualPart:0']);
    });
});
