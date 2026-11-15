import { describe, expect, it } from 'vitest';
import {
    macroChanges,
    macroRange52w,
} from '@/app/api/ai/chat/tools/macroQuoteMath';
import type { YahooDailyClose } from '@/shared/api/yahoo/yahooMacroSource';

const row = (
    date: string,
    close: number,
    high: number | null = close,
    low: number | null = close
): YahooDailyClose => ({ date, close, high, low });

describe('macroChanges', () => {
    const rows = [
        row('2025-11-12', 50),
        row('2025-11-14', 60), // 금요일 — 2025-11-15(토)·16(일) 기준일은 이 행
        row('2026-02-13', 70), // 3개월 전 2026-02-15(일) → 직전 거래일
        row('2026-10-14', 80), // 1개월 전 2026-10-15
        row('2026-11-06', 85), // 1주 전 2026-11-08(일) → 직전 거래일
        row('2026-11-13', 90),
    ];

    it('기준일 이전(포함) 마지막 거래일 종가로 현재가 대비를 계산한다', () => {
        const c = macroChanges(99, '2026-11-15', rows);
        expect(c['1week']).toEqual({
            baseDate: '2026-11-06',
            baseClose: 85,
            pct: 16.4706,
        });
        expect(c['1month']).toMatchObject({
            baseDate: '2026-10-14',
            baseClose: 80,
        });
        expect(c['3months']).toMatchObject({
            baseDate: '2026-02-13',
            baseClose: 70,
        });
        expect(c['1year']).toMatchObject({
            baseDate: '2025-11-14',
            baseClose: 60,
        });
        expect(c['1year']?.pct).toBeCloseTo(65, 5);
    });

    it('기준일 당일 행은 포함한다', () => {
        const c = macroChanges(100, '2026-11-15', [
            row('2026-11-08', 80),
            row('2026-11-09', 90),
        ]);
        expect(c['1week']).toMatchObject({
            baseDate: '2026-11-08',
            baseClose: 80,
        });
    });

    it('일봉이 기준일까지 거슬러 올라가지 않으면 그 칸만 null', () => {
        const c = macroChanges(99, '2026-11-15', [
            row('2026-11-06', 85),
            row('2026-11-13', 90),
        ]);
        expect(c['1week']).not.toBeNull();
        expect(c['1month']).toBeNull();
        expect(c['3months']).toBeNull();
        expect(c['1year']).toBeNull();
    });

    it('빈 일봉이면 전부 null', () => {
        expect(macroChanges(1, '2026-11-15', [])).toEqual({
            '1week': null,
            '1month': null,
            '3months': null,
            '1year': null,
        });
    });

    it('말일 보정: 3월 31일의 1개월 전은 2월 말일 이전', () => {
        const c = macroChanges(10, '2026-03-31', [
            row('2026-02-27', 5),
            row('2026-03-02', 8),
        ]);
        expect(c['1month']).toMatchObject({ baseDate: '2026-02-27' });
    });

    it('기준 종가가 0이면 pct는 null(0으로 나누지 않는다)', () => {
        const c = macroChanges(10, '2026-11-15', [row('2026-11-06', 0)]);
        expect(c['1week']).toMatchObject({ baseClose: 0, pct: null });
    });
});

describe('macroRange52w', () => {
    it('행의 high/low로 고저와 날짜, 현재가의 거리를 구한다', () => {
        const r = macroRange52w(90, '2026-11-15', [
            row('2025-12-01', 70, 72, 68),
            row('2026-03-10', 100, 110, 95),
            row('2026-06-10', 80, 82, 60),
            row('2026-11-13', 88, 89, 87),
        ]);
        expect(r).toEqual({
            high: 110,
            highDate: '2026-03-10',
            low: 60,
            lowDate: '2026-06-10',
            fromHighPct: -18.1818,
            fromLowPct: 50,
        });
    });

    describe('현재가를 범위에 접어 넣는다(일봉은 1시간, 시세는 1분 캐시)', () => {
        const cached = [
            row('2026-03-10', 100, 110, 95),
            row('2026-06-10', 80, 82, 60),
        ];

        it('현재가가 캐시된 고가보다 높으면 고가=현재가, 날짜=시세 날짜, fromHighPct는 0', () => {
            const r = macroRange52w(120, '2026-11-15', cached)!;
            expect(r).toMatchObject({
                high: 120,
                highDate: '2026-11-15',
                low: 60,
                lowDate: '2026-06-10',
                fromHighPct: 0,
            });
            expect(r.fromLowPct).toBe(100);
        });

        it('현재가가 캐시된 저가보다 낮으면 저가=현재가, 날짜=시세 날짜, fromLowPct는 0', () => {
            const r = macroRange52w(50, '2026-11-15', cached)!;
            expect(r).toMatchObject({
                low: 50,
                lowDate: '2026-11-15',
                high: 110,
                highDate: '2026-03-10',
                fromLowPct: 0,
            });
            expect(r.fromHighPct).toBeLessThan(0);
        });

        it('현재가가 범위 안이면 일봉 값 그대로', () => {
            const r = macroRange52w(90, '2026-11-15', cached)!;
            expect(r).toMatchObject({
                high: 110,
                low: 60,
                highDate: '2026-03-10',
                lowDate: '2026-06-10',
            });
        });

        it('현재가가 고가와 정확히 같으면 날짜를 바꾸지 않는다', () => {
            expect(macroRange52w(110, '2026-11-15', cached)).toMatchObject({
                high: 110,
                highDate: '2026-03-10',
                fromHighPct: 0,
            });
        });

        it.each([120, 50, 90, 110, 60])(
            '현재가 %s에서도 fromHighPct <= 0 <= fromLowPct',
            price => {
                const r = macroRange52w(price, '2026-11-15', cached)!;
                expect(r.fromHighPct!).toBeLessThanOrEqual(0);
                expect(r.fromLowPct!).toBeGreaterThanOrEqual(0);
            }
        );

        it('일봉이 없으면 현재가만으로 범위를 만들지 않고 null', () => {
            expect(macroRange52w(100, '2026-11-15', [])).toBeNull();
        });
    });

    it('high/low가 null이면 종가로 대체한다', () => {
        const r = macroRange52w(50, '2026-11-15', [
            row('2026-05-01', 40, null, null),
            row('2026-06-01', 60, null, null),
        ]);
        expect(r).toMatchObject({
            high: 60,
            highDate: '2026-06-01',
            low: 40,
            lowDate: '2026-05-01',
        });
    });

    it('365일보다 오래된 행은 제외한다(경계일 포함)', () => {
        const r = macroRange52w(57, '2026-11-15', [
            row('2025-11-14', 999, 999, 1), // 366일 전 → 제외
            row('2025-11-15', 60, 61, 59), // 365일 전 → 포함
            row('2026-01-01', 55, 56, 54),
        ]);
        expect(r).toMatchObject({ high: 61, highDate: '2025-11-15', low: 54 });
    });

    it('구간에 행이 없으면 null', () => {
        expect(macroRange52w(1, '2026-11-15', [])).toBeNull();
        expect(
            macroRange52w(1, '2026-11-15', [row('2024-01-01', 5)])
        ).toBeNull();
    });

    it('같은 고가가 여러 날이면 가장 최근 날짜를 쓴다', () => {
        const r = macroRange52w(7, '2026-11-15', [
            row('2026-01-01', 5, 9, 5),
            row('2026-02-01', 5, 9, 5),
        ]);
        expect(r).toMatchObject({
            highDate: '2026-02-01',
            lowDate: '2026-02-01',
        });
    });
});
