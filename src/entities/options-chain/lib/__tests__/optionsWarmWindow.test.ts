import { getOptionsWarmWindow } from '../optionsWarmWindow';

function at(iso: string): Date {
    return new Date(iso);
}

describe('getOptionsWarmWindow', () => {
    describe('서머타임(EDT, 마감 16:00 ET = 20:00 UTC)', () => {
        // 2026-10-05(월)
        it('마감+15분 직전(16:14 ET)에는 거부한다', () => {
            expect(getOptionsWarmWindow(at('2026-10-05T20:14:00Z'))).toBeNull();
        });

        it('마감+15분 정각(16:15 ET)부터 허용하고 경계를 돌려준다', () => {
            const window = getOptionsWarmWindow(at('2026-10-05T20:15:00Z'));
            expect(window?.closeUtc.toISOString()).toBe(
                '2026-10-05T20:00:00.000Z'
            );
            expect(window?.endUtc.toISOString()).toBe(
                '2026-10-05T23:45:00.000Z'
            );
        });

        it('19:45 ET(23:45 UTC)까지 허용하고 1분 뒤부터 거부한다', () => {
            expect(
                getOptionsWarmWindow(at('2026-10-05T23:45:00Z'))
            ).not.toBeNull();
            expect(getOptionsWarmWindow(at('2026-10-05T23:46:00Z'))).toBeNull();
        });

        it('정규장 중(11:00 ET)에는 거부한다', () => {
            expect(getOptionsWarmWindow(at('2026-10-05T15:00:00Z'))).toBeNull();
        });

        it('20:00 ET 이후(= 한국 시간 낮 이전의 밤)에는 거부한다', () => {
            expect(getOptionsWarmWindow(at('2026-10-06T00:30:00Z'))).toBeNull();
        });

        it('한국 시간 낮(14:00 KST = 01:00 ET)에는 거부한다', () => {
            expect(getOptionsWarmWindow(at('2026-10-05T05:00:00Z'))).toBeNull();
        });
    });

    describe('표준시(EST, 마감 16:00 ET = 21:00 UTC)', () => {
        // 2026-12-07(월) — DST 규칙을 하드코딩하지 않으므로 UTC 경계가 한 시간 밀린다.
        it('16:14 ET(21:14 UTC)는 거부, 16:15 ET(21:15 UTC)는 허용한다', () => {
            expect(getOptionsWarmWindow(at('2026-12-07T21:14:00Z'))).toBeNull();
            const window = getOptionsWarmWindow(at('2026-12-07T21:15:00Z'));
            expect(window?.closeUtc.toISOString()).toBe(
                '2026-12-07T21:00:00.000Z'
            );
        });

        it('종료는 19:45 ET = 다음 날 00:45 UTC다', () => {
            const window = getOptionsWarmWindow(at('2026-12-07T22:00:00Z'));
            expect(window?.endUtc.toISOString()).toBe(
                '2026-12-08T00:45:00.000Z'
            );
            expect(
                getOptionsWarmWindow(at('2026-12-08T00:45:00Z'))
            ).not.toBeNull();
            expect(getOptionsWarmWindow(at('2026-12-08T00:46:00Z'))).toBeNull();
        });

        it('서머타임이 막 끝난 월요일(2026-11-02)에도 EST 경계를 쓴다', () => {
            expect(getOptionsWarmWindow(at('2026-11-02T20:30:00Z'))).toBeNull();
            expect(
                getOptionsWarmWindow(at('2026-11-02T21:30:00Z'))
            ).not.toBeNull();
        });
    });

    describe('휴장일·주말', () => {
        it('추수감사절(2026-11-26)에는 어느 시각이든 거부한다', () => {
            expect(getOptionsWarmWindow(at('2026-11-26T22:00:00Z'))).toBeNull();
            expect(getOptionsWarmWindow(at('2026-11-26T21:30:00Z'))).toBeNull();
        });

        it('독립기념일 대체 휴장일(2026-07-03 금)에는 거부한다', () => {
            expect(getOptionsWarmWindow(at('2026-07-03T21:00:00Z'))).toBeNull();
        });

        it('토요일에는 거부한다', () => {
            expect(getOptionsWarmWindow(at('2026-10-10T21:00:00Z'))).toBeNull();
        });

        it('휴장일 다음 날 새벽(UTC로는 휴장일 저녁)도 거부한다', () => {
            // 2026-11-27 01:00 UTC = 11-26 20:00 ET(휴장일 저녁).
            expect(getOptionsWarmWindow(at('2026-11-27T01:00:00Z'))).toBeNull();
        });
    });

    describe('반장(13:00 ET 마감)', () => {
        // 2026-11-27(금, 추수감사절 다음 날) — EST라 13:00 ET = 18:00 UTC.
        it('마감을 13:00 ET로 보고 13:15 ET(18:15 UTC)부터 허용한다', () => {
            expect(getOptionsWarmWindow(at('2026-11-27T18:14:00Z'))).toBeNull();
            const window = getOptionsWarmWindow(at('2026-11-27T18:15:00Z'));
            expect(window?.closeUtc.toISOString()).toBe(
                '2026-11-27T18:00:00.000Z'
            );
        });

        it('반장 날에도 종료는 같은 19:45 ET(00:45 UTC)다', () => {
            const window = getOptionsWarmWindow(at('2026-11-27T20:00:00Z'));
            expect(window?.endUtc.toISOString()).toBe(
                '2026-11-28T00:45:00.000Z'
            );
        });

        it('반장 날 정규장 중(12:30 ET)에는 거부한다', () => {
            expect(getOptionsWarmWindow(at('2026-11-27T17:30:00Z'))).toBeNull();
        });
    });
});
