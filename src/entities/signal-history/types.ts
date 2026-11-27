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
 * 가이드의 "지금 이 신호가 나온 종목"이 읽는 에피소드 한 줄. 마지막 포착 세션이 그 시장의 가장 최근 완료
 * 세션인(= 그 세션에도 계속 잡힌) 에피소드다. `sessionDate`는 처음 포착된 세션이라 실제 교차일보다 늦을 수 있다.
 */
export interface SignalLatestEpisodeRow {
    readonly symbol: string;
    readonly koreanName: string | null;
    readonly signalType: string;
    /** 처음 포착된 세션(`YYYY-MM-DD`, 그 시장 현지 날짜). */
    readonly sessionDate: string;
    readonly changePercent: number;
}

/**
 * 신호 하나의 기간 집계 — 사이트맵이 색인할 신호 페이지와 lastmod를 고른다. 페이지가 종목마다 한 줄만
 * 그리므로(`listHubRows`가 종목마다 한 줄만 고른다) 색인 판정도 에피소드 수가 아니라 종목 수로 한다.
 */
export interface SignalHubCount {
    readonly signalType: string;
    /** 기간 안에 첫 포착된 에피소드가 있는 서로 다른 (시장, 종목) 수. */
    readonly symbols: number;
    /** 그 에피소드들의 가장 최근 마지막 포착 세션(`YYYY-MM-DD`) — 목록이 실제로 바뀐 날. */
    readonly latestSession: string;
}

/** 한 세션에 처음 포착된 에피소드 한 줄 — 알림 메일이 읽는다. */
export interface SignalEpisodeStartedRow {
    readonly symbol: string;
    readonly signalType: string;
    readonly changePercent: number;
    readonly koreanName: string | null;
}

/** 종목별 기록 진행 한 줄 — `signal_scan_cursors`. */
export interface ScanCursor {
    /** `signal_events`에 반영된 마지막 세션(`YYYY-MM-DD`). 첫 성공 전에는 null. */
    readonly lastSession: string | null;
    /** `attempts`가 속한 세션. 세션이 바뀌면 시도 횟수를 다시 센다. */
    readonly attemptSession: string | null;
    readonly attempts: number;
    readonly lastOutcome: 'recorded' | 'failed' | 'stale';
}

/** 기록하려다 실패한 이유: 조회 실패 / 마지막 봉이 그 세션이 아님. */
export type ScanFailureOutcome = 'failed' | 'stale';

/** 이어진(아직 끊기지 않은) 에피소드 한 줄 — 계획 수립이 읽는다. */
export interface OpenEpisode {
    readonly signalType: string;
    /** 처음 포착된 세션(기본키의 일부). */
    readonly sessionDate: string;
    readonly lastSeenSession: string;
}

/** 종목 한 개 스캔의 새 에피소드 — 끝난 에피소드도 있어 마지막 포착 세션을 함께 준다. */
export interface ScanEpisodeInsert extends SignalEpisodeInsert {
    readonly lastSeenSession: string;
}

/** 이미 있는 에피소드의 마지막 포착 세션을 늘린다(줄이지 않는다). */
export interface LastSeenUpdate {
    readonly signalType: string;
    /** 에피소드의 처음 포착 세션 — 기본키로 행을 가리킨다. */
    readonly sessionDate: string;
    readonly lastSeenSession: string;
}

/**
 * 종목 한 개를 한 번에 기록하는 쓰기 묶음. 전부 한 트랜잭션이다 — 중간에 실패하면 행도 진행 표식도
 * 그대로라서 다음 실행이 같은 일을 다시 한다.
 */
export interface SymbolScanWrite {
    readonly market: SignalHistoryMarket;
    readonly symbol: string;
    /** 이번 기록이 반영하는 마지막 세션 — 진행 표식의 `last_session`이 된다. */
    readonly session: string;
    /**
     * 처음 기록하는 종목의 재계산 구간 시작 세션. 값이 있으면 그 세션 이후 행을 지우고 다시 넣고,
     * 그 이전의 옛 골든·데드크로스 행은 단기 이평 교차 이름으로 바꾼다.
     */
    readonly rebuildFrom: string | null;
    /**
     * 옛 20/50 골든·데드크로스 행을 판별하는 기록 시각 기준(ISO). 이 시각보다 먼저 기록된 `golden_cross`·
     * `death_cross` 행만 단기 이평 교차 이름으로 바뀐다 — 새 코드가 쓴 50/200 행은 건드리지 않는다.
     * app-2가 새 기록 코드의 배포 시각을 상수로 정해 넣는다. `null`이면 이름 바꾸기를 하지 않는다.
     * 같은 값을 `openEpisodesSince`의 `relabelCutover`에도 넘겨야 계획이 바뀔 이름으로 에피소드를 이어 간다.
     */
    readonly relabelCutover: string | null;
    readonly lastSeenUpdates: readonly LastSeenUpdate[];
    readonly inserts: readonly ScanEpisodeInsert[];
}

/** 시장·세션별 기록 집계 한 줄 — `signal_scan_sessions`. */
export interface ScanSessionRow {
    readonly market: SignalHistoryMarket;
    readonly sessionDate: string;
    readonly universeSize: number;
    readonly recorded: number;
    readonly failed: number;
    readonly stale: number;
    /** 모든 대상이 정리된 시각(ISO). 아직이면 null — 이미 채워진 값을 null로 되돌리지 않는다. */
    readonly completedAt: string | null;
}

/** 신호 페이지가 고른 종목 수 — 시장별. 색인 판정과 사이트맵이 같은 값을 쓴다. */
export interface SignalHubSymbolCounts {
    readonly us: number;
    readonly kr: number;
}

/** 진행 표식 정리 결과. */
export interface ScanProgressPruneResult {
    readonly sessions: number;
    readonly cursors: number;
}
