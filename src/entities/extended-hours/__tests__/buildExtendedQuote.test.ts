import { describe, it, expect } from 'vitest';
import {
    buildExtendedQuote,
    type ReferenceQuote,
} from '@/entities/extended-hours/lib/buildExtendedQuote';
import { extendedSessionAt } from '@/entities/extended-hours/lib/extendedSession';
import { parseAftermarketTrade } from '@/shared/api/fmp/FmpMarketProvider';
import type { ExtendedHoursTrade } from '@/shared/api/market/marketProvider.types';
import aftermarketTradeFixture from '@/shared/api/fmp/__tests__/fixtures/aftermarketTrade.aapl.json';
import quoteFixture from '@/shared/api/fmp/__tests__/fixtures/quote.aapl.preMarket.json';

/** 라이브 프로브(2026-10-15 07:07 ET)와 같은 시각 — 프리마켓. */
const PRE_NOW = new Date('2026-10-15T11:07:16Z');
/** 같은 날 17:00 ET — 애프터마켓. */
const AFTER_NOW = new Date('2026-10-15T21:00:00Z');

const realTrade = parseAftermarketTrade(aftermarketTradeFixture)!;
const realReference: ReferenceQuote = {
    price: quoteFixture[0]!.price,
    timestampSec: quoteFixture[0]!.timestamp,
};

function windowAt(now: Date) {
    const window = extendedSessionAt(now);
    if (window === null) throw new Error('fixture instant must be in session');
    return window;
}

describe('buildExtendedQuote — 프리마켓(기준 = 직전 세션 종가)', () => {
    it('실제 응답 형태(AAPL 346.38 vs 직전 종가 342.96)에서 등락을 계산한다', () => {
        const quote = buildExtendedQuote({
            window: windowAt(PRE_NOW),
            trade: realTrade,
            reference: realReference,
            nowMs: PRE_NOW.getTime(),
        });

        expect(quote).toMatchObject({
            session: 'pre-market',
            price: 346.38,
            referenceClose: 342.96,
            tradedAtMs: 1792062432000,
        });
        expect(quote?.change).toBeCloseTo(3.42, 10);
        expect(quote?.changePercent).toBeCloseTo((3.42 / 342.96) * 100, 10);
    });

    it('기준 종가가 오늘 날짜의 시세면(정규장이 이미 갱신) 직전 종가가 아니므로 null이다', () => {
        const todayReference: ReferenceQuote = {
            price: 345,
            timestampSec: Date.UTC(2026, 9, 15, 11, 0) / 1000,
        };

        expect(
            buildExtendedQuote({
                window: windowAt(PRE_NOW),
                trade: realTrade,
                reference: todayReference,
                nowMs: PRE_NOW.getTime(),
            })
        ).toBeNull();
    });

    it('월요일 프리마켓은 금요일 종가를 기준으로 받아들인다', () => {
        const mondayNow = new Date('2026-10-19T11:00:00Z'); // 월 07:00 EDT
        const mondayTrade: ExtendedHoursTrade = {
            price: 101,
            tradeSize: 1,
            timestampMs: mondayNow.getTime() - 60_000,
        };
        const fridayClose: ReferenceQuote = {
            price: 100,
            timestampSec: Date.UTC(2026, 9, 16, 20, 0, 1) / 1000,
        };

        const quote = buildExtendedQuote({
            window: windowAt(mondayNow),
            trade: mondayTrade,
            reference: fridayClose,
            nowMs: mondayNow.getTime(),
        });

        expect(quote?.referenceClose).toBe(100);
        expect(quote?.changePercent).toBeCloseTo(1, 10);
    });

    it('어제 애프터마켓 마지막 체결(이 세션 이전 시각)은 null이다', () => {
        const yesterdayTrade: ExtendedHoursTrade = {
            price: 345,
            tradeSize: 1,
            timestampMs: Date.UTC(2026, 9, 15, 0, 30), // 10/14 20:30 EDT
        };

        expect(
            buildExtendedQuote({
                window: windowAt(PRE_NOW),
                trade: yesterdayTrade,
                reference: realReference,
                nowMs: PRE_NOW.getTime(),
            })
        ).toBeNull();
    });
});

