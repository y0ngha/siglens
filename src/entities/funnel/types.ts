import type { MeterState } from '@/shared/lib/funnel/funnelEvents';

/** `countByKeyAndEvent` 한 행 — key는 context의 gate·kind·lastGate 중 있는 것. */
export interface FunnelKeyEventCount {
    readonly key: string | null;
    readonly event: string;
    readonly count: number;
}

/** 가입 방식 × lastGate 분포 한 행. */
export interface SignupBreakdownRow {
    readonly method: string;
    readonly lastGate: string | null;
    readonly count: number;
}

/** 가입 주(KST 월요일 `YYYY-MM-DD`)별 코호트와 D7·D30 재방문 회원 수. */
export interface SignupCohortRow {
    readonly week: string;
    readonly signups: number;
    readonly d7: number;
    readonly d30: number;
}

/**
 * `meter_shown`을 본 방문자와, 그중 이후 `METER_CONVERSION_WINDOW_DAYS`일 안에 `signup_completed`를 남긴 방문자 —
 * 공개(`revealed`)·소진(`exhausted`) 상태별. 방문자 단위는 `visitor_hash`다.
 */
export interface MeterCohortRow {
    readonly state: MeterState;
    readonly visitors: number;
    readonly signups: number;
}
