import { describe, expect, it } from 'vitest';
import { RETENTION_WINDOWS } from '@/entities/funnel/retentionWindows';
import {
    FIRST_VISIT_BUCKETS,
    LAST_VISIT_BUCKETS,
    RETURN_WINDOWS,
    VISIT_DAYS_BUCKETS,
} from '../../types';
import {
    GUEST_RETURN_WINDOWS,
    VISIT_DAYS_CAP,
    advanceVisitHistory,
    parseVisitHistory,
    parseVisitSignals,
    visitSignalsOf,
    type VisitHistory,
} from '../visitHistory';
import type { VisitSignals } from '../../types';

const BASE = Date.UTC(2026, 0, 1);

/** 2026-01-01에서 n일 뒤의 날짜 키. */
function day(n: number): string {
    return new Date(BASE + n * 86_400_000).toISOString().slice(0, 10);
}

/** 시계가 정상일 때의 구간값. `null`이면 테스트 자체가 틀린 것이다. */
function signalsOf(h: VisitHistory, today: string): VisitSignals {
    const signals = visitSignalsOf(h, today);
    if (signals === null) throw new Error('signals unexpectedly null');
    return signals;
}

/** 첫 방문 day(0), 직전 방문 day(prev), 오늘 day(k)인 이력. */
function history(k: number, prev: number | null, days = 2): VisitHistory {
    return prev === null
        ? { first: day(0), prev: null, last: day(0), days: 1 }
        : { first: day(0), prev: day(prev), last: day(k), days };
}

describe('visitSignalsOf: first 구간', () => {
    it.each([
        [0, 'new'],
        [1, 'd1_6'],
        [6, 'd1_6'],
        [7, 'd7_13'],
        [13, 'd7_13'],
        [14, 'd14_29'],
        [29, 'd14_29'],
        [30, 'd30_89'],
        [89, 'd30_89'],
        [90, 'd90_plus'],
    ] as const)('k=%i → %s', (k, bucket) => {
        const h = k === 0 ? history(0, null) : history(k, k - 1);
        expect(signalsOf(h, day(k)).first).toBe(bucket);
    });
});

describe('visitSignalsOf: last 구간', () => {
    it('직전 방문이 없으면 none', () => {
        expect(signalsOf(history(0, null), day(0)).last).toBe('none');
    });

    it.each([
        [1, 'd1'],
        [2, 'd2_6'],
        [6, 'd2_6'],
        [7, 'd7_13'],
        [13, 'd7_13'],
        [14, 'd14_29'],
        [29, 'd14_29'],
        [30, 'd30_plus'],
    ] as const)('l=%i → %s', (l, bucket) => {
        const h = history(100, 100 - l);
        expect(signalsOf(h, day(100)).last).toBe(bucket);
    });
});

describe('visitSignalsOf: days 구간', () => {
    it.each([
        [1, 'n1'],
        [2, 'n2'],
        [3, 'n3_4'],
        [4, 'n3_4'],
        [5, 'n5_9'],
        [9, 'n5_9'],
        [10, 'n10_19'],
        [19, 'n10_19'],
        [20, 'n20_plus'],
        [VISIT_DAYS_CAP, 'n20_plus'],
    ] as const)('days=%i → %s', (days, bucket) => {
        const h = days === 1 ? history(0, null) : history(50, 49, days);
        expect(signalsOf(h, day(h.last === day(0) ? 0 : 50)).days).toBe(bucket);
    });
});

describe('visitSignalsOf: window', () => {
    it('첫 방문 다음 날은 d1이다', () => {
        expect(signalsOf(history(1, 0), day(1)).window).toBe('d1');
    });

    it('d1 창 밖(k=2)은 null이다', () => {
        expect(signalsOf(history(2, 1), day(2)).window).toBeNull();
    });

    it.each([
        [7, 6, 'd7'],
        [7, 0, 'd7'],
        [13, 6, 'd7'],
        [13, 7, null],
        [12, 11, null],
        [6, 5, null],
        [14, 6, null],
    ] as const)('k=%i, p=%i → %s', (k, p, expected) => {
        expect(signalsOf(history(k, p), day(k)).window).toBe(expected);
    });

    it.each([
        [30, 29, 'd30'],
        [36, 29, 'd30'],
        [36, 30, null],
        [37, 29, null],
        [29, 28, null],
    ] as const)('k=%i, p=%i → %s', (k, p, expected) => {
        expect(signalsOf(history(k, p), day(k)).window).toBe(expected);
    });

    it('첫 방문 날(prev 없음)은 window가 없다', () => {
        expect(signalsOf(history(0, null), day(0)).window).toBeNull();
    });
});

