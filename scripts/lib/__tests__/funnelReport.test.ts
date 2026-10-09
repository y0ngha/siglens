import { describe, expect, it } from 'vitest';
import {
    buildGateTable,
    cohortMaturity,
    formatRate,
    kstRangeBounds,
    parseReportArgs,
    renderTable,
} from '../funnelReport';

describe('parseReportArgs', () => {
    it('--from/--to를 읽는다', () => {
        expect(
            parseReportArgs(['--from', '2026-10-01', '--to', '2026-10-31'])
        ).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    });

    it.each([
        [['--from', '2026-10-01']],
        [['--to', '2026-10-31']],
        [['--from', '2026/10/01', '--to', '2026-10-31']],
        [['--from', '2026-11-01', '--to', '2026-10-31']],
    ])('잘못된 인자는 사용법과 함께 던진다: %j', argv => {
        expect(() => parseReportArgs(argv)).toThrow(
            /--from YYYY-MM-DD --to YYYY-MM-DD/
        );
    });
});

describe('kstRangeBounds', () => {
    it('양끝 포함 KST 날짜를 [from 00:00, to 다음날 00:00)으로 바꾼다', () => {
        expect(
            kstRangeBounds({ from: '2026-10-01', to: '2026-10-31' })
        ).toEqual({
            from: new Date('2026-09-30T15:00:00.000Z'),
            toExclusive: new Date('2026-10-31T15:00:00.000Z'),
        });
    });
});

describe('buildGateTable', () => {
    it('게이트 클릭·노출·CTA 클릭·가입을 키별 다른 열에 모은다', () => {
        const rows = [
            { key: 'reasoning_toggle', event: 'gate_clicked', count: 30 },
            { key: 'reasoning_toggle', event: 'nudge_shown', count: 28 },
            { key: 'reasoning_toggle', event: 'nudge_clicked', count: 7 },
            { key: 'reasoning_toggle', event: 'signup_completed', count: 2 },
            { key: 'timeframe', event: 'gate_clicked', count: 50 },
            { key: null, event: 'watchlist_added', count: 9 },
        ];
        expect(buildGateTable(rows)).toEqual([
            {
                key: 'reasoning_toggle',
                gateClicks: 30,
                shown: 28,
                ctaClicks: 7,
                signups: 2,
            },
            {
                key: 'timeframe',
                gateClicks: 50,
                shown: 0,
                ctaClicks: 0,
                signups: 0,
            },
        ]);
    });

    it('노출 내림차순, 같으면 게이트 클릭 내림차순, 같으면 키 사전순', () => {
        const rows = [
            { key: 'b', event: 'nudge_shown', count: 1 },
            { key: 'a', event: 'nudge_shown', count: 1 },
            { key: 'c', event: 'gate_clicked', count: 5 },
            { key: 'd', event: 'nudge_shown', count: 9 },
        ];
        expect(buildGateTable(rows).map(r => r.key)).toEqual([
            'd',
            'a',
            'b',
            'c',
        ]);
    });
});

describe('formatRate', () => {
    it('분모가 0이면 -', () => {
        expect(formatRate(3, 0)).toBe('-');
    });

    it('소수 첫째 자리 퍼센트', () => {
        expect(formatRate(1, 8)).toBe('12.5%');
        expect(formatRate(0, 8)).toBe('0.0%');
    });
});

describe('renderTable', () => {
    it('열 너비를 맞춰 두 칸 간격으로 그린다', () => {
        // 기대값을 padEnd로 조립한다 — 리터럴에 공백 수를 손으로 세어 적으면 하나만
        // 틀려도 테스트가 구현이 아니라 오타를 잡는다. 첫 열 너비는 'timeframe'(9)이다.
        expect(
            renderTable(
                ['key', 'shown'],
                [
                    ['timeframe', '50'],
                    ['a', '1'],
                ]
            )
        ).toBe(
            [
                `${'key'.padEnd(9)}  shown`,
                'timeframe  50',
                `${'a'.padEnd(9)}  1`,
            ].join('\n')
        );
    });

    it('마지막 열의 꼬리 공백은 잘라 낸다', () => {
        expect(
            renderTable(
                ['k', 'v'],
                [
                    ['aa', '1'],
                    ['b', '22'],
                ]
            )
        ).toBe(['k   v', 'aa  1', 'b   22'].join('\n'));
    });

    it('행이 없으면 헤더와 (행 없음)', () => {
        expect(renderTable(['키'], [])).toBe('키\n(행 없음)');
    });
});

describe('cohortMaturity', () => {
    // 주 시작 2026-09-28 → 주 끝 10-04 → D7 창 끝 10-17, D30 창 끝 11-09.
    const WEEK = '2026-09-28';

    it.each([
        ['2026-10-16', false],
        ['2026-10-17', false],
        ['2026-10-18', true],
    ])('D7: 오늘 %s → %s', (today, expected) => {
        expect(cohortMaturity(WEEK, today).d7).toBe(expected);
    });

    it.each([
        ['2026-11-08', false],
        ['2026-11-09', false],
        ['2026-11-10', true],
    ])('D30: 오늘 %s → %s', (today, expected) => {
        expect(cohortMaturity(WEEK, today).d30).toBe(expected);
    });

    it('월 경계를 넘어도 달력 날짜로 센다', () => {
        expect(cohortMaturity('2026-12-28', '2027-01-16').d7).toBe(false);
        expect(cohortMaturity('2026-12-28', '2027-01-17').d7).toBe(true);
    });
});
