import { describe, expect, it } from 'vitest';
import { CRYPTO_SESSION, US_EQUITY_SESSION } from '@y0ngha/siglens-core';
import type { MarketSessionSpec } from '@y0ngha/siglens-core';
import { KR_EQUITY_SESSION } from '@/shared/api/market/sessionSpecFor';
import {
    lastClosedSessionDate,
    secondsUntilSessionRoll,
} from '@/shared/lib/marketSessionDate';
import {
    MS_PER_MINUTE,
    MS_PER_SECOND,
    SECONDS_PER_HOUR,
} from '@/shared/config/time';

const hours = (h: number): number => h * SECONDS_PER_HOUR;

/**
 * 1년 표본 성질 테스트(한 달 분량 케이스)의 상한.
 *
 * 케이스마다 약 1,200개 시각 × `lastClosedSessionDate` 세 번(+ 롤 계산)을 돌리고,
 * 각 호출이 `Intl.DateTimeFormat#formatToParts`를 여러 번 탄다(포맷터는 이미 캐시돼
 * 있어 더 줄일 고정비가 없다). 단독으론 케이스당 0.3초 남짓, 병렬 전체 실행에선 최대
 * 1.3초, 무거운 가드와 한꺼번에 돌린 최악 부하에선 5.3초를 쟀다(2026-10-06). 1년
 * 한 덩어리일 땐 같은 부하에서 33.8초로 30초 상한을 넘겼다. 표본 밀도 자체가
 * 경계(휴장일·반장·DST) 검출력이라 간격을 넓히지 않고, 최악 실측의 두 배 가까이로
 * 상한을 둔다.
 */
const MONTH_SAMPLE_TIMEOUT_MS = 10_000;

