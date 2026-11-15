import { AGENT_FILINGS_WINDOW_DAYS } from '@y0ngha/siglens-core';
import { describe, expect, it } from 'vitest';
import {
    easternIsoDate,
    hasRecentFilings,
    parseSubmissions,
} from '../parseSubmissions';

const NOW_WINTER = new Date('2026-11-16T03:00:00Z'); // 22:00 EST, 11-15 in New York
const NOW_SUMMER = new Date('2026-07-15T02:00:00Z'); // 22:00 EDT, 07-14 in New York

function recent(
    rows: {
        form: string;
        date: string;
        accession: string;
        primary?: string;
        items?: string;
    }[]
) {
    return {
        filings: {
            recent: {
                form: rows.map(r => r.form),
                filingDate: rows.map(r => r.date),
                accessionNumber: rows.map(r => r.accession),
                primaryDocument: rows.map(r => r.primary ?? 'doc.htm'),
                items: rows.map(r => r.items ?? ''),
            },
        },
    };
}

describe('parseSubmissions', () => {
    it('IonQ 모양: 8-K만 남기고 항목 라벨을 붙이며 9.01은 뺀다', () => {
        const json = recent([
            {
                form: '8-K',
                date: '2026-11-13',
                accession: '0001193125-26-461016',
                primary: 'ionq-20261110.htm',
                items: '3.02,5.02,8.01,9.01',
            },
            {
                form: '4',
                date: '2026-11-12',
                accession: '0001234567-26-000001',
            },
            {
                form: '8-K',
                date: '2026-11-05',
                accession: '0001193125-26-450000',
                primary: 'ionq-20261105.htm',
                items: '2.01,2.02,3.02,7.01,9.01',
            },
            {
                form: '424B5',
                date: '2026-11-04',
                accession: '0001234567-26-000002',
            },
        ]);
        const rows = parseSubmissions(json, NOW_WINTER);
        expect(rows.map(r => [r.accession, r.form, r.filedAt])).toEqual([
            ['0001193125-26-461016', '8-K', '2026-11-13'],
            ['0001193125-26-450000', '8-K', '2026-11-05'],
        ]);
        expect(rows[0].primaryDocument).toBe('ionq-20261110.htm');
        expect(rows[0].items.map(i => i.code)).toEqual([
            '3.02',
            '5.02',
            '8.01',
        ]);
    });

    it('해외 발행인: 6-K는 항목 없이 남는다', () => {
        const rows = parseSubmissions(
            recent([
                {
                    form: '6-K',
                    date: '2026-10-27',
                    accession: '0001213900-26-120000',
                    primary: 'ea0309878-6k_sealsq.htm',
                    items: '',
                },
            ]),
            NOW_WINTER
        );
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ form: '6-K', items: [] });
    });

    it('8-K/A도 남긴다', () => {
        const rows = parseSubmissions(
            recent([
                {
                    form: '8-K/A',
                    date: '2026-11-10',
                    accession: '0001193125-26-440000',
                    items: '5.02',
                },
            ]),
            NOW_WINTER
        );
        expect(rows.map(r => r.form)).toEqual(['8-K/A']);
    });

    it('최신순으로 정렬한다(제출 목록이 뒤섞여 와도)', () => {
        const rows = parseSubmissions(
            recent([
                {
                    form: '8-K',
                    date: '2026-10-01',
                    accession: '0000000001-26-000001',
                },
                {
                    form: '8-K',
                    date: '2026-11-01',
                    accession: '0000000001-26-000002',
                },
                {
                    form: '8-K',
                    date: '2026-10-15',
                    accession: '0000000001-26-000003',
                },
            ]),
            NOW_WINTER
        );
        expect(rows.map(r => r.filedAt)).toEqual([
            '2026-11-01',
            '2026-10-15',
            '2026-10-01',
        ]);
    });

    it(`창은 ${AGENT_FILINGS_WINDOW_DAYS}일: 겨울 — 경계일은 포함, 하루 전은 제외(UTC 날짜가 아니라 동부 날짜 기준)`, () => {
        // NOW_WINTER의 UTC 날짜는 11-16이지만 동부는 11-15다. 동부 기준 경계는 07-18.
        const rows = parseSubmissions(
            recent([
                {
                    form: '8-K',
                    date: '2026-07-18',
                    accession: '0000000001-26-000001',
                },
                {
                    form: '8-K',
                    date: '2026-07-17',
                    accession: '0000000001-26-000002',
                },
            ]),
            NOW_WINTER
        );
        expect(rows.map(r => r.filedAt)).toEqual(['2026-07-18']);
    });

    it(`창은 ${AGENT_FILINGS_WINDOW_DAYS}일: 서머타임 — 경계일은 포함, 하루 전은 제외`, () => {
        // NOW_SUMMER의 UTC 날짜는 07-15지만 동부(EDT)는 07-14다. 동부 기준 경계는 03-16.
        // UTC 날짜를 쓰면 경계가 03-17로 밀려 03-16 행이 사라진다.
        const rows = parseSubmissions(
            recent([
                {
                    form: '8-K',
                    date: '2026-03-16',
                    accession: '0000000001-26-000001',
                },
                {
                    form: '8-K',
                    date: '2026-03-15',
                    accession: '0000000001-26-000002',
                },
            ]),
            NOW_SUMMER
        );
        expect(rows.map(r => r.filedAt)).toEqual(['2026-03-16']);
    });

    it('모양이 어긋난 행은 던지지 않고 건너뛴다', () => {
        const json = {
            filings: {
                recent: {
                    form: ['8-K', '8-K', '8-K', '8-K', 7, '8-K'],
                    filingDate: [
                        '2026-11-13',
                        'not-a-date',
                        '2026-11-12',
                        '2026-11-11',
                        '2026-11-10',
                        '2026-11-09',
                    ],
                    accessionNumber: [
                        '0001193125-26-461016',
                        '0001193125-26-461017',
                        'garbage',
                        '0001193125-26-461019',
                        '0001193125-26-461020',
                        '000119312526461021',
                    ],
                    primaryDocument: [
                        'a.htm',
                        'b.htm',
                        'c.htm',
                        '',
                        'e.htm',
                        'f.htm',
                    ],
                    items: ['5.02', '5.02', '5.02', '5.02', '5.02', null],
                },
            },
        };
        const rows = parseSubmissions(json, NOW_WINTER);
        // 0번(정상)과 5번(대시 없는 접수번호 → 정규화, items가 null → 빈 항목)만 남는다.
        expect(rows.map(r => r.accession)).toEqual([
            '0001193125-26-461016',
            '0001193125-26-461021',
        ]);
        expect(rows[1].items).toEqual([]);
    });

    it.each([
        null,
        undefined,
        'x',
        3,
        [],
        {},
        { filings: null },
        { filings: { recent: [] } },
    ])('알 수 없는 JSON(%j)은 빈 목록이다', json => {
        expect(parseSubmissions(json, NOW_WINTER)).toEqual([]);
    });

    it('열 하나가 빠져도 던지지 않는다', () => {
        const json = {
            filings: { recent: { form: ['8-K'], filingDate: ['2026-11-13'] } },
        };
        expect(parseSubmissions(json, NOW_WINTER)).toEqual([]);
    });
});

describe('hasRecentFilings', () => {
    it('filings.recent 객체가 있어야 참이다', () => {
        expect(hasRecentFilings({ filings: { recent: {} } })).toBe(true);
        expect(hasRecentFilings({ filings: {} })).toBe(false);
        expect(hasRecentFilings(null)).toBe(false);
    });
});

describe('easternIsoDate', () => {
    it('겨울과 여름 모두 동부 달력 날짜를 돌려준다', () => {
        expect(easternIsoDate(new Date('2026-01-15T04:59:00Z'))).toBe(
            '2026-01-14'
        );
        expect(easternIsoDate(new Date('2026-01-15T05:00:00Z'))).toBe(
            '2026-01-15'
        );
        expect(easternIsoDate(new Date('2026-07-15T03:59:00Z'))).toBe(
            '2026-07-14'
        );
        expect(easternIsoDate(new Date('2026-07-15T04:00:00Z'))).toBe(
            '2026-07-15'
        );
    });
});
