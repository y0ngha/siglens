/** 한 종목의 구간 조회수 합계. */
export interface SymbolViewTally {
    readonly symbol: string;
    readonly views: number;
}
