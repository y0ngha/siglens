import { afterEach, describe, expect, it, vi } from 'vitest';
import { CRYPTO_SESSION, US_EQUITY_SESSION } from '@y0ngha/siglens-core';
import { KR_EQUITY_SESSION } from '@/shared/api/market/sessionSpecFor';
import {
    lastClosedSessionCloseUtc,
    lastClosedSessionDate,
} from '@/shared/lib/marketSessionDate';

/**
 * `lastClosedSessionDate(US_EQUITY_SESSION, …)`의 DST·주말·발행버퍼 경계 스위트.
 * `CachedMarketDataProvider`에서 순수 모듈(`shared/lib/marketSessionDate`)로 추출되며
 * 함께 이동했다 — 이제 bars EOD 캐시 키, 시장 공포·탐욕 fetch 경계, sitemap lastmod
 * 세 소비자가 이 함수를 공유하므로 provider 테스트에 묶여 있을 이유가 없다.
 */
describe('lastClosedSessionDate(US) — DST-aware key boundary', () => {
    afterEach(() => vi.useRealTimers());

    /**
     * Summer (EDT = UTC-4): market closes at 16:00 ET = 20:00 UTC
     * Winter (EST = UTC-5): market closes at 16:00 ET = 21:00 UTC
     */

    it('summer weekday DURING session (Mon 09:40 EDT = 13:40 UTC) → lastClosed = prev Friday', () => {
        // 2026-07-13 Monday 13:40Z = 09:40 EDT (summer, before 20:00Z close)
        const result = lastClosedSessionDate(
            US_EQUITY_SESSION,
            new Date('2026-07-13T13:40:00Z')
        );
        // Previous Friday
        expect(result).toBe('2026-07-10');
    });

    it('summer weekday AFTER close but WITHIN buffer (Mon 16:30 EDT = 20:30 UTC) → lastClosed = prev Friday', () => {
        // 2026-07-13 Monday 20:30Z = 16:30 EDT (summer, after close but within 4h buffer)
        // Buffer ends at 20:00 ET = 00:00 UTC Tue 7/14. Still within buffer → prev trading day.
        const result = lastClosedSessionDate(
            US_EQUITY_SESSION,
            new Date('2026-07-13T20:30:00Z')
        );
        expect(result).toBe('2026-07-10');
    });

    it('summer weekday AFTER close+buffer (Mon 20:30 EDT = 00:30 UTC Tue) → lastClosed = today (7/13)', () => {
        // 2026-07-14 00:30Z = 20:30 EDT Mon 7/13 (after close + 4h buffer)
        const result = lastClosedSessionDate(
            US_EQUITY_SESSION,
            new Date('2026-07-14T00:30:00Z')
        );
        expect(result).toBe('2026-07-13');
    });

    it('just after Friday close (Fri 16:01 EDT = 20:01 UTC) → lastClosed = prev Thursday (within buffer)', () => {
        // 2026-07-10 Friday 20:01Z = 16:01 EDT (summer, within 4h buffer)
        // Buffer ends at 20:00 ET = 00:00 UTC Sat 7/11. Still within buffer → prev trading day.
        const result = lastClosedSessionDate(
            US_EQUITY_SESSION,
            new Date('2026-07-10T20:01:00Z')
        );
        expect(result).toBe('2026-07-09');
    });

    it('Saturday (after Fri close) → lastClosed = Friday', () => {
        // 2026-07-11 Saturday 12:00Z
        const result = lastClosedSessionDate(
            US_EQUITY_SESSION,
            new Date('2026-07-11T12:00:00Z')
        );
        expect(result).toBe('2026-07-10');
    });

    it('Sunday → lastClosed = previous Friday', () => {
        // 2026-07-12 Sunday 12:00Z
        const result = lastClosedSessionDate(
            US_EQUITY_SESSION,
            new Date('2026-07-12T12:00:00Z')
        );
        expect(result).toBe('2026-07-10');
    });

    it('winter (EST) after close but WITHIN buffer (Mon 16:30 EST = 21:30 UTC) → lastClosed = prev Friday', () => {
        // 2026-01-12 Monday 21:30Z = 16:30 EST (winter, after close but within 4h buffer)
        // Buffer ends at 20:00 ET = 01:00 UTC Tue 1/13. Still within buffer → prev trading day.
        const result = lastClosedSessionDate(
            US_EQUITY_SESSION,
            new Date('2026-01-12T21:30:00Z')
        );
        expect(result).toBe('2026-01-09');
    });

    it('winter (EST) after close+buffer (Mon 20:30 EST = 01:30 UTC Tue) → lastClosed = today (1/12)', () => {
        // 2026-01-13 01:30Z = 20:30 EST Mon 1/12 (after close + 4h buffer)
        const result = lastClosedSessionDate(
            US_EQUITY_SESSION,
            new Date('2026-01-13T01:30:00Z')
        );
        expect(result).toBe('2026-01-12');
    });

    it('winter (EST) BEFORE close (Mon 15:30 EST = 20:30 UTC) → lastClosed = prev Friday', () => {
        // 2026-01-12 Monday 20:30Z = 15:30 EST (winter, before 21:00Z close)
        // This proves DST: 20:30 UTC is after close in summer but BEFORE close in winter
        const result = lastClosedSessionDate(
            US_EQUITY_SESSION,
            new Date('2026-01-12T20:30:00Z')
        );
        expect(result).toBe('2026-01-09');
    });

    // ── EOD publish buffer boundary tests ────────────────────────────────
    // close=16:00 ET, buffer=4h → roll only at 20:00 ET
    it('[buffer] summer: 16:30 EDT (within buffer) → lastClosed = prev trading day (7/10)', () => {
        // 2026-07-13 Mon 20:30Z = 16:30 EDT — after close but before buffer end (20:00 ET = 00:00 UTC Tue)
        expect(
            lastClosedSessionDate(
                US_EQUITY_SESSION,
                new Date('2026-07-13T20:30:00Z')
            )
        ).toBe('2026-07-10');
    });

    it('[buffer] summer: 20:30 EDT (after buffer) → lastClosed = today (7/13)', () => {
        // 2026-07-14 00:30Z = 20:30 EDT Mon 7/13 — past close+buffer
        expect(
            lastClosedSessionDate(
                US_EQUITY_SESSION,
                new Date('2026-07-14T00:30:00Z')
            )
        ).toBe('2026-07-13');
    });

    it('[buffer] summer during session: 09:40 EDT (7/13) → lastClosed = prev Friday (7/10)', () => {
        // 2026-07-13 Mon 13:40Z = 09:40 EDT — during regular session, not yet closed
        expect(
            lastClosedSessionDate(
                US_EQUITY_SESSION,
                new Date('2026-07-13T13:40:00Z')
            )
        ).toBe('2026-07-10');
    });

    it('[buffer] winter: 16:30 EST (within buffer) → lastClosed = prev Friday (1/09)', () => {
        // 2026-01-12 Mon 21:30Z = 16:30 EST — after close but within buffer (buffer ends 01:00 UTC Tue)
        expect(
            lastClosedSessionDate(
                US_EQUITY_SESSION,
                new Date('2026-01-12T21:30:00Z')
            )
        ).toBe('2026-01-09');
    });

    it('[buffer] winter: 20:30 EST (after buffer) → lastClosed = today (1/12)', () => {
        // 2026-01-13 01:30Z = 20:30 EST Mon 1/12 — past close+buffer
        expect(
            lastClosedSessionDate(
                US_EQUITY_SESSION,
                new Date('2026-01-13T01:30:00Z')
            )
        ).toBe('2026-01-12');
    });
});

