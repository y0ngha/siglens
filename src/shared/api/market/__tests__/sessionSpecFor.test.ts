import {
    US_EQUITY_SESSION,
    CRYPTO_SESSION,
    buildAgentTurnContext,
    isRegularSessionOpen,
} from '@y0ngha/siglens-core';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { MS_PER_DAY, MS_PER_HOUR } from '@/shared/config/time';
import { lastClosedSessionDate } from '@/shared/lib/marketSessionDate';
import {
    sessionSpecFor,
    sessionSpecForDashboardScope,
    KR_EQUITY_SESSION,
    KR_CALENDAR_HORIZON,
    __resetKrHorizonWarnings,
} from '../sessionSpecFor';

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
            openMinuteFor: expect.any(Function),
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
            Date.parse(`${KR_CALENDAR_HORIZON}T00:00:00Z`) + MS_PER_DAY
        );
        const noonBeyondHorizon = new Date(
            dayAfterHorizon.getTime() + 2 * MS_PER_HOUR
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
            Date.parse(`${KR_CALENDAR_HORIZON}T00:00:00Z`) + 3 * MS_PER_DAY
        );

        for (let i = 0; i < 12; i += 1) closeMinuteFor(beyond);

        expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('지평선 밖 날짜가 다르면 각각 한 번씩 남긴다', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const base = Date.parse(`${KR_CALENDAR_HORIZON}T00:00:00Z`);
        const dayMs = MS_PER_DAY;

        closeMinuteFor(new Date(base + 5 * dayMs));
        closeMinuteFor(new Date(base + 5 * dayMs));
        closeMinuteFor(new Date(base + 6 * dayMs));

        expect(warnSpy).toHaveBeenCalledTimes(2);
    });
});

/**
 * KRX 특수 거래일 — 연초 첫 거래일(10:00 개장)과 수능일(10:00~16:30).
 *
 * 함수 계약(개장·마감 분)만 보지 않고, 그 값을 읽는 core 소비 지점 두 곳
 * (`isRegularSessionOpen` = 에이전트 시계 노트가 쓰는 세션 판정, `lastClosedSessionDate`
 * = EOD 캐시 키·sitemap이 쓰는 마지막 마감 세션)까지 함께 단언한다 — 표가 있어도 spec에
 * 연결이 빠지면 함수 단위 테스트만으로는 드러나지 않는다.
 */