describe('visitSignalsOf: DST와 시계', () => {
    it('미국 DST 전환을 가로지르는 날짜 쌍도 달력 일수로 센다(2026-03-07 → 03-09는 2일)', () => {
        const h: VisitHistory = {
            first: '2026-03-07',
            prev: '2026-03-08',
            last: '2026-03-09',
            days: 3,
        };
        expect(signalsOf(h, '2026-03-09')).toEqual({
            first: 'd1_6',
            last: 'd1',
            days: 'n3_4',
            window: null,
        });
        const wide: VisitHistory = { ...h, prev: '2026-03-07', days: 2 };
        expect(signalsOf(wide, '2026-03-09').last).toBe('d2_6');
    });

    it('기기 시계가 과거로 가면 구간값을 내지 않는다(null) — last가 미래에 남아 window가 되풀이되는 것을 막는다', () => {
        const h = history(10, 9);
        expect(visitSignalsOf(h, day(3))).toBeNull();
        expect(visitSignalsOf(h, day(10))).not.toBeNull();
    });
});

describe('advanceVisitHistory', () => {
    it('저장된 이력이 없으면 오늘이 첫 방문이다', () => {
        expect(advanceVisitHistory(null, '2026-02-01')).toEqual({
            first: '2026-02-01',
            prev: null,
            last: '2026-02-01',
            days: 1,
        });
    });

    it('같은 날이면 그대로 돌려준다', () => {
        const stored = history(3, 1, 3);
        expect(advanceVisitHistory(stored, day(3))).toBe(stored);
    });

    it('다음 날이면 직전 방문일을 밀고 날 수를 하나 늘린다', () => {
        expect(advanceVisitHistory(history(3, 1, 3), day(4))).toEqual({
            first: day(0),
            prev: day(3),
            last: day(4),
            days: 4,
        });
    });

    it('기기 시계가 과거로 갔으면 그대로 돌려준다', () => {
        const stored = history(10, 9);
        expect(advanceVisitHistory(stored, day(5))).toBe(stored);
    });

    it('날 수는 상한을 넘지 않는다', () => {
        const stored = history(10, 9, VISIT_DAYS_CAP);
        expect(advanceVisitHistory(stored, day(11)).days).toBe(VISIT_DAYS_CAP);
    });

    it('같은 날 두 번 반영해도 같은 구간값이 나온다', () => {
        const once = advanceVisitHistory(history(6, 0), day(7));
        const twice = advanceVisitHistory(once, day(7));
        expect(signalsOf(twice, day(7))).toEqual(signalsOf(once, day(7)));
        expect(signalsOf(once, day(7)).window).toBe('d7');
    });
});

describe('parseVisitHistory', () => {
    const valid = history(5, 2, 3);

    it('정상 값을 읽는다', () => {
        expect(parseVisitHistory(JSON.stringify(valid))).toEqual(valid);
        expect(parseVisitHistory(JSON.stringify(history(0, null)))).toEqual(
            history(0, null)
        );
    });

    it.each([
        ['null 입력', null],
        ['깨진 JSON', '{'],
        ['배열', '[]'],
        ['null JSON', 'null'],
        ['여분 키', JSON.stringify({ ...valid, extra: 1 })],
        ['키 누락', JSON.stringify({ first: day(0), last: day(1), days: 2 })],
        ['날짜 형식', JSON.stringify({ ...valid, first: '2026-1-1' })],
        ['없는 날짜', JSON.stringify({ ...valid, first: '2026-02-30' })],
        ['first가 last보다 뒤', JSON.stringify({ ...valid, first: day(9) })],
        [
            'prev가 first보다 앞',
            JSON.stringify({ ...valid, prev: '2025-12-31' }),
        ],
        ['prev가 last와 같음', JSON.stringify({ ...valid, prev: day(5) })],
        ['prev가 last보다 뒤', JSON.stringify({ ...valid, prev: day(6) })],
        ['days가 0', JSON.stringify({ ...valid, days: 0 })],
        ['days가 소수', JSON.stringify({ ...valid, days: 2.5 })],
        ['days가 문자열', JSON.stringify({ ...valid, days: '3' })],
        [
            'days가 상한 초과',
            JSON.stringify({ ...valid, days: VISIT_DAYS_CAP + 1 }),
        ],
        ['prev가 있는데 days가 1', JSON.stringify({ ...valid, days: 1 })],
        [
            'prev가 없는데 days가 2',
            JSON.stringify({
                first: day(0),
                prev: null,
                last: day(0),
                days: 2,
            }),
        ],
        [
            'prev가 없는데 first와 last가 다름',
            JSON.stringify({
                first: day(0),
                prev: null,
                last: day(3),
                days: 1,
            }),
        ],
    ])('거부한다: %s', (_name, raw) => {
        expect(parseVisitHistory(raw)).toBeNull();
    });
});

