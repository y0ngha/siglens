import {
    getTimeFormatter,
    formatNewsPublishedAt,
} from '@/shared/lib/timeFormat';

// 2024-03-30 09:30:00 UTC = 2024-03-30 18:30:00 KST (UTC+9)
const UTC_TIMESTAMP_SECONDS = 1711791000;

// 2024-03-29 15:00:00 UTC = 2024-03-30 00:00:00 KST (UTC+9, 다음날)
const MIDDAY_UTC_TIMESTAMP_SECONDS = 1711724400;

// 2024-01-15 17:00:00 UTC = 2024-01-16 02:00:00 KST (UTC+9, 다음날)
const LATE_UTC_TIMESTAMP_SECONDS =
    new Date('2024-01-15T17:00:00Z').getTime() / 1000;

describe('timeFormat', () => {
    describe('formatNewsPublishedAt', () => {
        it('UTC ISO 시각을 KST 기준 한국어 날짜+시간 문자열로 변환한다', () => {
            // 2026-05-05T22:35:21.000Z → KST 2026-05-06 07:35
            expect(
                formatNewsPublishedAt('2026-05-05T22:35:21.000Z', 'ko')
            ).toBe('2026년 5월 6일 오전 07:35 KST');
        });

        it('날짜 경계 케이스: UTC 전날이지만 KST 기준 다음날로 표시된다', () => {
            // 2026-05-05T15:00:00.000Z → KST 2026-05-06 00:00
            expect(
                formatNewsPublishedAt('2026-05-05T15:00:00.000Z', 'ko')
            ).toBe('2026년 5월 6일 오전 12:00 KST');
        });
    });

    describe('getTimeFormatter', () => {
        describe('5Min 타임프레임', () => {
            it('KST 기준 시:분 형식(HH:mm)을 반환한다', () => {
                const formatter = getTimeFormatter('5Min', 'ko');
                expect(formatter(UTC_TIMESTAMP_SECONDS)).toBe('18:30');
            });
        });

        describe('15Min 타임프레임', () => {
            it('KST 기준 월/일 시:분 형식(M/D HH:mm)을 반환한다', () => {
                const formatter = getTimeFormatter('15Min', 'ko');
                expect(formatter(UTC_TIMESTAMP_SECONDS)).toBe('3/30 18:30');
            });
        });

        describe('30Min 타임프레임', () => {
            it('KST 기준 월/일 시:분 형식(M/D HH:mm)을 반환한다', () => {
                const formatter = getTimeFormatter('30Min', 'ko');
                expect(formatter(UTC_TIMESTAMP_SECONDS)).toBe('3/30 18:30');
            });
        });

        describe('1Hour 타임프레임', () => {
            it('KST 기준 월/일 시:분 형식을 반환한다', () => {
                const formatter = getTimeFormatter('1Hour', 'ko');
                expect(formatter(UTC_TIMESTAMP_SECONDS)).toBe('3/30 18:30');
            });
        });

        describe('4Hour 타임프레임', () => {
            it('KST 기준 월/일 시:분 형식을 반환한다', () => {
                const formatter = getTimeFormatter('4Hour', 'ko');
                expect(formatter(UTC_TIMESTAMP_SECONDS)).toBe('3/30 18:30');
            });
        });

        describe('1Day 타임프레임', () => {
            it('en: KST 기준 월이름 일 형식(MMM D)을 반환한다', () => {
                const formatter = getTimeFormatter('1Day', 'en');
                expect(formatter(UTC_TIMESTAMP_SECONDS)).toBe('Mar 30');
            });
        });

        describe('날짜 경계 (UTC 기준 전날이지만 KST 기준 다음날)', () => {
            it('5Min: UTC 15:00은 KST 00:00 (다음날)으로 포맷된다', () => {
                const formatter = getTimeFormatter('5Min', 'ko');
                expect(formatter(MIDDAY_UTC_TIMESTAMP_SECONDS)).toBe('00:00');
            });

            it('15Min: UTC 2024-03-29 15:00은 KST 3/30 00:00으로 포맷된다', () => {
                const formatter = getTimeFormatter('15Min', 'ko');
                expect(formatter(MIDDAY_UTC_TIMESTAMP_SECONDS)).toBe(
                    '3/30 00:00'
                );
            });

            it('30Min: UTC 2024-03-29 15:00은 KST 3/30 00:00으로 포맷된다', () => {
                const formatter = getTimeFormatter('30Min', 'ko');
                expect(formatter(MIDDAY_UTC_TIMESTAMP_SECONDS)).toBe(
                    '3/30 00:00'
                );
            });

            it('1Hour: UTC 2024-03-29 15:00은 KST 3/30 00:00으로 포맷된다', () => {
                const formatter = getTimeFormatter('1Hour', 'ko');
                expect(formatter(MIDDAY_UTC_TIMESTAMP_SECONDS)).toBe(
                    '3/30 00:00'
                );
            });

            it('4Hour: UTC 2024-03-29 15:00은 KST 3/30 00:00으로 포맷된다', () => {
                const formatter = getTimeFormatter('4Hour', 'ko');
                expect(formatter(MIDDAY_UTC_TIMESTAMP_SECONDS)).toBe(
                    '3/30 00:00'
                );
            });

            it('en: UTC 2024-03-29 15:00은 KST Mar 30으로 포맷된다', () => {
                const formatter = getTimeFormatter('1Day', 'en');
                expect(formatter(MIDDAY_UTC_TIMESTAMP_SECONDS)).toBe('Mar 30');
            });
        });

        describe('심야 시간 변환', () => {
            it('5Min: UTC 17:00은 KST 02:00으로 포맷된다', () => {
                const formatter = getTimeFormatter('5Min', 'ko');
                expect(formatter(LATE_UTC_TIMESTAMP_SECONDS)).toBe('02:00');
            });

            it('15Min: UTC 2024-01-15 17:00은 KST 1/16 02:00으로 포맷된다', () => {
                const formatter = getTimeFormatter('15Min', 'ko');
                expect(formatter(LATE_UTC_TIMESTAMP_SECONDS)).toBe(
                    '1/16 02:00'
                );
            });

            it('30Min: UTC 2024-01-15 17:00은 KST 1/16 02:00으로 포맷된다', () => {
                const formatter = getTimeFormatter('30Min', 'ko');
                expect(formatter(LATE_UTC_TIMESTAMP_SECONDS)).toBe(
                    '1/16 02:00'
                );
            });

            it('1Hour: UTC 2024-01-15 17:00은 KST 1/16 02:00으로 포맷된다', () => {
                const formatter = getTimeFormatter('1Hour', 'ko');
                expect(formatter(LATE_UTC_TIMESTAMP_SECONDS)).toBe(
                    '1/16 02:00'
                );
            });

            it('4Hour: UTC 2024-01-15 17:00은 KST 1/16 02:00으로 포맷된다', () => {
                const formatter = getTimeFormatter('4Hour', 'ko');
                expect(formatter(LATE_UTC_TIMESTAMP_SECONDS)).toBe(
                    '1/16 02:00'
                );
            });
        });

        describe('월 이름 경계', () => {
            it('en: 1월은 Jan으로 표시된다', () => {
                const formatter = getTimeFormatter('1Day', 'en');
                // 2024-01-15 12:00:00 UTC = 2024-01-15 21:00:00 KST
                const janTimestamp =
                    new Date('2024-01-15T12:00:00Z').getTime() / 1000;
                expect(formatter(janTimestamp)).toBe('Jan 15');
            });

            it('en: 12월은 Dec으로 표시된다', () => {
                const formatter = getTimeFormatter('1Day', 'en');
                // 2024-12-25 12:00:00 UTC = 2024-12-25 21:00:00 KST
                const decTimestamp =
                    new Date('2024-12-25T12:00:00Z').getTime() / 1000;
                expect(formatter(decTimestamp)).toBe('Dec 25');
            });
        });
    });
});

