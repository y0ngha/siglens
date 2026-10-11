import { describe, expect, it } from 'vitest';
import type { Bar } from '@y0ngha/siglens-core';
import {
    canExtendIncrementally,
    isEntryServable,
    mergeIncremental,
    overlapMatches,
    overlapStatus,
    EOD_HISTORY_FULL_REFRESH_MS,
    reachesLastClosed,
    trimToWindow,
    type EodHistoryEntry,
    type EodServeContext,
} from '@/shared/api/market/eodHistoryMerge';

const utc = (iso: string): number =>
    Math.floor(Date.parse(`${iso}T00:00:00Z`) / 1000);

const bar = (iso: string, close = 100): Bar => ({
    time: utc(iso),
    open: close - 1,
    high: close + 2,
    low: close - 2,
    close,
    volume: 1000,
});

describe('overlapMatches', () => {
    const cached = bar('2026-06-29', 120.89);

    it('같은 날짜의 OHLC가 같으면 true', () => {
        expect(overlapMatches(cached, [bar('2026-06-29', 120.89)])).toBe(true);
    });

    it('상대 1e-6 이내의 부동소수 잡음은 같은 봉으로 본다', () => {
        const noisy = { ...cached, close: cached.close * (1 + 1e-9) };
        expect(overlapMatches(cached, [noisy])).toBe(true);
    });

    it('분할 조정으로 가격이 바뀌면 false (NVDA 10:1)', () => {
        const preSplit = bar('2024-06-07', 1208.88);
        const adjusted = bar('2024-06-07', 120.888);
        expect(overlapMatches(preSplit, [adjusted])).toBe(false);
    });

    it.each(['open', 'high', 'low', 'close'] as const)(
        '%s 하나만 달라도 false',
        field => {
            const changed = { ...cached, [field]: cached[field] * 1.001 };
            expect(overlapMatches(cached, [changed])).toBe(false);
        }
    );

    it('응답에 같은 날짜 봉이 없으면 false', () => {
        expect(overlapMatches(cached, [bar('2026-06-30')])).toBe(false);
        expect(overlapMatches(cached, [])).toBe(false);
    });

    it('다른 날짜 봉이 섞여 있어도 같은 날짜 봉만 비교한다', () => {
        expect(
            overlapMatches(cached, [
                bar('2026-06-26', 1),
                bar('2026-06-29', 120.89),
                bar('2026-06-30', 2),
            ])
        ).toBe(true);
    });

    it('거래량만 달라도 같은 봉이다(정정이 잦아 전체 재조회를 부르지 않는다)', () => {
        expect(
            overlapMatches(cached, [{ ...cached, volume: cached.volume + 5 }])
        ).toBe(true);
    });

    it('0 값 OHLC끼리는 같다', () => {
        const zero: Bar = {
            time: utc('2026-06-29'),
            open: 0,
            high: 0,
            low: 0,
            close: 0,
            volume: 0,
        };
        expect(overlapMatches(zero, [{ ...zero }])).toBe(true);
    });
});

describe('overlapStatus', () => {
    const cached = bar('2026-06-29', 120.89);

    it('같으면 match', () => {
        expect(overlapStatus(cached, [bar('2026-06-29', 120.89)])).toBe(
            'match'
        );
    });

    it('응답에 같은 날짜 봉이 없으면 missing', () => {
        expect(overlapStatus(cached, [bar('2026-06-30')])).toBe('missing');
    });

    it('값이 다르면 different', () => {
        expect(overlapStatus(cached, [bar('2026-06-29', 12.089)])).toBe(
            'different'
        );
    });
});

describe('mergeIncremental', () => {
    const cached = [bar('2026-06-25'), bar('2026-06-26'), bar('2026-06-29')];

    it('겹침 봉 뒤의 새 봉을 이어 붙인다', () => {
        const merged = mergeIncremental(
            cached,
            [bar('2026-06-29'), bar('2026-06-30', 7)],
            utc('2026-06-29')
        );
        expect(merged.map(b => b.time)).toEqual([
            utc('2026-06-25'),
            utc('2026-06-26'),
            utc('2026-06-29'),
            utc('2026-06-30'),
        ]);
    });

    it('같은 시각은 새로 받은 값이 이기고 중복되지 않는다', () => {
        const merged = mergeIncremental(
            cached,
            [bar('2026-06-29', 100.0000001)],
            utc('2026-06-29')
        );
        expect(merged).toHaveLength(3);
        expect(merged.at(-1)?.close).toBe(100.0000001);
    });

    it('겹침 시각보다 이른 응답 봉은 버린다(그 구간은 캐시가 정본)', () => {
        const merged = mergeIncremental(
            cached,
            [bar('2026-06-26', 999), bar('2026-06-29')],
            utc('2026-06-29')
        );
        expect(merged.find(b => b.time === utc('2026-06-26'))?.close).toBe(100);
    });

    it('새 봉이 없으면 캐시 그대로', () => {
        expect(
            mergeIncremental(cached, [bar('2026-06-29')], utc('2026-06-29'))
        ).toEqual(cached);
    });
});

describe('trimToWindow', () => {
    const bars = [bar('2026-06-25'), bar('2026-06-26'), bar('2026-06-29')];

    it('창 시작보다 이른 봉만 버린다(시작일 봉은 유지)', () => {
        expect(trimToWindow(bars, utc('2026-06-26')).map(b => b.time)).toEqual([
            utc('2026-06-26'),
            utc('2026-06-29'),
        ]);
    });

    it('모두 창 안이면 그대로', () => {
        expect(trimToWindow(bars, utc('2026-01-01'))).toEqual(bars);
    });
});