/**
 * `lastClosedSessionCloseUtc` — 위 세션 날짜에 그 날짜의 ET 오프셋을 적용한 마감 순간.
 * sitemap `lastmod`가 쓰는 값이라, 주말·DST가 실제로 반영되는지 못박는다.
 */
describe('lastClosedSessionCloseUtc', () => {
    it('여름(EDT) 세션은 20:00 UTC 마감으로 나온다', () => {
        // 2026-07-14 00:30Z = 20:30 EDT Mon 7/13 (마감+버퍼 경과) → 세션 7/13
        expect(
            lastClosedSessionCloseUtc(
                US_EQUITY_SESSION,
                new Date('2026-07-14T00:30:00Z')
            ).toISOString()
        ).toBe('2026-07-13T20:00:00.000Z');
    });

    it('겨울(EST) 세션은 21:00 UTC 마감으로 나온다', () => {
        // 2026-01-13 01:30Z = 20:30 EST Mon 1/12 (마감+버퍼 경과) → 세션 1/12
        expect(
            lastClosedSessionCloseUtc(
                US_EQUITY_SESSION,
                new Date('2026-01-13T01:30:00Z')
            ).toISOString()
        ).toBe('2026-01-12T21:00:00.000Z');
    });

    it('토요일 늦은 시각에도 열리지 않은 토요일 마감을 만들지 않는다 (직전 금요일)', () => {
        // 회귀 가드: 예전 buildPopularEntries는 토 20:00 UTC 이후 크롤되면
        // "토요일 20:00 UTC"를 lastmod로 발행했다 — 장이 열리지도 않은 날이다.
        const sat = lastClosedSessionCloseUtc(
            US_EQUITY_SESSION,
            new Date('2026-07-11T23:00:00Z')
        );
        expect(sat.toISOString()).toBe('2026-07-10T20:00:00.000Z');
        expect(sat.getUTCDay()).toBe(5); // Friday
    });

    it('일요일도 직전 금요일 마감으로 되감는다', () => {
        const sun = lastClosedSessionCloseUtc(
            US_EQUITY_SESSION,
            new Date('2026-07-12T23:00:00Z')
        );
        expect(sun.getUTCDay()).toBe(5);
        expect(sun.toISOString()).toBe('2026-07-10T20:00:00.000Z');
    });

    it('같은 세션 안에서는 호출 시각이 달라도 같은 값을 준다 (슬라이딩 아님)', () => {
        const a = lastClosedSessionCloseUtc(
            US_EQUITY_SESSION,
            new Date('2026-07-11T00:05:00Z')
        );
        const b = lastClosedSessionCloseUtc(
            US_EQUITY_SESSION,
            new Date('2026-07-11T23:55:00Z')
        );
        expect(a.getTime()).toBe(b.getTime());
    });
});

