import { assessFreshness } from '../freshness';
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
