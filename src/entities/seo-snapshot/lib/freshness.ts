import { getEasternOffsetHours } from '@/shared/lib/eastern';
import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE } from '@/shared/config/time';

const CLOSE_HOUR_ET = 16;
const SETTLE_BUFFER_MS = 30 * MS_PER_MINUTE; // 30min — EOD 데이터 정착 대기 (spec §6)

/** 해당 UTC 날짜(자정)의 16:00 ET를 UTC Date로 환산. */
function closeUtcFor(utcMidnight: Date): Date {
    const offset = getEasternOffsetHours(utcMidnight); // -4(EDT) | -5(EST)
    // 16:00 ET = (16 - offset):00 UTC  (EDT: 20:00, EST: 21:00)
    return new Date(
        utcMidnight.getTime() + (CLOSE_HOUR_ET - offset) * MS_PER_HOUR
    );
}

/** 마감 시각의 요일이 주말인지 (16:00 ET는 UTC 20~21시라 날짜 경계를 넘지 않음 → UTC 요일 = ET 요일). */
function isWeekendEt(closeUtc: Date): boolean {
    const day = closeUtc.getUTCDay();
    return day === 0 || day === 6;
}

/**
 * "가장 최근에 완료된 ET 정규장 마감(16:00 ET)" — 정착 버퍼 30분이 지난 것만 완료로 본다.
 * 미국 휴장일 캘린더는 의도적으로 없다(spec §6): 휴장일엔 전 거래일과 동일 데이터로
 * 1회 재생성/HIT 수확이 일어날 뿐(무해한 낭비 허용).
 */
export function lastCompletedEtCloseWithBuffer(now: Date): Date {
    let midnight = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    for (let i = 0; i < 7; i++) {
        const close = closeUtcFor(midnight);
        if (
            !isWeekendEt(close) &&
            now.getTime() >= close.getTime() + SETTLE_BUFFER_MS
        ) {
            return close;
        }
        midnight = new Date(midnight.getTime() - MS_PER_DAY);
    }
    return closeUtcFor(midnight); // unreachable — 7일 내 주중 마감 항상 존재
}

/** 스냅샷 생성 시각이 최근 완료 마감 이후면 fresh. undefined(스냅샷 없음)면 stale. */
export function isSnapshotFresh(
    generatedAt: Date | undefined,
    closeBoundary: Date
): boolean {
    if (generatedAt === undefined) return false;
    return generatedAt.getTime() >= closeBoundary.getTime();
}
