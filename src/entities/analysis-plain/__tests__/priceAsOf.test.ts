import { CRYPTO_SESSION, US_EQUITY_SESSION } from '@y0ngha/siglens-core';
import { describe, expect, it } from 'vitest';
import { KR_EQUITY_SESSION } from '@/shared/api/market/sessionSpecFor';
import { buildDataAsOfLabel, buildPriceAsOf } from '../lib/priceAsOf';

/**
 * 평이화 글은 저장·색인되어 며칠 뒤에도 읽힌다. 가격 앞에 붙는 이 문구가 "지금" 대신
 * 값이 정해진 날짜를 말해 준다 — 날짜는 시장 현지 달력이어야 하고, 장중·마감·휴장·
 * 24시간 시장이 서로 다른 말로 나와야 한다.
 */
describe('buildPriceAsOf', () => {
    describe('미국 주식 (ET)', () => {
        it('장 마감 뒤에는 그날 종가다', () => {
            // 2026-09-29(화) 22:00 ET
            expect(
                buildPriceAsOf(
                    US_EQUITY_SESSION,
                    new Date('2026-09-30T02:00:00.000Z'),
                    'ko'
                )
            ).toBe('9월 29일 종가');
        });

        it('정규장 중에는 그날 장중이다', () => {
            // 2026-10-05(월) 11:00 ET
            expect(
                buildPriceAsOf(
                    US_EQUITY_SESSION,
                    new Date('2026-10-05T15:00:00.000Z'),
                    'ko'
                )
            ).toBe('10월 5일 장중');
        });

        it('개장 전에는 직전 거래일 종가다', () => {
            // 2026-10-06(화) 08:00 ET — 아직 열리지 않았다.
            expect(
                buildPriceAsOf(
                    US_EQUITY_SESSION,
                    new Date('2026-10-06T12:00:00.000Z'),
                    'ko'
                )
            ).toBe('10월 5일 종가');
        });

        it('마감 직후에도 하루 전이 아니라 그날 종가다 (EOD 발행 버퍼를 쓰지 않는다)', () => {
            // 2026-10-05(월) 16:05 ET
            expect(
                buildPriceAsOf(
                    US_EQUITY_SESSION,
                    new Date('2026-10-05T20:05:00.000Z'),
                    'ko'
                )
            ).toBe('10월 5일 종가');
        });

        it('주말에는 금요일 종가다', () => {
            // 2026-10-10(토)
            expect(
                buildPriceAsOf(
                    US_EQUITY_SESSION,
                    new Date('2026-10-10T15:00:00.000Z'),
                    'ko'
                )
            ).toBe('10월 9일 종가');
        });

        it('휴장일(추수감사절)에는 직전 거래일 종가다', () => {
            // 2026-11-26(목) 10:00 ET — NYSE 휴장
            expect(
                buildPriceAsOf(
                    US_EQUITY_SESSION,
                    new Date('2026-11-26T15:00:00.000Z'),
                    'ko'
                )
            ).toBe('11월 25일 종가');
        });

        it('날짜는 UTC가 아니라 ET 달력이다 — UTC로는 이미 다음 날인 장 마감 직후', () => {
            // 2026-09-30 01:00 UTC = 9월 29일 21:00 ET
            expect(
                buildPriceAsOf(
                    US_EQUITY_SESSION,
                    new Date('2026-09-30T01:00:00.000Z'),
                    'ko'
                )
            ).toBe('9월 29일 종가');
        });
    });

    describe('국내 주식 (KST)', () => {
        it('정규장 중에는 그날 장중이다', () => {
            // 2026-09-29(화) 10:00 KST
            expect(
                buildPriceAsOf(
                    KR_EQUITY_SESSION,
                    new Date('2026-09-29T01:00:00.000Z'),
                    'ko'
                )
            ).toBe('9월 29일 장중');
        });

        it('장 마감 뒤에는 그날 종가다 — 미국 달력으로 되감기지 않는다', () => {
            // 2026-09-29(화) 16:00 KST
            expect(
                buildPriceAsOf(
                    KR_EQUITY_SESSION,
                    new Date('2026-09-29T07:00:00.000Z'),
                    'ko'
                )
            ).toBe('9월 29일 종가');
        });

        it('휴장일(광복절 대체공휴일)에는 직전 거래일 종가다', () => {
            // 2026-08-17(월) 12:00 KST — 대체공휴일
            expect(
                buildPriceAsOf(
                    KR_EQUITY_SESSION,
                    new Date('2026-08-17T03:00:00.000Z'),
                    'ko'
                )
            ).toBe('8월 14일 종가');
        });
    });

    describe('크립토 (24시간)', () => {
        it('마감이 없으므로 UTC 날짜만 쓴다', () => {
            expect(
                buildPriceAsOf(
                    CRYPTO_SESSION,
                    new Date('2026-10-05T23:30:00.000Z'),
                    'ko'
                )
            ).toBe('10월 5일 UTC');
        });

        it('UTC 자정을 넘기면 다음 날이다', () => {
            expect(
                buildPriceAsOf(
                    CRYPTO_SESSION,
                    new Date('2026-10-06T00:01:00.000Z'),
                    'ko'
                )
            ).toBe('10월 6일 UTC');
        });
    });

    describe('로케일', () => {
        const CLOSE = new Date('2026-09-30T02:00:00.000Z');
        const OPEN = new Date('2026-10-05T15:00:00.000Z');
        const NOW_UTC = new Date('2026-10-05T23:30:00.000Z');

        it.each([
            ['en', 'Sep 29 close', 'Oct 5 intraday', 'Oct 5 UTC'],
            ['ja', '9月29日 終値', '10月5日 場中', '10月5日 UTC'],
            ['zh', '9月29日 收盘价', '10月5日 盘中', '10月5日 UTC'],
            ['ko', '9월 29일 종가', '10월 5일 장중', '10월 5일 UTC'],
        ])('%s', (locale, close, intraday, utc) => {
            expect(buildPriceAsOf(US_EQUITY_SESSION, CLOSE, locale)).toBe(
                close
            );
            expect(buildPriceAsOf(US_EQUITY_SESSION, OPEN, locale)).toBe(
                intraday
            );
            expect(buildPriceAsOf(CRYPTO_SESSION, NOW_UTC, locale)).toBe(utc);
        });

        it('모르는 로케일은 한국어로 떨어진다', () => {
            expect(buildPriceAsOf(US_EQUITY_SESSION, CLOSE, 'xx')).toBe(
                '9월 29일 종가'
            );
        });
    });
});

