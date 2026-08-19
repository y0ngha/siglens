import { normalizeCalendarForCountry } from '../normalizeCalendarForCountry';

const RAW = [
    {
        date: '2026-08-03 00:00:00',
        country: 'KR',
        event: 'Inflation Rate YoY (Jul)',
        impact: 'Medium',
        actual: 2.8,
        estimate: 2.7,
        previous: 3.2,
        unit: '%',
    },
    {
        date: '2026-08-01 12:30:00',
        country: 'US',
        event: 'Nonfarm Payrolls (Jul)',
        impact: 'High',
        actual: 150,
        estimate: 140,
        previous: 130,
        unit: 'K',
    },
    {
        date: '2026-08-11 00:00:00',
        country: 'KR',
        event: 'Unemployment Rate (Jul)',
        impact: 'Medium',
        actual: null,
        estimate: 2.9,
        previous: 2.7,
        unit: '%',
    },
];

describe('normalizeCalendarForCountry', () => {
    it('keeps only the requested country', () => {
        // core `normalizeEconomicCalendar`가 `country === 'US'`를 하드코딩해서
        // 한국 이벤트를 받으려면 이 함수가 필요하다.
        const kr = normalizeCalendarForCountry(RAW, 'KR');
        expect(kr.map(e => e.event)).toEqual([
            'Inflation Rate YoY (Jul)',
            'Unemployment Rate (Jul)',
        ]);
    });

    it('sorts ascending by date', () => {
        const us = normalizeCalendarForCountry([...RAW].reverse(), 'US');
        const kr = normalizeCalendarForCountry([...RAW].reverse(), 'KR');
        expect(us).toHaveLength(1);
        expect(kr.map(e => e.date)).toEqual([
            '2026-08-03 00:00:00',
            '2026-08-11 00:00:00',
        ]);
    });

    it('keeps an unannounced value as null, never 0', () => {
        // `Number(null)`은 0이고 그건 유한수다 — 강제 변환하면 미발표 지표가
        // "0으로 발표됨"이 되어 화면에 실업률 0%가 뜬다.
        const [, unannounced] = normalizeCalendarForCountry(RAW, 'KR');
        expect(unannounced.actual).toBeNull();
    });

    it('falls back to Low for an unknown impact', () => {
        const [event] = normalizeCalendarForCountry(
            [{ ...RAW[0], impact: 'Catastrophic' }],
            'KR'
        );
        expect(event.impact).toBe('Low');
    });

    it('drops rows missing date or event', () => {
        const out = normalizeCalendarForCountry(
            [
                { ...RAW[0], date: '' },
                { ...RAW[0], event: '' },
                { ...RAW[0], date: 123 },
                RAW[0],
            ],
            'KR'
        );
        expect(out).toHaveLength(1);
    });

    it('returns an empty list for non-array input', () => {
        expect(normalizeCalendarForCountry(null, 'KR')).toEqual([]);
        expect(normalizeCalendarForCountry({ error: 'nope' }, 'KR')).toEqual(
            []
        );
        expect(normalizeCalendarForCountry('Premium plan', 'KR')).toEqual([]);
    });

    it('skips non-object entries without throwing', () => {
        expect(
            normalizeCalendarForCountry([null, 'x', 42, RAW[0]], 'KR')
        ).toHaveLength(1);
    });
});