/**
 * NYSE 거래소 캘린더 회귀 가드.
 *
 * 저장소 전체를 훑어보면 세션 판정을 태우는 날짜 리터럴이 **전부 비휴장일**이었고
 * 반장일 리터럴은 0건이었다(주석에 "DST 전환에서 먼 날짜"라는 의도가 적혀 있다).
 * 즉 휴장일 처리를 넣어도 빼도 기존 스위트는 똑같이 통과한다 — 이 describe가 그
 * 사각지대를 메운다. 날짜는 NYSE Group 발표 캘린더 기준이다.
 */
describe('lastClosedSessionDate — NYSE 휴장일/반장', () => {
    it('추수감사절(2026-11-26 목)은 마감이 지나도 lastClosed가 되지 않는다', () => {
        // 11/27 01:00Z = 11/26 20:00 EST — 평소라면 마감+버퍼 경과로 당일이 롤할 시각.
        expect(
            lastClosedSessionDate(
                US_EQUITY_SESSION,
                new Date('2026-11-27T01:00:00Z')
            )
        ).toBe('2026-11-25');
    });

    it('추수감사절 당일 정오에도 직전 거래일(11/25)을 가리킨다', () => {
        expect(
            lastClosedSessionDate(
                US_EQUITY_SESSION,
                new Date('2026-11-26T17:00:00Z')
            )
        ).toBe('2026-11-25');
    });

    it('반장(2026-11-27 금, 13:00 ET 마감) 12:50 ET는 아직 마감 전 → 11/25', () => {
        // 11/27 17:50Z = 12:50 EST. 휴장일(11/26)을 건너뛰고 11/25로 되감는다.
        expect(
            lastClosedSessionDate(
                US_EQUITY_SESSION,
                new Date('2026-11-27T17:50:00Z')
            )
        ).toBe('2026-11-25');
    });

    it('반장일은 13:00+4h=17:00 ET에 롤한다 — 16:00 기준이면 안 롤할 시각', () => {
        // 11/27 22:05Z = 17:05 EST. 정규 마감(16:00) 기준이면 20:00 ET가 되어야 롤하므로
        // 이 시각에 11/27이 나오는 것은 반장 마감(13:00)이 실제로 반영됐다는 뜻이다.
        expect(
            lastClosedSessionDate(
                US_EQUITY_SESSION,
                new Date('2026-11-27T22:05:00Z')
            )
        ).toBe('2026-11-27');
    });

    it('성금요일(2026-04-03)은 휴장 → 직전 목요일(04-02)', () => {
        expect(
            lastClosedSessionDate(
                US_EQUITY_SESSION,
                new Date('2026-04-04T01:00:00Z')
            )
        ).toBe('2026-04-02');
    });

    it('7/4가 토요일인 해의 7/3(금)은 반장이 아니라 전휴장 → 7/2', () => {
        // 2026-07-04는 토요일이라 7/3(금)이 관측 휴장이다. 2024-07-03은 반장이었던 것과 대비.
        expect(
            lastClosedSessionDate(
                US_EQUITY_SESSION,
                new Date('2026-07-04T01:00:00Z')
            )
        ).toBe('2026-07-02');
    });

    it('휴장일 마감 순간(lastmod)은 직전 거래일의 16:00 ET를 준다', () => {
        expect(
            lastClosedSessionCloseUtc(
                US_EQUITY_SESSION,
                new Date('2026-11-27T01:00:00Z')
            ).toISOString()
        ).toBe('2026-11-25T21:00:00.000Z');
    });

    it('반장일 마감 순간은 13:00 ET(18:00 UTC)다', () => {
        expect(
            lastClosedSessionCloseUtc(
                US_EQUITY_SESSION,
                new Date('2026-11-27T22:05:00Z')
            ).toISOString()
        ).toBe('2026-11-27T18:00:00.000Z');
    });
});

