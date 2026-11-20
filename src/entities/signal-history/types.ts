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
    /** 처음 포착될 때 스캐너가 보고한 가격. 유한한 양수가 아니면 null. 이어질 때 갱신하지 않는다. */
    readonly priceAtDetection: number | null;
    readonly koreanName: string | null;
    /** 스캐너 계산 시각(ISO). */
    readonly computedAt: string;
}

/** 신호 페이지가 읽는 에피소드 한 줄. 날짜는 `YYYY-MM-DD`(그 시장 현지 세션 날짜). */
export interface SignalEpisodeRow {
    readonly market: SignalHistoryMarket;
    readonly symbol: string;
    readonly koreanName: string | null;
    readonly sessionDate: string;
    readonly lastSeenSession: string;
    readonly changePercent: number;
}

/**
 * 신호 하나의 기간 집계 — 사이트맵이 색인할 신호 페이지와 lastmod를 고른다. 페이지가 종목마다 한 줄만
 * 그리므로(`latestEpisodePerSymbol`) 색인 판정도 에피소드 수가 아니라 종목 수로 한다.
 */
export interface SignalHubCount {
    readonly signalType: string;
    /** 기간 안에 첫 포착된 에피소드가 있는 서로 다른 (시장, 종목) 수. */
    readonly symbols: number;
    /** 그 에피소드들의 가장 최근 마지막 포착 세션(`YYYY-MM-DD`) — 목록이 실제로 바뀐 날. */
    readonly latestSession: string;
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
