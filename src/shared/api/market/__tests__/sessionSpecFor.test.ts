import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import {
    sessionSpecFor,
    KR_EQUITY_SESSION,
    KR_CALENDAR_HORIZON,
    __resetKrHorizonWarnings,
} from '../sessionSpecFor';
import { US_EQUITY_SESSION, CRYPTO_SESSION } from '@y0ngha/siglens-core';

describe('sessionSpecFor', () => {
    it('maps crypto → always-open session', () => {
        expect(sessionSpecFor('crypto')).toBe(CRYPTO_SESSION);
    });
    it('maps us-equity → ET session', () => {
        expect(sessionSpecFor('us-equity')).toBe(US_EQUITY_SESSION);
    });
    it('maps kr-equity → KST session', () => {
        // 참조 동일성 비교 — getCachedMarketDataProvider가 `===`로 provider 싱글톤을
        // 분기하므로, 호출마다 새 객체를 만들면 라우팅이 조용히 깨진다.
        expect(sessionSpecFor('kr-equity')).toBe(KR_EQUITY_SESSION);
    });
});

describe('KR_EQUITY_SESSION', () => {
    it('describes the KRX regular session (09:00–15:30 KST, weekends closed)', () => {
        expect(KR_EQUITY_SESSION).toEqual({
            kind: 'scheduled',
            timeZone: 'Asia/Seoul',
            openMinute: 540,
            closeMinute: 930,
            weekendDays: [0, 6],
            closeMinuteFor: expect.any(Function),
        });
    });
});

/**
 * `KR_EQUITY_SESSION.closeMinuteFor` — KRX 휴장일 캘린더.
 *
 * `lastClosedSessionCloseUtc(KR_EQUITY_SESSION, …)`의 실사용 시나리오(휴장일 롤백)는
 * `marketSessionDate.test.ts`가 커버한다. 여기서는 `closeMinuteFor` 자체의 계약 —
 * 휴장일 0, 정상일 마감분, 지평선 밖 폴백 + 경고 — 을 직접 겨냥한다.
 *
 * `KR_EQUITY_SESSION`은 `MarketSessionSpec`(union) 타입으로 export되어 `.kind`를
 * 좁히지 않으면 `closeMinuteFor` 접근이 컴파일 에러다 — 위 "describes the KRX
 * regular session" 테스트가 이미 `kind: 'scheduled'`를 단언하므로, 여기서는 그
 * 사실을 한 번만 좁혀 함수로 뽑아 각 `it()`에서 반복하지 않는다.
 */
describe('KR_EQUITY_SESSION.closeMinuteFor', () => {
    if (KR_EQUITY_SESSION.kind !== 'scheduled') {
        throw new Error('KR_EQUITY_SESSION must be a scheduled session');
    }
    const closeMinuteFor = KR_EQUITY_SESSION.closeMinuteFor;
    if (closeMinuteFor === undefined) {
        throw new Error('KR_EQUITY_SESSION.closeMinuteFor must be defined');
    }

    // dedup Set은 모듈 레벨이라 테스트 간에 남는다 — 매 케이스 초기화하지 않으면
    // "경고 1회" 단언이 실행 순서에 따라 흔들린다.
    beforeEach(() => {
        __resetKrHorizonWarnings();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('관측된 휴장일(2026-08-17, 광복절 대체공휴일)은 0을 반환한다', () => {
        expect(closeMinuteFor(new Date('2026-08-17T02:00:00Z'))).toBe(0);
    });

    it('평범한 평일은 정규 마감분(930 = 15:30 KST)을 반환한다', () => {
        expect(closeMinuteFor(new Date('2026-08-18T02:00:00Z'))).toBe(930);
    });

    it('지평선(KR_CALENDAR_HORIZON) 안쪽 마지막 날짜는 경고 없이 정상 처리된다', () => {
        // KR_CALENDAR_HORIZON(2026-12-31)은 KRX 연말 폐장일이라 0을 반환하는 게 맞다 —
        // 이 케이스는 "경고 없이"와 "휴장일 조회가 지평선 폴백보다 먼저 걸린다"를
        // 동시에 못박는다. `date > horizon`이 아니라 `>=`였다면 이 날짜도 경고와 함께
        // 정상 개장으로 새 버렸을 것이다.
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const horizonNoonUtc = new Date(`${KR_CALENDAR_HORIZON}T02:00:00Z`);
        expect(closeMinuteFor(horizonNoonUtc)).toBe(0);
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it('지평선 밖 날짜는 정상 개장으로 폴백하고 console.warn을 남긴다', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const dayAfterHorizon = new Date(
            Date.parse(`${KR_CALENDAR_HORIZON}T00:00:00Z`) + 24 * 60 * 60 * 1000
        );
        const noonBeyondHorizon = new Date(
            dayAfterHorizon.getTime() + 2 * 60 * 60 * 1000
        );
        expect(closeMinuteFor(noonBeyondHorizon)).toBe(930);
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy.mock.calls[0]?.[0]).toContain('KR_MARKET_HOLIDAYS');
    });

    /**
     * dedup이 없으면 이 줄은 배포 다음 날부터 소음이 된다 — prewarm이 심볼마다
     * 경계를 계산하고 그 안에서 며칠을 되감으므로 같은 날짜로 수천 번 불린다.
     * 그러면 "캘린더를 갱신하라"는 신호가 자기 소음에 묻힌다.
     */
    it('같은 날짜를 여러 번 물어도 경고는 한 번만 남긴다', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const beyond = new Date(
            Date.parse(`${KR_CALENDAR_HORIZON}T00:00:00Z`) +
                3 * 24 * 60 * 60 * 1000
        );

        for (let i = 0; i < 12; i += 1) closeMinuteFor(beyond);

        expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('지평선 밖 날짜가 다르면 각각 한 번씩 남긴다', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const base = Date.parse(`${KR_CALENDAR_HORIZON}T00:00:00Z`);
        const dayMs = 24 * 60 * 60 * 1000;

        closeMinuteFor(new Date(base + 5 * dayMs));
        closeMinuteFor(new Date(base + 5 * dayMs));
        closeMinuteFor(new Date(base + 6 * dayMs));

        expect(warnSpy).toHaveBeenCalledTimes(2);
    });
});
