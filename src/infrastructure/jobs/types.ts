import type { Timeframe } from '@/domain/types';

export type JobStatus = 'processing' | 'done' | 'error';

export interface JobMeta {
    symbol: string;
    timeframe: Timeframe;
    skillsDegraded: boolean;
    /**
     * 마지막 bar의 종가 — entryPrice 기준값. AI가 entryPrices를 주지 않을 때
     * reconcile 단계에서 SL/TP 검증/fallback 기준으로 사용한다.
     */
    lastClose?: number;
    /**
     * 마지막 ATR 값. SL/TP fallback 계산에 사용한다.
     * 존재하지 않으면 fallback 불가 — AI 원본 값 유지.
     */
    atr?: number;
}
