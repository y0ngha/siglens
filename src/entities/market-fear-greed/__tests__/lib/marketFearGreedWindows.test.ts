import { describe, it, expect } from 'vitest';
import { MARKET_FEAR_GREED_KR_LOOKBACK_DAYS } from '../../lib/marketFearGreedKrSymbols';
import { MARKET_FEAR_GREED_LOOKBACK_DAYS } from '../../lib/marketFearGreedSymbols';
import {
    cryptoLookbackStartDate,
    krLookbackStartDate,
    lastClosedUtcDate,
    lastPublishedSessionDate,
    lookbackStartDate,
} from '../../lib/marketFearGreedWindows';
import { MS_PER_DAY } from '@/shared/config/time';

describe('lookbackStartDate', () => {
    it(`고정 시각 기준 MARKET_FEAR_GREED_LOOKBACK_DAYS(${MARKET_FEAR_GREED_LOOKBACK_DAYS})일 전 ISO 날짜를 반환한다`, () => {
        const now = new Date('2026-08-15T00:00:00Z');

        // 2026-08-15 - 1830일(core FEAR_GREED_LOOKBACK_DAYS, 약 5년) = 2021-08-11
        // (실제 clock을 쓰지 않고 고정 시각으로 계산).
        expect(lookbackStartDate(now)).toBe('2021-08-11');
    });
});

// `lastPublishedSessionDate`는 `lastClosedSessionDateEt`의 얇은 wrapper.
// 아래 고정 시각들은 src/shared/lib/__tests__/marketSessionDate.test.ts의
// `lastClosedSessionDateEt — DST-aware key boundary` 스위트에서 이미 검증된
// 값과 동일하다(마감=16:00 ET + 발행버퍼 4h → 20:00 ET에만 롤오버) — 여기서
// 새로 추측하지 않고 그 근거를 그대로 재사용한다.
describe('lastPublishedSessionDate', () => {
    it('평일 장중(2026-07-13 Mon 13:40 UTC = 09:40 EDT)에는 당일을 반환하지 않는다', () => {
        const result = lastPublishedSessionDate(
            new Date('2026-07-13T13:40:00Z')
        );

        expect(result).not.toBe('2026-07-13');
        expect(result).toBe('2026-07-10'); // 직전 금요일
    });

    it('마감+발행버퍼 이후 평일(2026-07-14 00:30 UTC = 20:30 EDT Mon)에는 당일을 반환한다', () => {
        const result = lastPublishedSessionDate(
            new Date('2026-07-14T00:30:00Z')
        );

        expect(result).toBe('2026-07-13');
    });

    it('토요일에는 직전 금요일을 반환한다', () => {
        const result = lastPublishedSessionDate(
            new Date('2026-07-11T12:00:00Z')
        );

        expect(result).toBe('2026-07-10');
    });
});

describe('krLookbackStartDate', () => {
    it('(Happy) lookback 일수만큼 과거로 물러난다', () => {
        const now = new Date('2026-08-18T09:00:00.000Z');

        expect(krLookbackStartDate(now).getTime()).toBe(
            now.getTime() - MARKET_FEAR_GREED_KR_LOOKBACK_DAYS * MS_PER_DAY
        );
    });
});

describe('조회 창', () => {
    // 진행 중인 날의 행은 실시간 시세를 종가로 싣는다 — 절대 요청하지 않는다.
    it('상한은 어제(UTC)다 — UTC 자정 직후에도 오늘을 포함하지 않는다', () => {
        expect(lastClosedUtcDate(new Date('2026-09-25T00:00:01Z'))).toBe(
            '2026-09-24'
        );
        expect(lastClosedUtcDate(new Date('2026-09-25T23:59:59Z'))).toBe(
            '2026-09-24'
        );
    });

    it('하한은 1830 달력일(core FEAR_GREED_LOOKBACK_DAYS, 약 5년) 전이다', () => {
        expect(cryptoLookbackStartDate(new Date('2026-09-25T12:00:00Z'))).toBe(
            '2021-09-21'
        );
    });
});
