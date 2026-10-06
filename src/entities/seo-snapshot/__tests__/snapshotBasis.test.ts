import { describe, expect, it } from 'vitest';
import { isSnapshotBasisStale, readSnapshotBasis } from '../lib/snapshotBasis';

const sec = (iso: string): number => Date.parse(iso) / 1000;

describe('readSnapshotBasis', () => {
    it('dataAsOf.barTime(초)을 ms로, analyzedAt을 ms로 읽는다', () => {
        const basis = readSnapshotBasis({
            dataAsOf: { barTime: sec('2026-10-02T00:00:00Z'), close: 123.4 },
            analyzedAt: '2026-10-02T21:00:00.000Z',
        });
        expect(basis).toEqual({
            barTimeMs: Date.parse('2026-10-02T00:00:00Z'),
            analyzedAtMs: Date.parse('2026-10-02T21:00:00Z'),
            close: 123.4,
        });
    });

    it('dataAsOf가 없으면(옛 core·옛 캐시) planCheck.currentPrice를 가격으로 쓴다', () => {
        expect(
            readSnapshotBasis({
                analyzedAt: '2026-10-02T21:00:00.000Z',
                planCheck: { currentPrice: 99.5 },
            })
        ).toEqual({
            barTimeMs: null,
            analyzedAtMs: Date.parse('2026-10-02T21:00:00Z'),
            close: 99.5,
        });
    });

    it('dataAsOf.close가 있으면 planCheck.currentPrice보다 우선한다', () => {
        expect(
            readSnapshotBasis({
                dataAsOf: { barTime: sec('2026-10-02T00:00:00Z'), close: 110 },
                planCheck: { currentPrice: 999 },
            }).close
        ).toBe(110);
    });

    it.each([
        null,
        undefined,
        'x',
        42,
        [],
        { dataAsOf: 'oops', analyzedAt: 5 },
        { dataAsOf: { barTime: 'a', close: -1 }, analyzedAt: 'not a date' },
    ])('모양이 맞지 않으면 던지지 않고 전부 null: %j', content => {
        expect(readSnapshotBasis(content)).toEqual({
            barTimeMs: null,
            analyzedAtMs: null,
            close: null,
        });
    });
});

describe('isSnapshotBasisStale — 주식', () => {
    // 금요일 2026-10-02 EDT 마감 20:00Z가 경계. now는 그 뒤 월요일 새벽.
    const now = new Date('2026-10-05T04:30:00Z');

    it('분석이 마감 경계 이전(장중)에 실행됐고 barTime이 없으면 stale', () => {
        expect(
            isSnapshotBasisStale(
                'AAPL',
                {
                    barTimeMs: null,
                    analyzedAtMs: Date.parse('2026-10-02T18:00:00Z'),
                    close: null,
                },
                now
            )
        ).toBe(true);
    });

    it('분석이 경계 이후면 fresh', () => {
        expect(
            isSnapshotBasisStale(
                'AAPL',
                {
                    barTimeMs: null,
                    analyzedAtMs: Date.parse('2026-10-02T20:01:00Z'),
                    close: null,
                },
                now
            )
        ).toBe(false);
    });

    it('barTime이 직전 완료 세션 봉이면 fresh(분석 시각이 경계 전이어도 barTime이 우선)', () => {
        expect(
            isSnapshotBasisStale(
                'AAPL',
                {
                    barTimeMs: Date.parse('2026-10-02T00:00:00Z'),
                    analyzedAtMs: Date.parse('2026-10-02T18:00:00Z'),
                    close: null,
                },
                now
            )
        ).toBe(false);
    });

    it('barTime이 한 세션 이전 봉이면 stale(데이터 미발행)', () => {
        expect(
            isSnapshotBasisStale(
                'AAPL',
                {
                    barTimeMs: Date.parse('2026-10-01T00:00:00Z'),
                    analyzedAtMs: Date.parse('2026-10-02T21:00:00Z'),
                    close: null,
                },
                now
            )
        ).toBe(true);
    });

    it('KR: KST 자정 시작 봉(전날 15:00Z)도 직전 세션 봉으로 인정한다', () => {
        // KRX 금요일 10-02 마감 06:30Z → 경계 07:00Z. 봉 시작 10-01T15:00Z(= 10-02 00:00 KST).
        expect(
            isSnapshotBasisStale(
                '005930.KS',
                {
                    barTimeMs: Date.parse('2026-10-01T15:00:00Z'),
                    analyzedAtMs: null,
                    close: null,
                },
                new Date('2026-10-02T09:00:00Z')
            )
        ).toBe(false);
        expect(
            isSnapshotBasisStale(
                '005930.KS',
                {
                    barTimeMs: Date.parse('2026-09-30T15:00:00Z'),
                    analyzedAtMs: null,
                    close: null,
                },
                new Date('2026-10-02T09:00:00Z')
            )
        ).toBe(true);
    });

    it('근거가 없으면 stale이 아니다(모르는 것을 재생성하지 않는다)', () => {
        expect(
            isSnapshotBasisStale(
                'AAPL',
                { barTimeMs: null, analyzedAtMs: null, close: null },
                now
            )
        ).toBe(false);
    });
});

