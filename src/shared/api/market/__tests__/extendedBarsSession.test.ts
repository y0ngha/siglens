import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/api/fmp/httpClient', () => ({
    fmpGet: vi.fn(),
}));

import type { Bar, GetBarsOptions } from '@y0ngha/siglens-core';
import { fmpGet } from '@/shared/api/fmp/httpClient';
import { FmpMarketProvider } from '@/shared/api/fmp/FmpMarketProvider';
import {
    EXTENDED_BAR_INTERVAL_SECONDS,
    buildExtendedSessionRanges,
    classifyExtendedBar,
    etDayOfBar,
    extendedTailTtlSeconds,
    filterOutOfSessionBars,
    NO_EXTENDED_BARS,
    isExtendedBarTimeframe,
    mergeExtendedBars,
    type ExtendedBarTimeframe,
} from '@/shared/api/market/extendedBarsSession';
import { SECONDS_PER_DAY, SECONDS_PER_HOUR } from '@/shared/config/time';
import extended5Min from '../../fmp/__tests__/fixtures/extendedBars.aapl.5min.json';
import extended1Hour from '../../fmp/__tests__/fixtures/extendedBars.aapl.1hour.json';
import extended4Hour from '../../fmp/__tests__/fixtures/extendedBars.aapl.4hour.json';
import extended1HourEarly from '../../fmp/__tests__/fixtures/extendedBars.aapl.1hour.earlyClose.json';
import extended4HourEarly from '../../fmp/__tests__/fixtures/extendedBars.aapl.4hour.earlyClose.json';
import regular5Min from '../../fmp/__tests__/fixtures/regularBars.aapl.5min.json';
import regular1Hour from '../../fmp/__tests__/fixtures/regularBars.aapl.1hour.json';
import regular4Hour from '../../fmp/__tests__/fixtures/regularBars.aapl.4hour.json';
import regular1HourEarly from '../../fmp/__tests__/fixtures/regularBars.aapl.1hour.earlyClose.json';
import regular4HourEarly from '../../fmp/__tests__/fixtures/regularBars.aapl.4hour.earlyClose.json';

const mockFmpGet = vi.mocked(fmpGet);
const provider = new FmpMarketProvider();

/** 실제 FMP 응답 형태(최신순)를 어댑터에 통과시켜 `Bar[]`(시각 오름차순)로 만든다. */
async function barsFrom(
    raw: unknown,
    timeframe: ExtendedBarTimeframe,
    extended: boolean
): Promise<Bar[]> {
    mockFmpGet.mockResolvedValueOnce(raw);
    const options: GetBarsOptions = {
        symbol: 'AAPL',
        timeframe,
        from: '2000-01-01',
    };
    return extended
        ? provider.getExtendedBars(options)
        : provider.getBars(options);
}

const etClock = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
});
/** `HH:mm` ET 라벨 — 어느 서버 시간대에서도 같다. */
const etLabel = (time: number): string => etClock.format(time * 1000);
const labels = (bars: readonly Bar[]): string[] =>
    bars.map(b => etLabel(b.time));

const utc = (iso: string): number => Math.floor(Date.parse(iso) / 1000);
const synthetic = (iso: string, close = 1): Bar => ({
    time: utc(iso),
    open: close,
    high: close,
    low: close,
    close,
    volume: 1,
});

beforeEach(() => {
    mockFmpGet.mockReset();
    mockFmpGet.mockRejectedValue(new Error('fmpGet must be stubbed'));
});

describe('isExtendedBarTimeframe', () => {
    it.each(['5Min', '15Min', '30Min', '1Hour', '4Hour'])('%s는 받는다', tf => {
        expect(isExtendedBarTimeframe(tf)).toBe(true);
    });

    it.each(['1Day', '1Min', '', 5, null, undefined])(
        '%s는 받지 않는다',
        tf => {
            expect(isExtendedBarTimeframe(tf)).toBe(false);
        }
    );
});