/**
 * 세션 마감 전에 만든 분석이 마감 뒤에 재사용되면, 지금 시장 상태로 기준일을 고르는
 * `buildPriceAsOf`는 글의 가격(옛 봉 값)과 다른 날짜를 말한다. 분석이 밝힌 마지막 봉
 * (`dataAsOf.barTime`)에서 만든 문구는 가격이 속한 봉을 따른다.
 */
describe('buildDataAsOfLabel', () => {
    const sec = (iso: string): number => Date.parse(iso) / 1000;

    it('마감된 일봉(UTC 자정 시각)은 그 날짜의 종가다', () => {
        expect(
            buildDataAsOfLabel(
                US_EQUITY_SESSION,
                sec('2026-09-29T00:00:00.000Z'),
                new Date('2026-10-06T12:00:00.000Z'),
                'ko'
            )
        ).toBe('9월 29일 종가');
    });

    it('지금 시장 상태와 무관하게 봉의 날짜를 말한다 — 마감 전 분석을 며칠 뒤에 재사용해도', () => {
        const barTime = sec('2026-10-02T00:00:00.000Z');
        const now = new Date('2026-10-06T15:00:00.000Z'); // 정규장 중
        expect(buildPriceAsOf(US_EQUITY_SESSION, now, 'ko')).toBe(
            '10월 6일 장중'
        );
        expect(buildDataAsOfLabel(US_EQUITY_SESSION, barTime, now, 'ko')).toBe(
            '10월 2일 종가'
        );
    });

    /**
     * 세션 도중(11:00 ET)에 만든 분석의 그날 일봉 값은 형성 중인 값이다. 마감 뒤에 재사용돼도
     * 종가가 아니므로 `now`가 아니라 분석을 만든 시점(`analyzedAt`)으로 판정한다.
     */
    it('세션 도중에 만든 분석은 마감 뒤에 재사용돼도 그날 일봉을 장중으로 부른다', () => {
        const barTime = sec('2026-10-05T00:00:00.000Z');
        const afterClose = new Date('2026-10-06T12:00:00.000Z');
        expect(
            buildDataAsOfLabel(
                US_EQUITY_SESSION,
                barTime,
                afterClose,
                'ko',
                '2026-10-05T15:00:00.000Z'
            )
        ).toBe('10월 5일 장중');
        expect(
            buildDataAsOfLabel(
                US_EQUITY_SESSION,
                barTime,
                afterClose,
                'ko',
                '2026-10-05T21:30:00.000Z'
            )
        ).toBe('10월 5일 종가');
    });

    it('analyzedAt이 없거나 해석되지 않으면 지금 시각으로 판정한다', () => {
        const barTime = sec('2026-10-05T00:00:00.000Z');
        const afterClose = new Date('2026-10-06T12:00:00.000Z');
        for (const bad of [undefined, null, 'not-a-date', 123]) {
            expect(
                buildDataAsOfLabel(
                    US_EQUITY_SESSION,
                    barTime,
                    afterClose,
                    'ko',
                    bad
                )
            ).toBe('10월 5일 종가');
        }
    });

    it('이전 거래일 봉은 분석이 그다음 날 세션 도중에 만들어졌어도 종가다', () => {
        expect(
            buildDataAsOfLabel(
                US_EQUITY_SESSION,
                sec('2026-10-02T00:00:00.000Z'),
                new Date('2026-10-06T12:00:00.000Z'),
                'ko',
                '2026-10-05T15:00:00.000Z'
            )
        ).toBe('10월 2일 종가');
    });

    it('오늘 형성 중인 일봉(세션 진행 중)은 장중이다', () => {
        expect(
            buildDataAsOfLabel(
                US_EQUITY_SESSION,
                sec('2026-10-05T00:00:00.000Z'),
                new Date('2026-10-05T15:00:00.000Z'),
                'ko'
            )
        ).toBe('10월 5일 장중');
    });

    it('분·시간봉은 시장 현지 날짜의 장중이다 — 세션이 이미 끝났어도 종가라 부르지 않는다', () => {
        // 2026-10-05 10:00 ET 봉, 이틀 뒤 조회
        expect(
            buildDataAsOfLabel(
                US_EQUITY_SESSION,
                sec('2026-10-05T14:00:00.000Z'),
                new Date('2026-10-07T12:00:00.000Z'),
                'ko'
            )
        ).toBe('10월 5일 장중');
    });

    it('국내 종목 분봉은 KST 날짜를 쓴다', () => {
        // 2026-09-29 09:30 KST = 00:30Z
        expect(
            buildDataAsOfLabel(
                KR_EQUITY_SESSION,
                sec('2026-09-29T00:30:00.000Z'),
                new Date('2026-09-30T05:00:00.000Z'),
                'ko'
            )
        ).toBe('9월 29일 장중');
    });

    it('크립토는 봉의 UTC 날짜다', () => {
        expect(
            buildDataAsOfLabel(
                CRYPTO_SESSION,
                sec('2026-10-05T13:00:00.000Z'),
                new Date('2026-10-06T08:00:00.000Z'),
                'en'
            )
        ).toBe('Oct 5 UTC');
    });

    it('로케일을 따른다', () => {
        expect(
            buildDataAsOfLabel(
                US_EQUITY_SESSION,
                sec('2026-09-29T00:00:00.000Z'),
                new Date('2026-10-06T12:00:00.000Z'),
                'en'
            )
        ).toBe('Sep 29 close');
    });

    it.each([undefined, null, 'x', Number.NaN, Number.POSITIVE_INFINITY])(
        '유한한 숫자가 아니면(%s) null이다 — 호출자가 세션 기준으로 물러난다',
        value => {
            expect(
                buildDataAsOfLabel(
                    US_EQUITY_SESSION,
                    value,
                    new Date('2026-10-06T12:00:00.000Z'),
                    'ko'
                )
            ).toBeNull();
        }
    );
});
