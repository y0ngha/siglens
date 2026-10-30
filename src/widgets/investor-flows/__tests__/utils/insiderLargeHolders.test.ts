import { describe, expect, it } from 'vitest';
import {
    buildInsiderTable,
    MAX_INSIDER_ROWS,
    shortRole,
} from '../../utils/insider';
import {
    buildLargeHolderRows,
    largeHolderKind,
    MAX_LARGE_HOLDER_ROWS,
} from '../../utils/largeHolders';
import { makeLargeHolder, makeTransaction } from '../fixtures/flowsFixtures';

describe('buildInsiderTable', () => {
    it('buy·sell만 최신순으로 싣고 other는 건수로만 센다', () => {
        const table = buildInsiderTable([
            makeTransaction({ date: '2026-10-01' }),
            makeTransaction({ date: '2026-10-09', type: 'sell' }),
            makeTransaction({ date: '2026-10-05', type: 'other' }),
        ]);
        expect(table.rows.map(r => r.date)).toEqual([
            '2026-10-09',
            '2026-10-01',
        ]);
        expect(table.omittedOtherCount).toBe(1);
    });

    it('MAX_INSIDER_ROWS로 자른다', () => {
        const many = Array.from({ length: MAX_INSIDER_ROWS + 5 }, (_, i) =>
            makeTransaction({
                date: `2026-09-${String((i % 28) + 1).padStart(2, '0')}`,
            })
        );
        expect(buildInsiderTable(many).rows).toHaveLength(MAX_INSIDER_ROWS);
    });

    it('상한 밖으로 빠진 매수·매도 건수를 omittedCount로 알린다(other는 포함하지 않는다)', () => {
        const traded = Array.from({ length: MAX_INSIDER_ROWS + 5 }, (_, i) =>
            makeTransaction({
                date: `2026-09-${String((i % 28) + 1).padStart(2, '0')}`,
            })
        );
        const table = buildInsiderTable([
            ...traded,
            makeTransaction({ date: '2026-09-30', type: 'other' }),
        ]);
        expect(table.omittedCount).toBe(5);
        expect(table.omittedOtherCount).toBe(1);
        expect(buildInsiderTable(traded.slice(0, 3)).omittedCount).toBe(0);
    });

    it('상한은 창과 무관하게 최신 거래일 순으로 먼저 자른다 — 가장 오래된 거래가 빠진다', () => {
        const window = { days: 90, from: '2026-07-18', to: '2026-10-16' };
        const inWindow = Array.from({ length: MAX_INSIDER_ROWS }, () =>
            makeTransaction({ date: '2026-09-01' })
        );
        const table = buildInsiderTable(
            [...inWindow, makeTransaction({ date: '2026-04-15' })],
            window
        );
        expect(table.rows).toHaveLength(MAX_INSIDER_ROWS);
        expect(table.beforeWindowRows).toEqual([]);
        expect(table.omittedCount).toBe(1);
    });

    it('빈 입력은 빈 표다', () => {
        expect(buildInsiderTable([])).toEqual({
            rows: [],
            beforeWindowRows: [],
            afterWindowRows: [],
            omittedOtherCount: 0,
            omittedCount: 0,
        });
    });

    it('점수 창 밖의 거래는 창 시작 전과 끝난 뒤로 나눈다 — 창 양 끝은 안이다', () => {
        const table = buildInsiderTable(
            [
                makeTransaction({ date: '2026-10-17' }),
                makeTransaction({ date: '2026-10-16' }),
                makeTransaction({ date: '2026-07-18' }),
                makeTransaction({ date: '2026-07-17' }),
                makeTransaction({ date: '2026-04-15', type: 'sell' }),
            ],
            { days: 90, from: '2026-07-18', to: '2026-10-16' }
        );
        expect(table.rows.map(r => r.date)).toEqual([
            '2026-10-16',
            '2026-07-18',
        ]);
        expect(table.beforeWindowRows.map(r => r.date)).toEqual([
            '2026-07-17',
            '2026-04-15',
        ]);
        expect(table.afterWindowRows.map(r => r.date)).toEqual(['2026-10-17']);
    });

    it('창을 모르면(null·끝 null) 나누지 않는다', () => {
        const txs = [
            makeTransaction({ date: '2026-10-16' }),
            makeTransaction({ date: '2026-01-02' }),
        ];
        const unknownWindow = buildInsiderTable(txs, {
            days: 90,
            from: null,
            to: null,
        });
        expect(buildInsiderTable(txs).beforeWindowRows).toEqual([]);
        expect(buildInsiderTable(txs).afterWindowRows).toEqual([]);
        expect(unknownWindow.beforeWindowRows).toEqual([]);
        expect(unknownWindow.afterWindowRows).toEqual([]);
        expect(unknownWindow.rows).toHaveLength(2);
    });
});

describe('shortRole', () => {
    it('접두사를 떼고 직무만 남긴다', () => {
        expect(shortRole('officer: Chief Executive Officer')).toBe(
            'Chief Executive Officer'
        );
        expect(shortRole(' director ')).toBe('director');
    });
});

describe('large holders', () => {
    it('양식으로 13D·13G·기타를 가른다', () => {
        expect([
            largeHolderKind('SC 13D/A'),
            largeHolderKind('SCHEDULE 13G'),
            largeHolderKind('unknown'),
        ]).toEqual(['13d', '13g', 'other']);
    });

    it('최신 제출순으로 MAX_LARGE_HOLDER_ROWS건만 낸다', () => {
        const filings = Array.from({ length: 12 }, (_, i) =>
            makeLargeHolder({
                filingDate: `2026-01-${String(i + 1).padStart(2, '0')}`,
            })
        );
        const rows = buildLargeHolderRows(filings);
        expect(rows).toHaveLength(MAX_LARGE_HOLDER_ROWS);
        expect(rows[0].filingDate).toBe('2026-01-12');
    });
});