describe('classifyExtendedBar — 버킷 전체가 정규장 밖일 때만', () => {
    const at = (iso: string): number => utc(iso);

    it('5분봉: 04:00·09:25는 프리, 09:30은 정규장, 15:55는 정규장, 16:00·19:55는 애프터', () => {
        const interval = EXTENDED_BAR_INTERVAL_SECONDS['5Min'];
        // 2026-10-14 EDT(UTC−4)
        expect(classifyExtendedBar(at('2026-10-14T08:00:00Z'), interval)).toBe(
            'pre'
        );
        expect(classifyExtendedBar(at('2026-10-14T13:25:00Z'), interval)).toBe(
            'pre'
        );
        expect(
            classifyExtendedBar(at('2026-10-14T13:30:00Z'), interval)
        ).toBeNull();
        expect(
            classifyExtendedBar(at('2026-10-14T19:55:00Z'), interval)
        ).toBeNull();
        expect(classifyExtendedBar(at('2026-10-14T20:00:00Z'), interval)).toBe(
            'after'
        );
        expect(classifyExtendedBar(at('2026-10-14T23:55:00Z'), interval)).toBe(
            'after'
        );
    });

    it('1시간봉: 08:00(08~09)은 프리, 09:00(09~10)은 개장을 가로지르므로 제외', () => {
        const interval = EXTENDED_BAR_INTERVAL_SECONDS['1Hour'];
        expect(classifyExtendedBar(at('2026-10-14T12:00:00Z'), interval)).toBe(
            'pre'
        );
        expect(
            classifyExtendedBar(at('2026-10-14T13:00:00Z'), interval)
        ).toBeNull();
    });

    it('4시간봉: 04:00만 프리, 08:00(개장 가로지름)·12:00(마감 가로지름)은 제외, 16:00은 애프터', () => {
        const interval = EXTENDED_BAR_INTERVAL_SECONDS['4Hour'];
        expect(classifyExtendedBar(at('2026-10-14T08:00:00Z'), interval)).toBe(
            'pre'
        );
        expect(
            classifyExtendedBar(at('2026-10-14T12:00:00Z'), interval)
        ).toBeNull();
        expect(
            classifyExtendedBar(at('2026-10-14T16:00:00Z'), interval)
        ).toBeNull();
        expect(classifyExtendedBar(at('2026-10-14T20:00:00Z'), interval)).toBe(
            'after'
        );
    });

    it('확장 세션 밖(04:00 이전·20:00 이후)은 제외', () => {
        const interval = EXTENDED_BAR_INTERVAL_SECONDS['5Min'];
        expect(
            classifyExtendedBar(at('2026-10-14T07:55:00Z'), interval)
        ).toBeNull();
        expect(
            classifyExtendedBar(at('2026-10-15T00:00:00Z'), interval)
        ).toBeNull();
    });

    it('반장일(2025-11-28, EST)은 13:00부터 애프터, 12:00 1시간봉은 마감을 가로지르므로 제외', () => {
        const hour = EXTENDED_BAR_INTERVAL_SECONDS['1Hour'];
        // EST(UTC−5): 12:00 ET = 17:00Z, 13:00 ET = 18:00Z
        expect(
            classifyExtendedBar(at('2025-11-28T17:00:00Z'), hour)
        ).toBeNull();
        expect(classifyExtendedBar(at('2025-11-28T18:00:00Z'), hour)).toBe(
            'after'
        );
        expect(
            classifyExtendedBar(
                at('2025-11-28T17:55:00Z'),
                EXTENDED_BAR_INTERVAL_SECONDS['5Min']
            )
        ).toBeNull();
        expect(
            classifyExtendedBar(
                at('2025-11-28T18:00:00Z'),
                EXTENDED_BAR_INTERVAL_SECONDS['5Min']
            )
        ).toBe('after');
    });

    it('같은 ET 시각이 서머타임 전후로 다른 UTC여도 같게 분류한다(2026-03-06 EST vs 03-09 EDT)', () => {
        const interval = EXTENDED_BAR_INTERVAL_SECONDS['5Min'];
        // 04:00 ET: EST 09:00Z, EDT 08:00Z
        expect(classifyExtendedBar(at('2026-03-06T09:00:00Z'), interval)).toBe(
            'pre'
        );
        expect(classifyExtendedBar(at('2026-03-09T08:00:00Z'), interval)).toBe(
            'pre'
        );
        // 09:30 ET: EST 14:30Z, EDT 13:30Z — 개장
        expect(
            classifyExtendedBar(at('2026-03-06T14:30:00Z'), interval)
        ).toBeNull();
        expect(
            classifyExtendedBar(at('2026-03-09T13:30:00Z'), interval)
        ).toBeNull();
        // 16:00 ET: EST 21:00Z, EDT 20:00Z — 애프터 시작
        expect(classifyExtendedBar(at('2026-03-06T21:00:00Z'), interval)).toBe(
            'after'
        );
        expect(classifyExtendedBar(at('2026-03-09T20:00:00Z'), interval)).toBe(
            'after'
        );
    });
});

