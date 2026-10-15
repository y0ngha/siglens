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

    it('빈 입력은 빈 표다', () => {
        expect(buildInsiderTable([])).toEqual({
            rows: [],
            omittedOtherCount: 0,
        });
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
