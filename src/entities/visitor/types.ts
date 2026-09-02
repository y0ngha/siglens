/** 하루치 활성 사용자 수. `date`는 KST 기준 `YYYY-MM-DD`. */
export interface DailyActiveUsers {
    readonly date: string;
    readonly count: number;
}
