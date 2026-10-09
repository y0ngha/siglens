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