/**
 * 차트 축·크로스헤어의 월 표기.
 *
 * 예전에는 `['Jan','Feb',…]` 영어 상수라 ko도 영어였고, 정작 축은
 * `lightweight-charts`가 `navigator.language`로 그려서 `/en/AAPL`인데
 * 브라우저가 ko-KR이면 `4월 5월`이 찍혔다 — URL 로케일과 무관하게.
 */
describe('getTimeFormatter — 로케일', () => {
    // 1일 타임프레임만 월 이름을 쓴다(분/시간 단위는 숫자).
    const AUG_1_2026_UTC = Math.floor(Date.UTC(2026, 7, 1, 0, 0) / 1000);

    it('로케일마다 다른 월 표기를 낸다', () => {
        const out = (['ko', 'en', 'ja', 'zh'] as const).map(locale =>
            getTimeFormatter('1Day', locale)(AUG_1_2026_UTC)
        );

        // ko/ja/zh는 `8월`·`8月` 계열, en은 `Aug` — 최소한 en과 ko는 달라야 한다.
        expect(out[0]).not.toBe(out[1]);
        expect(out[1]).toMatch(/Aug/);
    });

    it('en에는 한글이 없다', () => {
        for (const tf of ['1Day', '4Hour', '5Min'] as const) {
            expect(getTimeFormatter(tf, 'en')(AUG_1_2026_UTC)).not.toMatch(
                /[가-힣]/
            );
        }
    });
});
