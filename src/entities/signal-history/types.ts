import type { SignalDirection, SignalType } from '@y0ngha/siglens-core';

/** 신호 이력을 남기는 대시보드 범위. 크립토는 24시간 시장이라 "세션 마감 뒤"가 없어 뺀다. */
export type SignalHistoryMarket = 'us' | 'kr';

/** 새 에피소드 한 행 — 한 종목에서 한 확정 신호가 처음 포착된 세션. */
export interface SignalEpisodeInsert {
    readonly market: SignalHistoryMarket;
    /** 처음 포착된 세션. 새 에피소드는 마지막 포착 세션도 같은 날로 시작한다. */
    readonly sessionDate: string;
    readonly symbol: string;
    readonly signalType: SignalType;
    readonly direction: SignalDirection;
    readonly changePercent: number;
    readonly koreanName: string | null;
    /** 스캐너 계산 시각(ISO). */
    readonly computedAt: string;
}

/** (종목, 신호) — 에피소드를 고르는 키. 시장은 호출 단위로 따로 준다. */
export interface SignalEpisodeKey {
    readonly symbol: string;
    readonly signalType: string;
}

/** 한 세션 기록 계획 — 새로 여는 에피소드와, 직전 세션에서 이어져 마지막 포착일만 늘릴 키. */
export interface SignalEpisodePlan {
    readonly inserts: readonly SignalEpisodeInsert[];
    readonly extends: readonly SignalEpisodeKey[];
}