describe('mergeExtendedBars — 정규장 봉이 진실의 원천이다 (실제 AAPL 응답)', () => {
    it('5분봉: 같은 시각은 정규장이 이기고, 정규장 봉은 한 개도 바뀌지 않는다', async () => {
        const regular = await barsFrom(regular5Min, '5Min', false);
        const extended = await barsFrom(extended5Min, '5Min', true);
        const { displayBars, extendedBars } = mergeExtendedBars(
            regular,
            extended,
            '5Min'
        );

        // 정규 78 + 프리 66(04:00~09:25) + 애프터 48(16:00~19:55) = 192
        expect(regular).toHaveLength(78);
        expect(extendedBars).toHaveLength(114);
        expect(displayBars).toHaveLength(192);
        // 정규장 봉은 같은 값·같은 참조 그대로
        const regularTimes = new Set(regular.map(b => b.time));
        expect(displayBars.filter(b => regularTimes.has(b.time))).toEqual(
            regular
        );
        for (const r of regular) {
            expect(displayBars.find(b => b.time === r.time)).toBe(r);
        }
        expect(extendedBars.some(b => regularTimes.has(b.time))).toBe(false);
    });

    it('5분봉 dedupe: 같은 시각에 값이 다르면 정규장 값을 쓴다', () => {
        const regularBar = synthetic('2026-10-14T13:30:00Z', 100);
        const clashing = synthetic('2026-10-14T13:30:00Z', 999);
        const pre = synthetic('2026-10-14T13:25:00Z', 50);
        const { displayBars, extendedBars } = mergeExtendedBars(
            [regularBar],
            [clashing, pre],
            '5Min'
        );
        expect(displayBars).toEqual([pre, regularBar]);
        expect(displayBars[1]).toBe(regularBar);
        expect(extendedBars).toEqual([pre]);
    });

    it('정규 시리즈에 정규장 밖 시각의 봉이 끼어 있어도 같은 시각 확장 봉보다 정규가 이긴다', () => {
        // 공급자가 정규 응답에 16:00 ET 봉을 넣은 경우 — 시각 중복 제거가 세션 창 규칙과 독립으로 지켜야 한다
        const regularAtClose = synthetic('2026-10-14T20:00:00Z', 100);
        const extendedAtClose = synthetic('2026-10-14T20:00:00Z', 999);
        const regularOpen = synthetic('2026-10-14T13:30:00Z');
        const { displayBars, extendedBars } = mergeExtendedBars(
            [regularOpen, regularAtClose],
            [extendedAtClose],
            '5Min'
        );
        expect(displayBars).toEqual([regularOpen, regularAtClose]);
        expect(displayBars[1]).toBe(regularAtClose);
        expect(extendedBars).toEqual([]);
    });

    it('1시간봉: 09:00 버킷은 버려 정규장 7개 + 프리 5개(04~08) + 애프터 4개(16~19)가 된다', async () => {
        const regular = await barsFrom(regular1Hour, '1Hour', false);
        const extended = await barsFrom(extended1Hour, '1Hour', true);
        const { displayBars, extendedBars } = mergeExtendedBars(
            regular,
            extended,
            '1Hour'
        );

        expect(labels(displayBars)).toEqual([
            '04:00',
            '05:00',
            '06:00',
            '07:00',
            '08:00',
            '09:30',
            '10:30',
            '11:30',
            '12:30',
            '13:30',
            '14:30',
            '15:30',
            '16:00',
            '17:00',
            '18:00',
            '19:00',
        ]);
        expect(labels(extendedBars)).not.toContain('09:00');
        // 정규장 봉(09:30 시작)은 시계 정각 버킷으로 대체되지 않는다
        expect(displayBars.filter(b => regular.includes(b))).toEqual(regular);
    });

    it('4시간봉: 08:00(개장 가로지름)·12:00(마감 가로지름)을 버리고 04:00·16:00만 남긴다', async () => {
        const regular = await barsFrom(regular4Hour, '4Hour', false);
        const extended = await barsFrom(extended4Hour, '4Hour', true);
        const { displayBars, extendedBars } = mergeExtendedBars(
            regular,
            extended,
            '4Hour'
        );

        expect(labels(extendedBars)).toEqual(['04:00', '16:00']);
        expect(labels(displayBars)).toEqual([
            '04:00',
            '09:30',
            '13:30',
            '16:00',
        ]);
    });

    it('애프터마켓 16:00 버킷은 마감과 같은 시각에 시작해도 남는다', async () => {
        const regular = await barsFrom(regular1Hour, '1Hour', false);
        const extended = await barsFrom(extended1Hour, '1Hour', true);
        const { extendedBars } = mergeExtendedBars(regular, extended, '1Hour');
        expect(labels(extendedBars)).toContain('16:00');
    });

    it('반장일(2025-11-28) 1시간봉: 13:00부터 애프터가 남고 12:00 버킷은 버린다', async () => {
        const regular = await barsFrom(regular1HourEarly, '1Hour', false);
        const extended = await barsFrom(extended1HourEarly, '1Hour', true);
        const { displayBars, extendedBars } = mergeExtendedBars(
            regular,
            extended,
            '1Hour'
        );

        expect(labels(extendedBars)).toEqual([
            '04:00',
            '05:00',
            '06:00',
            '07:00',
            '08:00',
            '13:00',
            '14:00',
            '15:00',
            '16:00',
        ]);
        expect(labels(displayBars)).toEqual([
            '04:00',
            '05:00',
            '06:00',
            '07:00',
            '08:00',
            '09:30',
            '10:30',
            '11:30',
            '12:30',
            '13:00',
            '14:00',
            '15:00',
            '16:00',
        ]);
    });

    it('반장일 4시간봉: 12:00(13:00 마감을 가로지름)을 버린다', async () => {
        const regular = await barsFrom(regular4HourEarly, '4Hour', false);
        const extended = await barsFrom(extended4HourEarly, '4Hour', true);
        const { extendedBars } = mergeExtendedBars(regular, extended, '4Hour');
        expect(labels(extendedBars)).toEqual(['04:00', '16:00']);
    });

    it('결과는 시각 오름차순이며 시각이 유일하다', async () => {
        const regular = await barsFrom(regular5Min, '5Min', false);
        const extended = await barsFrom(extended5Min, '5Min', true);
        // 확장 봉에 같은 시각 중복이 섞여 와도 유일해야 한다
        const { displayBars } = mergeExtendedBars(
            regular,
            [...extended, ...extended],
            '5Min'
        );
        const times = displayBars.map(b => b.time);
        expect(times).toEqual([...new Set(times)].toSorted((a, b) => a - b));
    });

    it('정규 봉이 시작한 거래일보다 앞선 날의 확장 봉은 버린다(그날 프리마켓은 남긴다)', () => {
        const regular = [synthetic('2026-10-14T13:30:00Z')];
        const dayBeforeAfter = synthetic('2026-10-13T20:00:00Z'); // 앞선 날 애프터
        const samePre = synthetic('2026-10-14T12:00:00Z'); // 같은 날 프리
        const { extendedBars } = mergeExtendedBars(
            regular,
            [dayBeforeAfter, samePre],
            '5Min'
        );
        expect(extendedBars).toEqual([samePre]);
    });

    it('확장 봉이 없는 모든 경로는 같은 동결된 빈 배열을 돌려준다(참조 안정)', () => {
        const regular = [synthetic('2026-10-14T13:30:00Z')];
        const results = [
            mergeExtendedBars(regular, null, '5Min').extendedBars,
            mergeExtendedBars(regular, [], '5Min').extendedBars,
            mergeExtendedBars([], [synthetic('2026-10-14T12:00:00Z')], '5Min')
                .extendedBars,
            // 전부 정규장과 겹쳐 걸러진 경우
            mergeExtendedBars(
                regular,
                [synthetic('2026-10-14T14:00:00Z')],
                '5Min'
            ).extendedBars,
        ];
        for (const r of results) {
            expect(r).toBe(NO_EXTENDED_BARS);
            expect(r).toHaveLength(0);
            expect(Object.isFrozen(r)).toBe(true);
        }
        // 두 번 불러도 같은 참조 — useMemo·effect 의존성이 흔들리지 않는다
        expect(mergeExtendedBars(regular, null, '5Min').extendedBars).toBe(
            mergeExtendedBars(regular, [], '15Min').extendedBars
        );
    });

    it('확장 봉이 없거나 비어 있으면 정규 배열 자신을 그대로 돌려준다(참조 동일)', () => {
        const regular = [synthetic('2026-10-14T13:30:00Z')];
        expect(mergeExtendedBars(regular, null, '5Min').displayBars).toBe(
            regular
        );
        expect(mergeExtendedBars(regular, undefined, '5Min').displayBars).toBe(
            regular
        );
        expect(mergeExtendedBars(regular, [], '5Min').displayBars).toBe(
            regular
        );
        // 전부 걸러져도 마찬가지
        const onlyRegularOverlap = [synthetic('2026-10-14T14:00:00Z')];
        const merged = mergeExtendedBars(regular, onlyRegularOverlap, '5Min');
        expect(merged.displayBars).toBe(regular);
        expect(merged.extendedBars).toEqual([]);
    });

    it('정규 봉이 없으면 아무것도 얹지 않는다', () => {
        const ext = [synthetic('2026-10-14T12:00:00Z')];
        const merged = mergeExtendedBars([], ext, '5Min');
        expect(merged.displayBars).toEqual([]);
        expect(merged.extendedBars).toEqual([]);
    });
});