/**
 * **NYSE 휴장일이 KRX·크립토로 새지 않는지**가 이 변경의 최우선 위험이었다.
 *
 * 종전 `lastClosedSessionDateEt`는 ET 고정이라 한국 종목도 미국 달력으로 되감았다.
 * 거기에 휴장일 인식이 붙으면 추수감사절(KRX는 정상 개장)에 키가 11/25로 되감기고
 * `before=lastClosed`가 11/26 KRX 봉을 히스토리에서 잘라낸다 — 조용한 데이터 손실이다.
 */
describe('lastClosedSessionDate — KRX / 크립토 격리', () => {
    it('추수감사절에도 KRX는 그날을 마지막 마감 세션으로 본다', () => {
        // 11/27 01:00Z = 11/27 10:00 KST — KRX 11/26 세션(15:30 KST 마감)은 이미 끝났고
        // 마감+4h 버퍼(19:30 KST = 10:30 UTC 11/26)도 지났다.
        expect(
            lastClosedSessionDate(
                KR_EQUITY_SESSION,
                new Date('2026-11-27T01:00:00Z')
            )
        ).toBe('2026-11-26');
    });

    it('성금요일에도 KRX는 그날 거래한다', () => {
        // 2026-04-03(금) 성금요일. 04-04 01:00Z = 04-04 10:00 KST.
        expect(
            lastClosedSessionDate(
                KR_EQUITY_SESSION,
                new Date('2026-04-04T01:00:00Z')
            )
        ).toBe('2026-04-03');
    });

    it('KRX는 KST 마감+버퍼로 롤한다 — 미국 달력을 따르지 않는다', () => {
        // 11/26 10:00Z = 11/26 19:00 KST — 15:30 마감 + 4h 버퍼(19:30)가 아직 안 지났다.
        expect(
            lastClosedSessionDate(
                KR_EQUITY_SESSION,
                new Date('2026-11-26T10:00:00Z')
            )
        ).toBe('2026-11-25');
        // 30분 뒤 버퍼를 넘기면 당일로 롤한다.
        expect(
            lastClosedSessionDate(
                KR_EQUITY_SESSION,
                new Date('2026-11-26T10:35:00Z')
            )
        ).toBe('2026-11-26');
    });

    it('KRX 주말은 직전 금요일로 되감는다', () => {
        // 2026-11-29는 일요일.
        expect(
            lastClosedSessionDate(
                KR_EQUITY_SESSION,
                new Date('2026-11-29T05:00:00Z')
            )
        ).toBe('2026-11-27');
    });

    it('KRX 마감 순간은 15:30 KST(06:30 UTC)다 — DST 없음', () => {
        expect(
            lastClosedSessionCloseUtc(
                KR_EQUITY_SESSION,
                new Date('2026-11-27T01:00:00Z')
            ).toISOString()
        ).toBe('2026-11-26T06:30:00.000Z');
    });

    it('크립토는 요일·휴장일과 무관하게 항상 어제(UTC)다', () => {
        expect(
            lastClosedSessionDate(
                CRYPTO_SESSION,
                new Date('2026-11-26T17:00:00Z')
            )
        ).toBe('2026-11-25');
        // 일요일도 동일 — 주말 되감기 없음.
        expect(
            lastClosedSessionDate(
                CRYPTO_SESSION,
                new Date('2026-11-29T05:00:00Z')
            )
        ).toBe('2026-11-28');
    });
});

