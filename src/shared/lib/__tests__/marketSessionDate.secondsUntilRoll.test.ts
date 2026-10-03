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
    it.each(SPECS)(
        '%s: 2026년 전체 표본에서 롤 1분 전엔 같은 날짜, 1분 후엔 다음 날짜',
        (_name, spec) => {
            const start = Date.parse('2026-01-01T00:00:00Z');
            const end = Date.parse('2027-01-01T00:00:00Z');
            // 37분 간격 — 시·분 경계에 정렬되지 않게 해 마감·버퍼 경계 주변도 고르게 찍는다.
            for (let t = start; t < end; t += 37 * MS_PER_MINUTE) {
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
        // 1년치 표본(~1.4만 시각 × Intl 포맷)이라 병렬 실행 부하에서 기본 5초를 넘길 수 있다.
        30_000
    );
});