describe('filterOutOfSessionBars', () => {
    it('5분봉 한 거래일 192개에서 정규장 78개를 빼 114개를 남긴다(Redis에 넣는 형태)', async () => {
        const extended = await barsFrom(extended5Min, '5Min', true);
        const kept = filterOutOfSessionBars(extended, '5Min');
        expect(extended).toHaveLength(192);
        expect(kept).toHaveLength(114);
        expect(labels(kept).at(0)).toBe('04:00');
        expect(labels(kept)).not.toContain('09:30');
        expect(labels(kept)).not.toContain('15:55');
    });
});

describe('buildExtendedSessionRanges — 음영 구간', () => {
    it('하루 5분봉은 프리(04:00~09:25)와 애프터(16:00~19:55) 두 구간이다', async () => {
        const regular = await barsFrom(regular5Min, '5Min', false);
        const extended = await barsFrom(extended5Min, '5Min', true);
        const { extendedBars } = mergeExtendedBars(regular, extended, '5Min');
        const ranges = buildExtendedSessionRanges(extendedBars, '5Min');

        expect(
            ranges.map(r => [
                r.session,
                etLabel(r.startTime),
                etLabel(r.endTime),
            ])
        ).toEqual([
            ['pre', '04:00', '09:25'],
            ['after', '16:00', '19:55'],
        ]);
    });

    it('반장일은 애프터 구간이 13:00에 시작한다', async () => {
        const regular = await barsFrom(regular1HourEarly, '1Hour', false);
        const extended = await barsFrom(extended1HourEarly, '1Hour', true);
        const { extendedBars } = mergeExtendedBars(regular, extended, '1Hour');
        const ranges = buildExtendedSessionRanges(extendedBars, '1Hour');

        expect(
            ranges.map(r => [
                r.session,
                etLabel(r.startTime),
                etLabel(r.endTime),
            ])
        ).toEqual([
            ['pre', '04:00', '08:00'],
            ['after', '13:00', '16:00'],
        ]);
    });

    it('서머타임 전환 주(금 EST → 월 EDT)에도 거래일마다 프리·애프터로 나뉜다', () => {
        const interval = '1Hour' as const;
        const bars = [
            synthetic('2026-03-06T09:00:00Z'), // 금 04:00 EST 프리
            synthetic('2026-03-06T13:00:00Z'), // 금 08:00 EST 프리
            synthetic('2026-03-06T21:00:00Z'), // 금 16:00 EST 애프터
            synthetic('2026-03-06T23:00:00Z'), // 금 18:00 EST 애프터
            synthetic('2026-03-09T08:00:00Z'), // 월 04:00 EDT 프리
            synthetic('2026-03-09T12:00:00Z'), // 월 08:00 EDT 프리
            synthetic('2026-03-09T20:00:00Z'), // 월 16:00 EDT 애프터
        ];
        const ranges = buildExtendedSessionRanges(bars, interval);

        expect(
            ranges.map(r => [
                r.session,
                etLabel(r.startTime),
                etLabel(r.endTime),
            ])
        ).toEqual([
            ['pre', '04:00', '08:00'],
            ['after', '16:00', '18:00'],
            ['pre', '04:00', '08:00'],
            ['after', '16:00', '16:00'],
        ]);
    });

    it('정규장 봉이 섞여 있어도 건너뛴다', () => {
        const ranges = buildExtendedSessionRanges(
            [
                synthetic('2026-10-14T12:55:00Z'),
                synthetic('2026-10-14T13:30:00Z'),
            ],
            '5Min'
        );
        expect(ranges).toHaveLength(1);
        expect(ranges[0]!.startTime).toBe(utc('2026-10-14T12:55:00Z'));
    });

    it('확장 봉이 없으면 구간이 없다', () => {
        expect(buildExtendedSessionRanges([], '5Min')).toEqual([]);
    });
});

