import { describe, expect, it } from 'vitest';
import { parseSince } from '@/../db/scripts/lib/backfillWindow';

/**
 * `--since` 값은 **원시 SQL에 문자열로 끼워진다**(`interval '<since>'`).
 * 이 스크립트는 운영 DB를 대상으로 돌 수 있으므로 형태를 좁게 고정한다 —
 * 자유 문자열을 통과시키면 그대로 인젝션 표면이 된다.
 */
describe('backfill --since', () => {
    it('기본값은 읽기 경로와 같은 6개월이다', () => {
        // 창이 없으면 news 122만 행을 넣는데 화면에 나오는 것은 6개월치뿐이다
        // (실측: 전체 1,274,300행 vs 6개월 905,049행).
        expect(parseSince(null)).toBe('6 months');
    });

    it("'all'은 창을 끈다", () => {
        expect(parseSince('all')).toBeNull();
    });

    it.each([
        ['30d', '30 days'],
        ['4w', '4 weeks'],
        ['6m', '6 months'],
        ['1y', '1 years'],
    ])('%s → %s', (input, expected) => {
        expect(parseSince(input)).toBe(expected);
    });

    it.each([
        "6 months'; DROP TABLE news; --",
        '1 month',
        '6 mo',
        '-1d',
        '99999d',
        '',
        'm',
        '6M',
    ])('%j는 거부한다', bad => {
        expect(() => parseSince(bad)).toThrow(/--since 형식/);
    });
});