describe('isSnapshotBasisStale — 크립토', () => {
    const now = new Date('2026-10-05T09:00:00Z'); // 경계 = 10-05 00:30Z

    it('형성 중인 오늘 일봉(00:00Z 시작)은 현재로 센다', () => {
        expect(
            isSnapshotBasisStale(
                'BTCUSD',
                {
                    barTimeMs: Date.parse('2026-10-05T00:00:00Z'),
                    analyzedAtMs: Date.parse('2026-10-05T00:10:00Z'), // 경계(00:30Z) 이전에 분석
                    close: null,
                },
                now
            )
        ).toBe(false);
    });

    it('어제 일봉이 마지막 봉이면 stale', () => {
        expect(
            isSnapshotBasisStale(
                'BTCUSD',
                {
                    barTimeMs: Date.parse('2026-10-04T00:00:00Z'),
                    analyzedAtMs: Date.parse('2026-10-04T23:50:00Z'),
                    close: null,
                },
                now
            )
        ).toBe(true);
    });

    it('어제 일봉이라도 분석이 오늘 00:00Z 이후면(완료 봉 기준) 현재로 센다', () => {
        // 2026-10-06 운영: FMP가 자정 직후 오늘 봉을 내지 않아 강제 재생성 결과가 어제
        // 완료 봉을 썼다 — 페이지 상단 "최근 종가"와 같은 가격이라 stale이 아니다.
        expect(
            isSnapshotBasisStale(
                'BTCUSD',
                {
                    barTimeMs: Date.parse('2026-10-04T00:00:00Z'),
                    analyzedAtMs: Date.parse('2026-10-05T00:55:00Z'),
                    close: null,
                },
                now
            )
        ).toBe(false);
    });

    it('어제 일봉인데 실행 시각을 모르면 stale', () => {
        expect(
            isSnapshotBasisStale(
                'BTCUSD',
                {
                    barTimeMs: Date.parse('2026-10-04T00:00:00Z'),
                    analyzedAtMs: null,
                    close: null,
                },
                now
            )
        ).toBe(true);
    });

    it('이틀 전 일봉은 오늘 실행됐어도 stale', () => {
        expect(
            isSnapshotBasisStale(
                'BTCUSD',
                {
                    barTimeMs: Date.parse('2026-10-03T00:00:00Z'),
                    analyzedAtMs: Date.parse('2026-10-05T01:00:00Z'),
                    close: null,
                },
                now
            )
        ).toBe(true);
    });

    it('barTime이 없으면 analyzedAt이 경계(00:30Z) 이전이면 stale', () => {
        expect(
            isSnapshotBasisStale(
                'BTCUSD',
                {
                    barTimeMs: null,
                    analyzedAtMs: Date.parse('2026-10-04T23:50:00Z'),
                    close: null,
                },
                now
            )
        ).toBe(true);
        expect(
            isSnapshotBasisStale(
                'BTCUSD',
                {
                    barTimeMs: null,
                    analyzedAtMs: Date.parse('2026-10-05T08:00:00Z'),
                    close: null,
                },
                now
            )
        ).toBe(false);
    });

    it('경계가 롤하기 전(00:10Z)에는 어제 00:00Z 봉이 기준 봉이다', () => {
        expect(
            isSnapshotBasisStale(
                'BTCUSD',
                {
                    barTimeMs: Date.parse('2026-10-04T00:00:00Z'),
                    analyzedAtMs: null,
                    close: null,
                },
                new Date('2026-10-05T00:10:00Z')
            )
        ).toBe(false);
    });

    it('경계 롤 전(00:10Z)에는 "오늘 00:00Z"가 전날 00:00Z다 — 10-03 봉도 그 뒤 실행분이면 fresh', () => {
        const preRoll = new Date('2026-10-05T00:10:00Z'); // 경계 = 10-04 00:30Z
        expect(
            isSnapshotBasisStale(
                'BTCUSD',
                {
                    barTimeMs: Date.parse('2026-10-03T00:00:00Z'),
                    analyzedAtMs: Date.parse('2026-10-04T18:00:00Z'),
                    close: null,
                },
                preRoll
            )
        ).toBe(false);
        expect(
            isSnapshotBasisStale(
                'BTCUSD',
                {
                    barTimeMs: Date.parse('2026-10-03T00:00:00Z'),
                    analyzedAtMs: Date.parse('2026-10-03T20:00:00Z'),
                    close: null,
                },
                preRoll
            )
        ).toBe(true);
    });

    it('analyzedAt 경계는 포함이다: 오늘 00:00:00.000Z면 fresh, 1ms 전이면 stale', () => {
        const yesterdayBar = Date.parse('2026-10-04T00:00:00Z');
        expect(
            isSnapshotBasisStale(
                'BTCUSD',
                {
                    barTimeMs: yesterdayBar,
                    analyzedAtMs: Date.parse('2026-10-05T00:00:00.000Z'),
                    close: null,
                },
                now
            )
        ).toBe(false);
        expect(
            isSnapshotBasisStale(
                'BTCUSD',
                {
                    barTimeMs: yesterdayBar,
                    analyzedAtMs: Date.parse('2026-10-04T23:59:59.999Z'),
                    close: null,
                },
                now
            )
        ).toBe(true);
    });
});
