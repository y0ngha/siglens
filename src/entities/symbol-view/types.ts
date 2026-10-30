/**
 * `SymbolViewRepository.topViewed`의 한 행 — 조회 구간 동안 종목별로 합산한 조회수.
 * 방문 후보 선정 스크립트가 자산군별 상위 N개를 고르는 입력이다.
 */
export interface SymbolViewTally {
    readonly symbol: string;
    readonly views: number;
}
