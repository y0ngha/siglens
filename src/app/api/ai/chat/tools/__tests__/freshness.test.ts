import { assessFreshness, staleKrListingDate } from '../freshness';
import { QUOTE_MAX_AGE_MS } from '@/shared/config/quoteFreshness';
import { MS_PER_DAY, MS_PER_MINUTE } from '@/shared/config/time';

const NOW = Date.UTC(2026, 8, 21, 12, 0, 0);

describe('assessFreshness 함수는', () => {
    it('허용 나이 안이면 stale=false', () => {
        expect(
            assessFreshness({
                asOfMs: NOW - 10 * MS_PER_MINUTE,
                maxAgeMs: 30 * MS_PER_MINUTE,
                nowMs: NOW,
            })
        ).toEqual({
            asOf: new Date(NOW - 10 * MS_PER_MINUTE).toISOString(),
            ageMinutes: 10,
            stale: false,
            maxAgeMinutes: 30,
        });
    });

    it('허용 나이를 넘으면 stale=true', () => {
        const view = assessFreshness({
            asOfMs: NOW - 31 * MS_PER_MINUTE,
            maxAgeMs: 30 * MS_PER_MINUTE,
            nowMs: NOW,
        });

        expect(view.stale).toBe(true);
        expect(view.ageMinutes).toBe(31);
    });

    it('경계(정확히 허용 나이)는 stale이 아니다', () => {
        expect(
            assessFreshness({
                asOfMs: NOW - 30 * MS_PER_MINUTE,
                maxAgeMs: 30 * MS_PER_MINUTE,
                nowMs: NOW,
            }).stale
        ).toBe(false);
    });

    /**
     * 프로바이더 시계가 앞서거나 컨테이너 시계가 뒤처지면 음수가 나온다. 그대로
     * 노출하면 모델이 "미래 데이터"라는 없는 상태를 서술한다.
     */
    it('미래 시각이면 경과를 0으로 내리고 stale로 보지 않는다', () => {
        const view = assessFreshness({
            asOfMs: NOW + 5 * MS_PER_MINUTE,
            maxAgeMs: 30 * MS_PER_MINUTE,
            nowMs: NOW,
        });

        expect(view.ageMinutes).toBe(0);
        expect(view.stale).toBe(false);
    });

    /**
     * 실측 회귀 가드 — `SQ`(→`XYZ` 개명)가 19개월 된 시세를 "현재가"로 내보낸 사례.
     * 정상 휴장(연휴 낀 주말)은 통과해야 한다.
     */
    it('7일 임계에서 개명·폐지로 동결된 시세는 잡고 연휴 주말은 통과시킨다', () => {
        const sevenDays = 7 * MS_PER_DAY;

        expect(
            assessFreshness({
                asOfMs: Date.UTC(2025, 1, 13, 16, 8, 53),
                maxAgeMs: sevenDays,
                nowMs: NOW,
            }).stale
        ).toBe(true);

        // 금요일 종가를 나흘 뒤(연휴 낀 화요일)에 조회 — 정상이다.
        expect(
            assessFreshness({
                asOfMs: NOW - 4 * MS_PER_DAY,
                maxAgeMs: sevenDays,
                nowMs: NOW,
            }).stale
        ).toBe(false);
    });
});

describe('staleKrListingDate 함수는', () => {
    it('마지막 거래일은 KST 달력 날짜다 — KST 자정(전날 15:00 UTC)에 찍힌 봉도 하루 이르게 나가지 않는다', () => {
        // 2024-07-19 00:00 KST = 2024-07-18T15:00Z
        const kstMidnight = Date.UTC(2024, 6, 18, 15, 0);
        expect(staleKrListingDate('kr-equity', kstMidnight, NOW)).toBe(
            '2024-07-19'
        );
        // yahoo 한국 일봉의 실제 찍힘(UTC 자정 = 09:00 KST)도 같은 날짜다.
        expect(
            staleKrListingDate('kr-equity', Date.UTC(2024, 6, 19), NOW)
        ).toBe('2024-07-19');
    });

    it('14일을 넘긴 한국 리스팅은 마지막 거래일을 돌려준다', () => {
        const lastTrade = Date.UTC(2024, 6, 19, 6, 30);
        expect(staleKrListingDate('kr-equity', lastTrade, NOW)).toBe(
            '2024-07-19'
        );
    });

    it('KRX 연휴 클러스터(약 8일)는 죽은 리스팅으로 보지 않는다', () => {
        expect(
            staleKrListingDate('kr-equity', NOW - 8 * MS_PER_DAY, NOW)
        ).toBeNull();
    });

    it('문턱 경계: 정확히 14일은 통과, 그보다 1ms 더 묵으면 거부', () => {
        expect(
            staleKrListingDate('kr-equity', NOW - QUOTE_MAX_AGE_MS, NOW)
        ).toBeNull();
        expect(
            staleKrListingDate('kr-equity', NOW - QUOTE_MAX_AGE_MS - 1, NOW)
        ).not.toBeNull();
    });

    it('한국 종목이 아니거나 기준 시각이 없으면 판정하지 않는다', () => {
        const old = Date.UTC(2024, 6, 19);
        expect(staleKrListingDate('us-equity', old, NOW)).toBeNull();
        expect(staleKrListingDate('kr-equity', undefined, NOW)).toBeNull();
        expect(staleKrListingDate('kr-equity', Number.NaN, NOW)).toBeNull();
    });
});