describe('classifyExtendedBar — 휴장일 폴백', () => {
    it('휴장일(추수감사절) 낮 시각은 정규 마감으로 폴백해 정규장으로 본다(마감 0으로 읽어 애프터로 분류하지 않는다)', () => {
        // 2026-11-26 12:00 EST = 17:00Z
        expect(
            classifyExtendedBar(
                utc('2026-11-26T17:00:00Z'),
                EXTENDED_BAR_INTERVAL_SECONDS['5Min']
            )
        ).toBeNull();
        // 마감 16:00 이후는 폴백 마감 기준으로 애프터
        expect(
            classifyExtendedBar(
                utc('2026-11-26T21:00:00Z'),
                EXTENDED_BAR_INTERVAL_SECONDS['5Min']
            )
        ).toBe('after');
    });

    it('반장일은 애프터 종료(17:00) 이후 시작하는 봉을 확장 세션 밖으로 본다', () => {
        const interval = EXTENDED_BAR_INTERVAL_SECONDS['5Min'];
        // 2026-11-27 16:55 EST = 21:55Z (애프터), 17:00 EST = 22:00Z (종료)
        expect(classifyExtendedBar(utc('2026-11-27T21:55:00Z'), interval)).toBe(
            'after'
        );
        expect(
            classifyExtendedBar(utc('2026-11-27T22:00:00Z'), interval)
        ).toBeNull();
        // 정규 마감일은 17:00에도 애프터다
        expect(classifyExtendedBar(utc('2026-10-14T21:00:00Z'), interval)).toBe(
            'after'
        );
    });
});