describe('buildExtendedQuote — 애프터마켓(기준 = 오늘 정규장 종가)', () => {
    const todayClose: ReferenceQuote = {
        price: 350,
        timestampSec: Date.UTC(2026, 9, 15, 20, 0, 1) / 1000,
    };
    const afterTrade: ExtendedHoursTrade = {
        price: 348.25,
        tradeSize: 20,
        timestampMs: Date.UTC(2026, 9, 15, 20, 55),
    };

    it('오늘 종가 대비 하락을 계산한다', () => {
        const quote = buildExtendedQuote({
            window: windowAt(AFTER_NOW),
            trade: afterTrade,
            reference: todayClose,
            nowMs: AFTER_NOW.getTime(),
        });

        expect(quote).toMatchObject({
            session: 'after-hours',
            price: 348.25,
            referenceClose: 350,
        });
        expect(quote?.change).toBeCloseTo(-1.75, 10);
        expect(quote?.changePercent).toBeCloseTo(-0.5, 10);
    });

    it('기준이 어제 종가면(오늘 시세가 아직 갱신 전) 틀린 등락을 보이지 않고 null이다', () => {
        expect(
            buildExtendedQuote({
                window: windowAt(AFTER_NOW),
                trade: afterTrade,
                reference: realReference, // 2026-10-14 16:00:01 ET
                nowMs: AFTER_NOW.getTime(),
            })
        ).toBeNull();
    });
});

describe('buildExtendedQuote — 기준 종가 증명', () => {
    it('애프터마켓: 마감 30초 전(15:59:30)에 캐시된 스냅샷은 종가가 아니라 null이다', () => {
        const preCloseSnapshot: ReferenceQuote = {
            price: 349.5,
            timestampSec: Date.UTC(2026, 9, 15, 19, 59, 30) / 1000,
        };
        const lateTrade: ExtendedHoursTrade = {
            price: 348,
            tradeSize: 1,
            timestampMs: Date.UTC(2026, 9, 15, 20, 0, 10),
        };
        const now = new Date('2026-10-15T20:00:30Z');

        expect(
            buildExtendedQuote({
                window: windowAt(now),
                trade: lateTrade,
                reference: preCloseSnapshot,
                nowMs: now.getTime(),
            })
        ).toBeNull();
    });

    it('애프터마켓: 허용 오차(10초) 안의 마감 직전 시각(15:59:55)은 받아들인다', () => {
        const now = new Date('2026-10-15T20:00:30Z');

        const quote = buildExtendedQuote({
            window: windowAt(now),
            trade: {
                price: 348,
                tradeSize: 1,
                timestampMs: Date.UTC(2026, 9, 15, 20, 0, 10),
            },
            reference: {
                price: 349.5,
                timestampSec: Date.UTC(2026, 9, 15, 19, 59, 55) / 1000,
            },
            nowMs: now.getTime(),
        });

        expect(quote?.referenceClose).toBe(349.5);
    });

    it('반장일 애프터마켓은 13:00 마감 기준으로 판정한다', () => {
        const now = new Date('2026-11-27T19:00:00Z'); // 14:00 EST, 반장일
        const trade: ExtendedHoursTrade = {
            price: 101,
            tradeSize: 1,
            timestampMs: Date.UTC(2026, 10, 27, 18, 30),
        };

        const atClose = buildExtendedQuote({
            window: windowAt(now),
            trade,
            reference: {
                price: 100,
                timestampSec: Date.UTC(2026, 10, 27, 18, 0, 1) / 1000,
            },
            nowMs: now.getTime(),
        });
        const atOldRegularCloseHour = buildExtendedQuote({
            window: windowAt(now),
            trade,
            reference: {
                price: 100,
                timestampSec: Date.UTC(2026, 10, 27, 17, 30) / 1000, // 12:30 — 마감 전
            },
            nowMs: now.getTime(),
        });

        expect(atClose?.referenceClose).toBe(100);
        expect(atOldRegularCloseHour).toBeNull();
    });

    it('프리마켓: 여러 거래일 묵은 스냅샷(10/9)은 직전 거래일(10/14)이 아니라 null이다', () => {
        const stale: ReferenceQuote = {
            price: 330,
            timestampSec: Date.UTC(2026, 9, 9, 20, 0, 1) / 1000,
        };

        expect(
            buildExtendedQuote({
                window: windowAt(PRE_NOW),
                trade: realTrade,
                reference: stale,
                nowMs: PRE_NOW.getTime(),
            })
        ).toBeNull();
    });

    it('프리마켓: 하루 전이라도 직전 거래일이 아니면 null이다(10/13은 10/14 이전)', () => {
        expect(
            buildExtendedQuote({
                window: windowAt(PRE_NOW),
                trade: realTrade,
                reference: {
                    price: 340,
                    timestampSec: Date.UTC(2026, 9, 13, 20, 0, 1) / 1000,
                },
                nowMs: PRE_NOW.getTime(),
            })
        ).toBeNull();
    });

    it('프리마켓: 노동절(9/7) 다음 화요일의 직전 거래일은 금요일(9/4)이다', () => {
        const now = new Date('2026-09-08T11:00:00Z'); // 화 07:00 EDT
        const trade: ExtendedHoursTrade = {
            price: 101,
            tradeSize: 1,
            timestampMs: now.getTime() - 60_000,
        };
        const at = (day: number) => ({
            price: 100,
            timestampSec: Date.UTC(2026, 8, day, 20, 0, 1) / 1000,
        });
        const build = (reference: ReferenceQuote) =>
            buildExtendedQuote({
                window: windowAt(now),
                trade,
                reference,
                nowMs: now.getTime(),
            });

        expect(build(at(4))?.referenceClose).toBe(100); // 금
        expect(build(at(3))).toBeNull(); // 목 — 한 거래일 더 묵음
        expect(build(at(7))).toBeNull(); // 휴장일 날짜는 거래일이 아니다
    });
});

