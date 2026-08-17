import { US_EQUITY_SESSION } from '@y0ngha/siglens-core';
import { lastClosedSessionCloseUtc } from '@/shared/lib/marketSessionDate';

/** 30min — EOD 데이터 정착 대기 (spec §6). */
const SETTLE_BUFFER_MINUTES = 30;

/**
 * "가장 최근에 완료된 ET 정규장 마감" — 정착 버퍼 30분이 지난 것만 완료로 본다.
 *
 * 반장(13:00 ET)이면 그 날의 실제 마감을, NYSE 휴장일이면 직전 거래일 마감을 돌려준다.
 * 원래 spec §6은 휴장일 미보정을 "전 거래일과 동일 데이터로 1회 재생성이 일어날 뿐"이라며
 * 허용했지만, 실제로는 그 1회가 **전 코퍼스**(심볼×탭 ≈ 1,900유닛)의 LLM 재생성이다.
 * 주말은 경계가 금요일 마감에 고정돼 no-op인 반면, 휴장일은 평일이라 경계가 롤하면서
 * 전 심볼이 stale로 뒤집힌다. prewarm cron에는 요일 필터가 없어 연 9회 그대로 돈다.
 * 반장일에는 반대로 경계가 16:30 ET에야 롤해 prewarm 첫 세 시간이 헛돈다.
 */
export function lastCompletedEtCloseWithBuffer(now: Date): Date {
    return lastClosedSessionCloseUtc(
        US_EQUITY_SESSION,
        now,
        SETTLE_BUFFER_MINUTES
    );
}

/** 스냅샷 생성 시각이 최근 완료 마감 이후면 fresh. undefined(스냅샷 없음)면 stale. */
export function isSnapshotFresh(
    generatedAt: Date | undefined,
    closeBoundary: Date
): boolean {
    if (generatedAt === undefined) return false;
    return generatedAt.getTime() >= closeBoundary.getTime();
}
