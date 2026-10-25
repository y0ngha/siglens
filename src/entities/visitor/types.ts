/** 하루치 활성 사용자 수. `date`는 KST 기준 `YYYY-MM-DD`. */
export interface DailyActiveUsers {
    readonly date: string;
    readonly count: number;
}

/** 하루 동안 한 섹션(예: 가이드)으로 처음 들어온 방문자 수. */
export interface DailyLandingCount {
    readonly date: string;
    readonly count: number;
}

/** UA 한 종류가 남긴 방문 행 수. 봇 필터를 통과한 트래픽을 눈으로 검수할 때 쓴다. */
export interface UserAgentTally {
    readonly userAgent: string | null;
    readonly country: string | null;
    readonly count: number;
}