describe('buildExtendedQuote — 입력 검증', () => {
    const window = windowAt(PRE_NOW);
    const nowMs = PRE_NOW.getTime();

    it('체결이나 기준이 없으면 null이다', () => {
        expect(
            buildExtendedQuote({
                window,
                trade: null,
                reference: realReference,
                nowMs,
            })
        ).toBeNull();
        expect(
            buildExtendedQuote({
                window,
                trade: realTrade,
                reference: null,
                nowMs,
            })
        ).toBeNull();
    });

    it('기준 시각이 없으면 직전/오늘 구분을 확인할 수 없어 null이다', () => {
        expect(
            buildExtendedQuote({
                window,
                trade: realTrade,
                reference: { price: 342.96 },
                nowMs,
            })
        ).toBeNull();
    });

    it.each([
        ['체결가 0', { ...realTrade, price: 0 }, realReference],
        ['체결가 NaN', { ...realTrade, price: Number.NaN }, realReference],
        ['기준가 0', realTrade, { ...realReference, price: 0 }],
        ['기준가 음수', realTrade, { ...realReference, price: -5 }],
    ])('%s → null (0으로 나누지 않는다)', (_label, trade, reference) => {
        expect(
            buildExtendedQuote({ window, trade, reference, nowMs })
        ).toBeNull();
    });

    it('세션 종료 시각 이후의 체결은 null이다', () => {
        expect(
            buildExtendedQuote({
                window,
                trade: { ...realTrade, timestampMs: window.endMs },
                reference: realReference,
                nowMs: window.endMs + 1000,
            })
        ).toBeNull();
    });

    it('시계 차이 허용치를 넘는 미래 체결은 null이다', () => {
        expect(
            buildExtendedQuote({
                window,
                trade: { ...realTrade, timestampMs: nowMs + 10 * 60_000 },
                reference: realReference,
                nowMs,
            })
        ).toBeNull();
    });

    it('시계 차이 허용치 안의 미세한 미래 체결은 받아들인다', () => {
        expect(
            buildExtendedQuote({
                window,
                trade: { ...realTrade, timestampMs: nowMs + 60_000 },
                reference: realReference,
                nowMs,
            })
        ).not.toBeNull();
    });

    it('결과는 직렬화 가능한 평범한 숫자만 담는다(Server Action 경계)', () => {
        const quote = buildExtendedQuote({
            window,
            trade: realTrade,
            reference: realReference,
            nowMs,
        });
        expect(JSON.parse(JSON.stringify(quote))).toEqual(quote);
    });
});