/**
 * KRX 휴장일 캘린더 회귀 가드 — SEO 감사에서 실측한 라이브 결함.
 *
 * `KR_EQUITY_SESSION`이 `closeMinuteFor` 없이 주말만 알던 시절, 2026-08-17(광복절
 * 대체공휴일, 월)이 평범한 평일로 오인되어 프로덕션 sitemap이 KR 비뉴스 URL 100개의
 * lastmod로 `2026-08-17T06:30:00.000Z`를 광고했다. 실제 마지막 개장은 08-14(금)
 * 이었다 — +3일 과잉 신선도 주장이 라이브에서 발생 중이었다.
 */
describe('lastClosedSessionDate — KRX 휴장일 캘린더', () => {
    it('2026-08-18(화)에는 08-17(광복절 대체공휴일)이 아니라 08-14(금)이 마지막 마감이다', () => {
        // 2026-08-18 02:00Z = 08-18 11:00 KST — 당일 마감(15:30) 전이라 전일부터
        // 되감는다: 08-17(휴장) → 08-16(일) → 08-15(토) → 08-14(금, 거래일).
        expect(
            lastClosedSessionDate(
                KR_EQUITY_SESSION,
                new Date('2026-08-18T02:00:00Z')
            )
        ).toBe('2026-08-14');
    });

    it('lastClosedSessionCloseUtc는 08-14 15:30 KST(06:30 UTC)를 준다 — 08-17이 아니다', () => {
        expect(
            lastClosedSessionCloseUtc(
                KR_EQUITY_SESSION,
                new Date('2026-08-18T02:00:00Z')
            ).toISOString()
        ).toBe('2026-08-14T06:30:00.000Z');
    });

    it('설 연휴 3일(02-16~18 월~수)을 건너뛰고 직전 거래일(02-13 금)로 되감는다', () => {
        expect(
            lastClosedSessionDate(
                KR_EQUITY_SESSION,
                new Date('2026-02-19T02:00:00Z')
            )
        ).toBe('2026-02-13');
    });

    it('추석 연휴(09-24~28 목~월, 대체공휴일 포함 주말 관통)를 건너뛰고 직전 거래일(09-23 수)로 되감는다', () => {
        // 2026-09-29 02:00Z = 09-29(화) 11:00 KST — 당일 마감 전이라 전일부터 되감는다:
        // 09-28(대체공휴일) → 09-27(일) → 09-26(토) → 09-25(추석) → 09-24(추석 연휴) → 09-23(수, 거래일).
        expect(
            lastClosedSessionDate(
                KR_EQUITY_SESSION,
                new Date('2026-09-29T02:00:00Z')
            )
        ).toBe('2026-09-23');
    });

    it('개천절 대체공휴일(10-05 월)이 끼면 lastClosedSessionCloseUtc는 직전 거래일(10-02 금) 마감을 준다', () => {
        // 2026-10-06 02:00Z = 10-06(화) 11:00 KST — 당일 마감 전이라 전일부터 되감는다:
        // 10-05(대체공휴일) → 10-04(일) → 10-03(토) → 10-02(금, 거래일). +3일 과잉 신선도
        // 회귀(08-17 사례)와 같은 형태의 연휴가 gazetted 목록으로도 막히는지 못박는다.
        expect(
            lastClosedSessionCloseUtc(
                KR_EQUITY_SESSION,
                new Date('2026-10-06T02:00:00Z')
            ).toISOString()
        ).toBe('2026-10-02T06:30:00.000Z');
    });
});

