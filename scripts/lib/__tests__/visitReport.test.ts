import { describe, expect, it } from 'vitest';
import {
    NO_SOURCE_LABEL,
    UNKNOWN_SITE_LABEL,
    UNSETTLED,
    pivotEntrySources,
    pivotVisitDays,
    returnRateRows,
} from '../visitReport';

describe('pivotEntrySources', () => {
    const rows = [
        {
            site: 'main',
            entrySource: 'google',
            count: 10,
            newVisitors: 6,
            returning: 2,
        },
        {
            site: 'ai',
            entrySource: 'google',
            count: 4,
            newVisitors: 1,
            returning: 3,
        },
        {
            site: null,
            entrySource: 'google',
            count: 6,
            newVisitors: 0,
            returning: 0,
        },
        {
            site: 'main',
            entrySource: null,
            count: 30,
            newVisitors: 5,
            returning: 5,
        },
        {
            site: 'main',
            entrySource: 'paid',
            count: 3,
            newVisitors: 3,
            returning: 0,
        },
    ];

    it('출처 한 줄로 접고 사이트 열과 합계를 채운다', () => {
        const google = pivotEntrySources(rows).find(r => r.source === 'google');
        expect(google).toMatchObject({
            main: 10,
            ai: 4,
            unknown: 6,
            total: 20,
        });
    });

    it('합계가 큰 출처가 먼저고 출처 없음은 (없음) 줄이다', () => {
        expect(pivotEntrySources(rows).map(r => r.source)).toEqual([
            NO_SOURCE_LABEL,
            'google',
            'paid',
        ]);
    });

    it('재방문 비율은 구간값이 있는 행만 분모로 센다', () => {
        const byName = new Map(
            pivotEntrySources(rows).map(r => [r.source, r.returningShare])
        );
        // google: 재방문 5 / (새 7 + 재방문 5)
        expect(byName.get('google')).toBe('41.7%');
        expect(byName.get('paid')).toBe('0.0%');
        expect(byName.get(NO_SOURCE_LABEL)).toBe('50.0%');
    });

    it('구간값이 있는 행이 없으면 비율은 -이다', () => {
        const only = [
            {
                site: null,
                entrySource: 'x',
                count: 2,
                newVisitors: 0,
                returning: 0,
            },
        ];
        expect(pivotEntrySources(only)[0]?.returningShare).toBe('-');
    });

    it('같은 합계는 이름순이다', () => {
        const tie = [
            {
                site: 'main',
                entrySource: 'naver',
                count: 1,
                newVisitors: 0,
                returning: 0,
            },
            {
                site: 'main',
                entrySource: 'bing',
                count: 1,
                newVisitors: 0,
                returning: 0,
            },
        ];
        expect(pivotEntrySources(tie).map(r => r.source)).toEqual([
            'bing',
            'naver',
        ]);
    });

    it('행이 없으면 빈 배열이다', () => {
        expect(pivotEntrySources([])).toEqual([]);
    });
});

describe('pivotVisitDays', () => {
    it('사이트별로 접고 n1 비중을 계산하며 미상은 마지막이다', () => {
        const result = pivotVisitDays([
            { site: null, bucket: 'n1', count: 4 },
            { site: 'main', bucket: 'n1', count: 3 },
            { site: 'main', bucket: 'n2', count: 1 },
            { site: 'ai', bucket: 'n1', count: 1 },
        ]);
        expect(result.map(r => r.site)).toEqual([
            'ai',
            'main',
            UNKNOWN_SITE_LABEL,
        ]);
        const main = result.find(r => r.site === 'main');
        expect(main).toMatchObject({ total: 4, n1Share: '75.0%' });
        expect(main?.buckets.get('n2')).toBe(1);
    });
});

describe('returnRateRows', () => {
    const range = { from: '2026-09-01', to: '2026-09-07' };
    const rows = [
        { site: 'main', newVisitors: 100, d1: 20, d7: 10, d30: 5 },
        { site: null, newVisitors: 0, d1: 0, d7: 0, d30: 0 },
    ];

    it('세 창이 모두 닫혔으면 건수와 비율을 낸다', () => {
        // to(09-07) + 36일 = 10-13 < 10-14
        expect(returnRateRows(rows, range, '2026-10-14')[0]).toEqual({
            site: 'main',
            newVisitors: '100',
            d1: '20',
            d1Rate: '20.0%',
            d7: '10',
            d7Rate: '10.0%',
            d30: '5',
            d30Rate: '5.0%',
        });
    });

    it('창 끝이 오늘이면 아직 닫히지 않은 것이다(창 끝 < 오늘)', () => {
        const [row] = returnRateRows(rows, range, '2026-10-13');
        expect(row).toMatchObject({ d1Rate: '20.0%', d7Rate: '10.0%' });
        expect(row?.d30).toBe(UNSETTLED);
        expect(row?.d30Rate).toBe(UNSETTLED);
    });

    it('D1만 닫혔으면 D7·D30은 미확정이다', () => {
        // to + 1 = 09-08 < 09-09
        const [row] = returnRateRows(rows, range, '2026-09-09');
        expect(row?.d1Rate).toBe('20.0%');
        expect(row?.d7).toBe(UNSETTLED);
        expect(row?.d30).toBe(UNSETTLED);
    });

    it('아무 창도 닫히지 않았으면 모두 미확정이다', () => {
        const [row] = returnRateRows(rows, range, '2026-09-08');
        expect(row).toMatchObject({
            d1: UNSETTLED,
            d7: UNSETTLED,
            d30: UNSETTLED,
        });
    });

    it('새 방문이 0이면 비율은 -이고 사이트 미상은 (미상)이다', () => {
        const row = returnRateRows(rows, range, '2026-10-14')[1];
        expect(row).toMatchObject({
            site: UNKNOWN_SITE_LABEL,
            d1Rate: '-',
            d7Rate: '-',
            d30Rate: '-',
        });
    });
});