describe('reachesLastClosed', () => {
    it('마지막 봉이 마감 세션 이상이면 true', () => {
        expect(reachesLastClosed([bar('2026-06-29')], utc('2026-06-29'))).toBe(
            true
        );
    });

    it('마지막 봉이 마감 세션 이전이면 false', () => {
        expect(reachesLastClosed([bar('2026-06-26')], utc('2026-06-29'))).toBe(
            false
        );
    });

    it('빈 배열은 false', () => {
        expect(reachesLastClosed([], utc('2026-06-29'))).toBe(false);
    });
});

describe('isEntryServable / canExtendIncrementally', () => {
    const NOW = Date.parse('2026-06-30T15:00:00Z');
    const COOLDOWN = 4 * 3_600_000;
    const ctx: EodServeContext = {
        lastClosed: '2026-06-29',
        lastClosedThreshold: utc('2026-06-29'),
        fetchFrom: '2021-06-29',
        nowMs: NOW,
        cooldownMs: COOLDOWN,
    };
    const entry = (over: Partial<EodHistoryEntry> = {}): EodHistoryEntry => ({
        asOf: '2026-06-29',
        from: '2021-06-29',
        checkedAt: NOW - 1000,
        fullAt: NOW - 1000,
        bars: [bar('2026-06-26'), bar('2026-06-29')],
        ...over,
    });

    describe('isEntryServable', () => {
        it('같은 세션의 완전한 엔트리는 서빙한다(오래돼도)', () => {
            expect(
                isEntryServable(entry({ checkedAt: NOW - 10 * COOLDOWN }), ctx)
            ).toBe(true);
        });

        it('asOf가 지난 세션이면 서빙하지 않는다', () => {
            expect(isEntryServable(entry({ asOf: '2026-06-26' }), ctx)).toBe(
                false
            );
        });

        it('asOf가 요청 세션보다 앞선 값(시계 차)도 서빙하지 않는다', () => {
            expect(isEntryServable(entry({ asOf: '2026-06-30' }), ctx)).toBe(
                false
            );
        });

        it('요청 창을 덮지 못하면(entry.from > fetchFrom) 서빙하지 않는다', () => {
            expect(isEntryServable(entry({ from: '2021-06-30' }), ctx)).toBe(
                false
            );
        });

        it('더 넓은 창을 가진 엔트리는 좁은 요청을 덮는다', () => {
            expect(isEntryServable(entry({ from: '2020-01-01' }), ctx)).toBe(
                true
            );
        });

        it('불완전 엔트리는 쿨다운 안에서만 서빙한다', () => {
            const lagged = { bars: [bar('2026-06-26')] };
            expect(
                isEntryServable(
                    entry({ ...lagged, checkedAt: NOW - COOLDOWN + 1 }),
                    ctx
                )
            ).toBe(true);
            expect(
                isEntryServable(
                    entry({ ...lagged, checkedAt: NOW - COOLDOWN }),
                    ctx
                )
            ).toBe(false);
        });

        it('빈 봉 엔트리는 완전하지 않다(쿨다운 판정을 따른다)', () => {
            expect(
                isEntryServable(
                    entry({ bars: [], checkedAt: NOW - COOLDOWN - 1 }),
                    ctx
                )
            ).toBe(false);
        });
    });

    describe('canExtendIncrementally', () => {
        const fromThreshold = utc('2021-06-29');
        const can = (e: EodHistoryEntry) =>
            canExtendIncrementally(e, ctx, fromThreshold);

        it('지난 세션 엔트리는 이어 붙일 수 있다', () => {
            expect(can(entry({ asOf: '2026-06-26' }))).toBe(true);
        });

        it('같은 세션의 불완전 엔트리(쿨다운 만료)도 이어 붙일 수 있다', () => {
            expect(can(entry({ bars: [bar('2026-06-26')] }))).toBe(true);
        });

        it('빈 봉이면 불가', () => {
            expect(can(entry({ bars: [] }))).toBe(false);
        });

        it('엔트리가 요청 창을 덮지 못하면 불가(더 이른 from은 전체 fetch)', () => {
            expect(can(entry({ from: '2021-06-30' }))).toBe(false);
        });

        it('마지막 봉이 새 창 시작보다 이르면 불가(트림하면 비게 된다)', () => {
            expect(can(entry({ bars: [bar('2020-01-02')] }))).toBe(false);
        });

        it('마지막 봉이 마감 세션보다 뒤면 불가(시계 차)', () => {
            expect(can(entry({ bars: [bar('2026-06-30')] }))).toBe(false);
        });

        it('asOf가 요청 세션보다 뒤면 불가', () => {
            expect(can(entry({ asOf: '2026-06-30' }))).toBe(false);
        });

        it('마지막 전체 fetch가 7일 미만이면 가능, 7일 이상이면 불가(전체 재조회)', () => {
            expect(
                can(entry({ fullAt: NOW - EOD_HISTORY_FULL_REFRESH_MS + 1 }))
            ).toBe(true);
            expect(
                can(entry({ fullAt: NOW - EOD_HISTORY_FULL_REFRESH_MS }))
            ).toBe(false);
        });
    });
});
