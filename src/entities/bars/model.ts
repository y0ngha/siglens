import type {
    FearGreedHistoryPoint,
    FearGreedSnapshot,
} from '@y0ngha/siglens-core';

/**
 * 종목 공포·탐욕 한 벌 — 서버가 5년 일봉으로 계산한 현재 스냅샷과 history.
 * 서버 계산(`lib/symbolFearGreed`)과 그 결과를 읽는 클라이언트(위젯 훅)가 같은 모양을 쓴다.
 */
export interface SymbolFearGreedSeries {
    readonly snapshot: FearGreedSnapshot | null;
    readonly history: FearGreedHistoryPoint[];
}