/**
 * 방어 분기와 DST 전환 경계 — 둘 다 이 모듈이 소유한 불변식이라 여기서 못박는다.
 */
describe('lastClosedSessionDate — 방어 분기 / DST 전환일', () => {
    /**
     * `MAX_REWIND_DAYS` 상한이 실제로 루프를 끝내는지 확인한다. 상한이 없으면 모든 날을
     * 휴장으로 판정하는 잘못된 스펙에서 무한 루프가 된다 — 그건 테스트가 아니라 행으로
     * 나타나므로, 이 케이스는 "값이 맞다"보다 "끝난다"가 본질이다.
     */
    it('모든 날이 휴장인 스펙에서도 되감기가 끝나고 결정적 값을 준다', () => {
        const alwaysClosed = {
            kind: 'scheduled',
            timeZone: 'America/New_York',
            openMinute: 570,
            closeMinute: 960,
            weekendDays: [0, 6],
            closeMinuteFor: () => 0,
        } as const;

        // 2026-07-14 00:30Z = 7/13(월) 20:30 EDT. closeMinute가 0이라 당일 롤이 없어
        // 7/12에서 시작해 10회 되감고, 상한 도달 후 마지막 감산까지 반영된 7/02가 나온다.
        const result = lastClosedSessionDate(
            alwaysClosed,
            new Date('2026-07-14T00:30:00Z')
        );
        expect(result).toBe('2026-07-02');
        // 같은 입력은 같은 값 — 상한 도달 경로도 결정적이어야 한다.
        expect(
            lastClosedSessionDate(
                alwaysClosed,
                new Date('2026-07-14T00:30:00Z')
            )
        ).toBe(result);
    });

    /**
     * NYSE 마감이 전환일 **양옆** 날짜에 붙는 경우. DST 오프셋 선택 자체는 검증하지만
     * 2-pass 보정 분기는 지나가지 않는다 — 그 분기는 아래 두 케이스가 맡는다.
     */
    it('봄 전환일(2026-03-08) 주변 마감은 EST/EDT 오프셋이 각각 맞다', () => {
        // 03-09 02:00Z = 3/8(일) 22:00 EDT. 3/8은 일요일이라 직전 금요일 3/6으로 되감고,
        // 그날은 아직 EST라 마감이 21:00 UTC다.
        expect(
            lastClosedSessionCloseUtc(
                US_EQUITY_SESSION,
                new Date('2026-03-09T02:00:00Z')
            ).toISOString()
        ).toBe('2026-03-06T21:00:00.000Z');
        // 전환 다음 거래일(3/9 월)은 EDT라 20:00 UTC로 나와야 한다.
        expect(
            lastClosedSessionCloseUtc(
                US_EQUITY_SESSION,
                new Date('2026-03-10T01:00:00Z')
            ).toISOString()
        ).toBe('2026-03-09T20:00:00.000Z');
    });

    it('가을 전환일(2026-11-01) 직후 거래일 마감은 EST 오프셋으로 21:00 UTC다', () => {
        // 11-03 01:30Z = 11/2(월) 20:30 EST — 마감(16:00)+버퍼(4h) 경과.
        expect(
            lastClosedSessionCloseUtc(
                US_EQUITY_SESSION,
                new Date('2026-11-03T01:30:00Z')
            ).toISOString()
        ).toBe('2026-11-02T21:00:00.000Z');
        // 전환 직전 거래일(10/30 금)은 아직 EDT라 20:00 UTC.
        expect(
            lastClosedSessionCloseUtc(
                US_EQUITY_SESSION,
                new Date('2026-11-01T12:00:00Z')
            ).toISOString()
        ).toBe('2026-10-30T20:00:00.000Z');
    });

    /**
     * `zonedWallClockToUtc`의 **2-pass 오프셋 보정**을 직접 겨냥한다.
     *
     * 1-pass는 "현지 벽시계를 UTC로 읽은 값"에서 오프셋을 재므로, 전환일 이른 아침
     * (대략 현지 02:00~07:00)에만 잘못된 쪽 오프셋을 집는다. 그 밖의 시각은 전환 전후
     * 어느 쪽으로 재도 같은 답이 나와, 마감이 12:00 이후인 실제 스펙(NYSE 16:00/13:00,
     * KRX 15:30, 정오 프로브)으로는 이 분기를 **절대 지나가지 않는다**.
     *
     * 그래서 마감이 그 창 안에 있는 합성 스펙을 쓴다. 두 번째 `zoneOffsetMs` 호출을
     * 지우면 두 단언 모두 정확히 한 시간씩 어긋난다.
     */
    const dstWindowSpec = (closeMinute: number) =>
        ({
            kind: 'scheduled',
            timeZone: 'America/New_York',
            openMinute: 0,
            closeMinute,
            // 전환일은 항상 일요일이라, 주말을 빼면 그 날짜가 세션 날짜로 뽑히지 않는다.
            weekendDays: [],
        }) as const;

    it('봄 전환일 현지 03:30(EDT로 넘어간 뒤)은 07:30 UTC다', () => {
        // 2026-03-08 02:00 EST에 시계가 03:00 EDT로 뛴다. 03:30은 EDT(UTC-4) 구간.
        // 1-pass는 전날 밤 EST(-5)를 집어 08:30Z로 한 시간 밀린다.
        expect(
            lastClosedSessionCloseUtc(
                dstWindowSpec(3 * 60 + 30),
                new Date('2026-03-08T17:00:00Z'), // 3/8 13:00 EDT — 전환 후, 마감 경과
                0
            ).toISOString()
        ).toBe('2026-03-08T07:30:00.000Z');
    });

    it('가을 전환일 현지 02:30(EST로 돌아온 뒤)은 07:30 UTC다', () => {
        // 2026-11-01 02:00 EDT에 시계가 01:00 EST로 되돌아간다. 02:30은 EST(UTC-5) 구간.
        // 1-pass는 전날 밤 EDT(-4)를 집어 06:30Z(=01:30 EST)로 한 시간 이르게 잡는다.
        expect(
            lastClosedSessionCloseUtc(
                dstWindowSpec(2 * 60 + 30),
                new Date('2026-11-01T17:00:00Z'), // 11/1 12:00 EST — 마감 경과
                0
            ).toISOString()
        ).toBe('2026-11-01T07:30:00.000Z');
    });

    it('KST는 DST가 없어 전환 주간에도 마감 오프셋이 고정이다', () => {
        // 2026-03-09(월) 10:00 KST = 03-09 01:00Z → 직전 마감 세션은 3/6(금).
        expect(
            lastClosedSessionCloseUtc(
                KR_EQUITY_SESSION,
                new Date('2026-03-09T01:00:00Z')
            ).toISOString()
        ).toBe('2026-03-06T06:30:00.000Z');
    });
});