describe('secondsUntilSessionRoll — 세션-날짜 키가 넘어가기까지', () => {
    it('미국 평일 장중: 그날 마감 16:00 EDT + 4h(= 다음날 00:00Z)까지', () => {
        // 2026-06-30(화) 15:00Z = 11:00 EDT → 롤 2026-07-01T00:00Z
        expect(
            secondsUntilSessionRoll(
                US_EQUITY_SESSION,
                new Date('2026-06-30T15:00:00Z')
            )
        ).toBe(hours(9));
    });

    it('미국 금요일 롤 이후: 주말을 넘어 월요일 마감 + 4h까지', () => {
        // 2026-07-11(토) 00:30Z = 금 20:30 EDT(롤 직후) → 월 07-13 20:00 EDT = 07-14T00:00Z
        expect(
            secondsUntilSessionRoll(
                US_EQUITY_SESSION,
                new Date('2026-07-11T00:30:00Z')
            )
        ).toBe(hours(71.5));
    });

    it('추수감사절: 수요일 롤 이후 → 목(휴장) 건너뛰고 금 반장 13:00 EST + 4h', () => {
        // 2026-11-26(목) 휴장, 11-27(금) 13:00 반장. 수 11-25 21:30 EST(롤 이후)
        // → 금 17:00 EST = 2026-11-27T22:00Z
        expect(
            secondsUntilSessionRoll(
                US_EQUITY_SESSION,
                new Date('2026-11-26T02:30:00Z')
            )
        ).toBe(hours(43.5));
    });

    it('DST 종료 주말: 금 롤 이후 → 월 16:00 EST + 4h(= 화 01:00Z)', () => {
        // 2026-11-01(일) DST 종료. 금 10-30 20:30 EDT = 10-31T00:30Z
        // → 월 11-02 20:00 EST = 2026-11-03T01:00Z
        expect(
            secondsUntilSessionRoll(
                US_EQUITY_SESSION,
                new Date('2026-10-31T00:30:00Z')
            )
        ).toBe(hours(72.5));
    });

    it('KRX 추석 연휴: 9/23 롤 이후 → 9/24·25·26·27·28 건너뛰고 9/29 마감 + 4h', () => {
        // 9/23(수) 19:30 KST 롤 직후(11:00Z) → 9/29(화) 19:30 KST = 2026-09-29T10:30Z
        // 7일 고정 TTL이면 연휴 끝 무렵 키가 먼저 사라졌을 구간이다.
        expect(
            secondsUntilSessionRoll(
                KR_EQUITY_SESSION,
                new Date('2026-09-23T11:00:00Z')
            )
        ).toBe(hours(143.5));
    });

    it('크립토(24/7): 다음 UTC 자정까지', () => {
        expect(
            secondsUntilSessionRoll(
                CRYPTO_SESSION,
                new Date('2026-06-30T15:00:00Z')
            )
        ).toBe(hours(9));
    });

    // 거래일을 하나도 못 찾는 잘못된 스펙: 무한 루프 없이 상한(10일)을 돌려준다.
    it('모든 날이 휴장인 스펙은 MAX_REWIND_DAYS(10일)를 돌려준다', () => {
        const alwaysClosed = {
            kind: 'scheduled',
            timeZone: 'America/New_York',
            openMinute: 570,
            closeMinute: 960,
            weekendDays: [0, 6],
            closeMinuteFor: () => 0,
        } as const;
        expect(
            secondsUntilSessionRoll(
                alwaysClosed,
                new Date('2026-07-14T00:30:00Z')
            )
        ).toBe(hours(24 * 10));
    });

    // 경계: 거래일이 정확히 상한 끝(오늘 + 9일)에만 있으면 그 날의 롤을 찾는다.
    it('거래일이 9일 뒤 하나뿐이면 그 날 마감 + 4h까지', () => {
        const onlyOneDay = {
            kind: 'scheduled',
            timeZone: 'UTC',
            openMinute: 0,
            closeMinute: 600,
            weekendDays: [],
            // 2026-07-23(UTC)만 10:00 마감, 나머지는 휴장
            closeMinuteFor: (at: Date) =>
                at.toISOString().startsWith('2026-07-23') ? 600 : 0,
        } as const;
        // 2026-07-14T00:00Z → 07-23 14:00Z = 9일 14시간
        expect(
            secondsUntilSessionRoll(
                onlyOneDay,
                new Date('2026-07-14T00:00:00Z')
            )
        ).toBe(hours(24 * 9 + 14));
    });

    // 성질: 롤 시각 직전까지는 lastClosed가 그대로, 직후에는 바뀐다. 같은 규칙을 두 번
    // 구현한 셈이므로 어긋나면(예: 휴장일·반장·DST 처리 누락) 여기서 드러난다.
    const SPECS: ReadonlyArray<[string, MarketSessionSpec]> = [
        ['US', US_EQUITY_SESSION],
        ['KR', KR_EQUITY_SESSION],
        ['crypto', CRYPTO_SESSION],
    ];
    // 1년 표본을 달 단위로 나눠 돈다 — 표본 시각은 예전 1년 한 덩어리와 정확히 같다
    // (1월 1일 00:00Z부터 37분 간격, 달 경계에서 끊기지 않고 이어진다). 한 덩어리일
    // 때는 스펙 하나가 단독 3초, 병렬 부하에선 30초를 넘겨 실패했다(2026-10-06).
    // 나누면 케이스당 일이 1/12이고, 실패도 어느 달인지 바로 보인다.
    const YEAR_START = Date.parse('2026-01-01T00:00:00Z');
    const SAMPLE_STEP_MS = 37 * MS_PER_MINUTE;
    const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
    const firstSampleAtOrAfter = (ms: number): number =>
        YEAR_START +
        Math.ceil((ms - YEAR_START) / SAMPLE_STEP_MS) * SAMPLE_STEP_MS;

    describe.each(SPECS)('%s', (_name, spec) => {
        it.each(MONTHS)(
            '2026년 %i월 표본에서 롤 1분 전엔 같은 날짜, 1분 후엔 다음 날짜',
            month => {
                // `Date.UTC`의 월은 0-기준이라 `month - 1`이 그 달 1일, `month`가 다음 달 1일.
                const start = firstSampleAtOrAfter(
                    Date.UTC(2026, month - 1, 1)
                );
                const end = Date.UTC(2026, month, 1);
                // 37분 간격 — 시·분 경계에 정렬되지 않게 해 마감·버퍼 경계 주변도 고르게 찍는다.
                for (let t = start; t < end; t += SAMPLE_STEP_MS) {
                    const now = new Date(t);
                    const current = lastClosedSessionDate(spec, now);
                    const rollMs =
                        t + secondsUntilSessionRoll(spec, now) * MS_PER_SECOND;
                    expect(
                        lastClosedSessionDate(
                            spec,
                            new Date(rollMs - MS_PER_MINUTE)
                        )
                    ).toBe(current);
                    expect(
                        lastClosedSessionDate(
                            spec,
                            new Date(rollMs + MS_PER_MINUTE)
                        )
                    ).not.toBe(current);
                }
            },
            MONTH_SAMPLE_TIMEOUT_MS
        );
    });
});