describe('parseVisitSignals', () => {
    const DAYS_SAMPLE = [2, 3, 4, 5, 9, 10, 19, 20, 25] as const;
    /**
     * 실제로 만들어질 수 있는 이력만: 직전 방문이 첫 방문일이면 날 수는 2이고, 아니면 첫·직전·마지막
     * 방문이 서로 다른 날이라 3 이상이며 직전 방문일까지의 날 수 + 1을 넘지 못한다.
     */
    const reachable = Array.from({ length: 121 }, (_, k) => k).flatMap(k =>
        k === 0
            ? [{ h: history(0, null), k }]
            : Array.from({ length: k }, (_, p) => p).flatMap(p =>
                  DAYS_SAMPLE.filter(days =>
                      p === 0 ? days === 2 : days >= 3 && days <= p + 2
                  ).map(days => ({ h: history(k, p, days), k }))
              )
    );

    it('visitSignalsOf가 만들 수 있는 값은 전부 받는다', () => {
        const rejected = reachable.filter(
            ({ h, k }) => parseVisitSignals(signalsOf(h, day(k))) === null
        );
        expect(rejected).toEqual([]);
    });

    it('서로 다른 페이로드 수는 닫힌 상한(97) 안이다', () => {
        const payloads = new Set(
            reachable.map(({ h, k }) => JSON.stringify(signalsOf(h, day(k))))
        );
        expect(payloads.size).toBeLessThanOrEqual(97);
    });

    const ok = { first: 'd7_13', last: 'd7_13', days: 'n2', window: 'd7' };

    it('정상 값을 받는다', () => {
        expect(parseVisitSignals(ok)).toEqual(ok);
        expect(
            parseVisitSignals({
                first: 'new',
                last: 'none',
                days: 'n1',
                window: null,
            })
        ).not.toBeNull();
    });

    it.each([
        ['null', null],
        ['문자열', 'x'],
        ['배열', []],
        ['여분 키', { ...ok, extra: 1 }],
        ['키 누락', { first: 'd7_13', last: 'd7_13', days: 'n2' }],
        ['알 수 없는 first', { ...ok, first: 'd8' }],
        ['알 수 없는 last', { ...ok, last: 'x' }],
        ['알 수 없는 days', { ...ok, days: 'n99' }],
        ['알 수 없는 window', { ...ok, window: 'd9' }],
        ['숫자 값', { ...ok, days: 2 }],
        ['new인데 last가 none이 아님', { ...ok, first: 'new', window: null }],
        [
            'new인데 window',
            { first: 'new', last: 'none', days: 'n1', window: 'd1' },
        ],
        ['none인데 first가 new가 아님', { ...ok, last: 'none', window: null }],
        ['n1인데 first가 new가 아님', { ...ok, days: 'n1', window: null }],
        [
            'd1인데 first가 d7_13',
            { first: 'd7_13', last: 'd1', days: 'n2', window: 'd1' },
        ],
        [
            'd1인데 last가 d1이 아님',
            { first: 'd1_6', last: 'd2_6', days: 'n2', window: 'd1' },
        ],
        [
            'd1인데 days가 n2가 아님',
            { first: 'd1_6', last: 'd1', days: 'n3_4', window: 'd1' },
        ],
        ['d7인데 first가 d1_6', { ...ok, first: 'd1_6' }],
        ['d30인데 first가 d7_13', { ...ok, window: 'd30' }],
    ])('거부한다: %s', (_name, value) => {
        expect(parseVisitSignals(value)).toBeNull();
    });

    it('d30 창은 first가 d30_89일 때 받는다', () => {
        expect(
            parseVisitSignals({ ...ok, first: 'd30_89', window: 'd30' })
        ).not.toBeNull();
    });

    it('목록 상수는 6개씩이다', () => {
        expect(FIRST_VISIT_BUCKETS).toHaveLength(6);
        expect(LAST_VISIT_BUCKETS).toHaveLength(6);
        expect(VISIT_DAYS_BUCKETS).toHaveLength(6);
        expect(RETURN_WINDOWS).toHaveLength(3);
    });
});

describe('GUEST_RETURN_WINDOWS', () => {
    it('d7·d30은 회원 재방문 창과 같다', () => {
        expect(GUEST_RETURN_WINDOWS.d7).toEqual(RETENTION_WINDOWS.d7);
        expect(GUEST_RETURN_WINDOWS.d30).toEqual(RETENTION_WINDOWS.d30);
    });

    it('d1은 첫 방문 다음 날 하루다', () => {
        expect(GUEST_RETURN_WINDOWS.d1).toEqual({ startDay: 1, endDay: 1 });
    });
});