describe('KR_EQUITY_SESSION 특수 거래일', () => {
    if (KR_EQUITY_SESSION.kind !== 'scheduled') {
        throw new Error('KR_EQUITY_SESSION must be a scheduled session');
    }
    const { openMinuteFor, closeMinuteFor } = KR_EQUITY_SESSION;
    if (openMinuteFor === undefined || closeMinuteFor === undefined) {
        throw new Error(
            'KR_EQUITY_SESSION open/close overrides must be defined'
        );
    }

    beforeEach(() => {
        __resetKrHorizonWarnings();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it.each([['2023-11-16'], ['2024-11-14'], ['2025-11-13'], ['2026-11-19']])(
        '수능일 %s은 10:00 개장, 16:30 마감',
        date => {
            const noonKst = new Date(`${date}T03:00:00Z`);
            expect(openMinuteFor(noonKst)).toBe(600);
            expect(closeMinuteFor(noonKst)).toBe(990);
        }
    );

    it.each([['2023-01-02'], ['2024-01-02'], ['2025-01-02'], ['2026-01-02']])(
        '연초 첫 거래일 %s은 10:00 개장, 마감은 평소대로 15:30',
        date => {
            const noonKst = new Date(`${date}T03:00:00Z`);
            expect(openMinuteFor(noonKst)).toBe(600);
            expect(closeMinuteFor(noonKst)).toBe(930);
        }
    );

    /**
     * 지평선을 다음 해로 늘리면서 특수일 표를 잊으면, 그해 첫 거래일·수능일이 조용히 09:00
     * 개장으로 남는다. 지평선 해에 두 종류가 모두 있어야 통과하므로 지평선을 올리는 변경이
     * 표 갱신을 함께 강제한다.
     */
    it('지평선 해의 연초 첫 거래일과 수능일이 표에 있다', () => {
        const year = Number(KR_CALENDAR_HORIZON.slice(0, 4));
        const dayMs = MS_PER_DAY;
        const kinds: string[] = [];
        for (
            let t = Date.UTC(year, 0, 1, 3);
            t <= Date.parse(`${KR_CALENDAR_HORIZON}T03:00:00Z`);
            t += dayMs
        ) {
            const noonKst = new Date(t);
            const open = openMinuteFor(noonKst);
            const close = closeMinuteFor(noonKst);
            if (open === 600 && close === 930) kinds.push('first-trading-day');
            if (open === 600 && close === 990) kinds.push('csat');
        }
        expect(kinds).toEqual(['first-trading-day', 'csat']);
    });

    it('평범한 거래일은 09:00 개장, 15:30 마감', () => {
        // 2026-11-18(수) — 수능일 전날.
        const noonKst = new Date('2026-11-18T03:00:00Z');
        expect(openMinuteFor(noonKst)).toBe(540);
        expect(closeMinuteFor(noonKst)).toBe(930);
    });

    it('특수일 판정은 UTC가 아니라 KST 날짜로 한다', () => {
        // 2026-11-18T15:30Z = 2026-11-19 00:30 KST(수능일). UTC 날짜로 읽으면 전날이 된다.
        expect(openMinuteFor(new Date('2026-11-18T15:30:00Z'))).toBe(600);
        // 2026-11-19T15:30Z = 2026-11-20 00:30 KST — 수능일 다음 날은 평소대로.
        expect(openMinuteFor(new Date('2026-11-19T15:30:00Z'))).toBe(540);
    });

    it('지평선 밖 날짜는 09:00 개장으로 폴백하고, 개장·마감 조회를 합쳐 경고는 한 번', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const beyond = new Date(
            Date.parse(`${KR_CALENDAR_HORIZON}T03:00:00Z`) + 4 * MS_PER_DAY
        );
        expect(openMinuteFor(beyond)).toBe(540);
        expect(closeMinuteFor(beyond)).toBe(930);
        expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('수능일 09:30 KST는 장 전, 10:00부터 개장, 16:00 KST에도 개장 중', () => {
        // 00:30Z = 09:30 KST, 01:00Z = 10:00 KST, 07:00Z = 16:00 KST, 07:30Z = 16:30 KST.
        expect(
            isRegularSessionOpen(
                KR_EQUITY_SESSION,
                new Date('2026-11-19T00:30:00Z')
            )
        ).toBe(false);
        expect(
            isRegularSessionOpen(
                KR_EQUITY_SESSION,
                new Date('2026-11-19T01:00:00Z')
            )
        ).toBe(true);
        expect(
            isRegularSessionOpen(
                KR_EQUITY_SESSION,
                new Date('2026-11-19T07:00:00Z')
            )
        ).toBe(true);
        expect(
            isRegularSessionOpen(
                KR_EQUITY_SESSION,
                new Date('2026-11-19T07:30:00Z')
            )
        ).toBe(false);
    });

    it('평범한 거래일은 09:30 KST에 개장 중, 16:00 KST에 마감', () => {
        expect(
            isRegularSessionOpen(
                KR_EQUITY_SESSION,
                new Date('2026-11-18T00:30:00Z')
            )
        ).toBe(true);
        expect(
            isRegularSessionOpen(
                KR_EQUITY_SESSION,
                new Date('2026-11-18T07:00:00Z')
            )
        ).toBe(false);
    });

    it('에이전트 시계 노트는 수능일 09:30 KST의 KRX를 닫힘으로 적고 10:00 개장을 예고한다', () => {
        const note = buildAgentTurnContext({
            locale: 'ko',
            now: new Date('2026-11-19T00:30:00Z'),
            krSession: KR_EQUITY_SESSION,
            timeZone: 'Asia/Seoul',
        });
        const krLine = note
            .split('\n')
            .find(line => line.includes('Korean stocks (KRX)'));
        expect(krLine).toBeDefined();
        expect(krLine).not.toMatch(/KRX\): open/);
        expect(krLine).toContain('opens');
        expect(krLine).toContain('10:00');
    });

    it('에이전트 시계 노트는 수능일 16:00 KST의 KRX를 개장으로 적고 16:30 마감을 예고한다', () => {
        const note = buildAgentTurnContext({
            locale: 'ko',
            now: new Date('2026-11-19T07:00:00Z'),
            krSession: KR_EQUITY_SESSION,
            timeZone: 'Asia/Seoul',
        });
        const krLine = note
            .split('\n')
            .find(line => line.includes('Korean stocks (KRX)'));
        expect(krLine).toMatch(/KRX\): open/);
        expect(krLine).toContain('closes');
        expect(krLine).toContain('16:30');
    });

    it('수능일 마지막 마감 세션은 16:30 마감 + 버퍼가 지나야 그날로 롤한다', () => {
        // 마감 16:30 KST + 4h 버퍼 = 20:30 KST = 11:30Z. 평소 마감(15:30)이었다면
        // 10:30Z에 이미 롤했을 시각인 11:00Z에는 아직 전날이다.
        expect(
            lastClosedSessionDate(
                KR_EQUITY_SESSION,
                new Date('2026-11-19T11:00:00Z')
            )
        ).toBe('2026-11-18');
        expect(
            lastClosedSessionDate(
                KR_EQUITY_SESSION,
                new Date('2026-11-19T11:35:00Z')
            )
        ).toBe('2026-11-19');
    });
});

describe('sessionSpecForDashboardScope', () => {
    /**
     * **참조 동등성으로 단언한다.** `computeBarsEffectiveTtl`이 세션 스펙을 값이
     * 아니라 객체로 받고, 잘못된 세션을 넘기면 TTL이 정확히 뒤집힌다 —
     * KRX 장중에 24시간 고정, KRX 폐장 중에 60초 폴링.
     */
    it('kr scope는 KR 세션, crypto는 24/7 세션, us는 US 세션', () => {
        expect(sessionSpecForDashboardScope('kr')).toBe(KR_EQUITY_SESSION);
        expect(sessionSpecForDashboardScope('us')).toBe(US_EQUITY_SESSION);
        // 크립토를 US 세션으로 두면 NYSE 폐장 중 TTL이 몇 시간으로 늘어
        // 24시간 거래되는 시장의 시세가 밤새 얼어붙는다.
        expect(sessionSpecForDashboardScope('crypto')).toBe(CRYPTO_SESSION);
    });
});