describe('etDayOfBar', () => {
    it('ET 자정을 기준으로 날을 센다(UTC 날짜와 다르다)', () => {
        // 2026-10-14 23:55 ET = 10-15 03:55Z — UTC 날짜는 하루 뒤지만 ET로는 같은 날
        expect(etDayOfBar(utc('2026-10-15T03:55:00Z'))).toBe(
            etDayOfBar(utc('2026-10-14T12:00:00Z'))
        );
        expect(etDayOfBar(utc('2026-10-15T04:00:00Z'))).toBe(
            etDayOfBar(utc('2026-10-14T12:00:00Z')) + 1
        );
    });
});

describe('extendedTailTtlSeconds', () => {
    const LIVE = 60;
    const at = (iso: string): number =>
        extendedTailTtlSeconds(new Date(iso), LIVE);

    it('거래일 04:00~20:00 ET는 live TTL(프리·정규·애프터 모두)', () => {
        expect(at('2026-06-30T08:00:00Z')).toBe(LIVE); // 04:00 EDT
        expect(at('2026-06-30T15:00:00Z')).toBe(LIVE); // 11:00 EDT
        expect(at('2026-06-30T23:59:00Z')).toBe(LIVE); // 19:59 EDT
    });

    it('20:00 ET 이후는 다음 거래일 04:00 ET까지(최대 24시간)', () => {
        // 06-30 22:00 EDT → 07-01 04:00 EDT = 6시간
        expect(at('2026-07-01T02:00:00Z')).toBe(6 * SECONDS_PER_HOUR);
    });

    it('거래일 04:00 이전은 그날 04:00 ET까지', () => {
        // 07-01 01:00 EDT → 04:00 EDT = 3시간
        expect(at('2026-07-01T05:00:00Z')).toBe(3 * SECONDS_PER_HOUR);
    });

    it('주말·휴장일 직전 저녁은 24시간으로 상한한다', () => {
        // 2026-07-02(목) 22:00 EDT — 07-03(금)은 독립기념일 대체 휴장, 다음 거래일은 월요일
        expect(at('2026-07-03T02:00:00Z')).toBe(SECONDS_PER_DAY);
    });

    it('서머타임 전환(일요일 02:00)을 넘겨도 다음 거래일 04:00 ET 기준이다', () => {
        // 2026-03-08(일) 23:00 EDT(= 03-09 03:00Z) → 월 04:00 EDT(08:00Z) = 5시간
        expect(at('2026-03-09T03:00:00Z')).toBe(5 * SECONDS_PER_HOUR);
    });

    it('반장일(2026-11-27)은 17:00 ET에 애프터가 끝나 그 뒤로는 라이브 TTL이 아니다(20:00까지 라이브로 보지 않는다)', () => {
        // 16:30 ET = 21:30Z — 반장일 애프터마켓 안(마감 13:00, 종료 17:00)
        expect(at('2026-11-27T21:30:00Z')).toBe(LIVE);
        // 17:30 ET = 22:30Z — 반장일 애프터 종료 후. 다음 거래일(월) 04:00까지라 24시간 상한
        expect(at('2026-11-27T22:30:00Z')).toBe(SECONDS_PER_DAY);
    });

    it('토요일 10:00 ET는 04:00~20:00 안이어도 거래일이 아니라 라이브가 아니다(월요일 04:00까지, 24시간 상한)', () => {
        // 2026-10-17(토) 10:00 EDT = 14:00Z
        expect(at('2026-10-17T14:00:00Z')).toBe(SECONDS_PER_DAY);
    });

    it('휴장일(추수감사절) 낮도 라이브가 아니다(다음 거래일 금요일 04:00 ET까지 17시간)', () => {
        // 11:00 EST → 금 04:00 EST
        expect(at('2026-11-26T16:00:00Z')).toBe(17 * SECONDS_PER_HOUR);
    });

    it('live TTL보다 짧아지지 않는다', () => {
        // 03:59:30 ET → 04:00까지 30초지만 하한은 live TTL
        expect(at('2026-07-01T07:59:30Z')).toBe(LIVE);
    });
});
