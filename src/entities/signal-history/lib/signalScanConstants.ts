/** 처음 기록하는 종목을 몇 세션 전까지 거슬러 채우는가. 상한이기도 해서 따라잡기도 이만큼까지만 거슬러 간다. */
export const SIGNAL_HISTORY_BOOTSTRAP_SESSIONS = 120;

/** 한 종목이 한 세션에서 실패·낡은 데이터로 시도할 수 있는 횟수. 넘으면 그 세션에서는 "정리된 것"으로 본다. */
export const SIGNAL_SCAN_MAX_ATTEMPTS = 3;

/**
 * 판정 구간을 한 번에 넘기는 일수. core `confirmedSignalTimeline`은 하루에 지표 한 벌(약 3.2ms)을 계산해
 * 120일이면 0.4초 가까이 이벤트 루프를 잡는다. 10일씩 끊고 사이에 양보하면 한 번에 약 35ms다.
 */
export const SIGNAL_SCAN_TIMELINE_CHUNK_DAYS = 10;

/**
 * 옛 20/50 골든·데드크로스 행과 새 50/200 행을 가르는 기록 시각 기준(ISO). `computed_at`이 이 시각보다 이른
 * `golden_cross`·`death_cross` 행이 옛 20/50 규칙의 행이고, 처음 기록하는 종목(`bootstrap`)에서 단기 이평 교차
 * 이름으로 바뀐다.
 *
 * 값은 과거의 한 시점으로 고정하며, **첫 배포가 이 시각부터 약 120세션 안일 때만** 안전하다.
 * - 새 코드가 쓴 50/200 행은 `computed_at`이 이 시각 이후라 이름이 바뀌지 않는다. 캐시 정리 등으로 다시 처음
 *   기록되는 종목도 진짜 골든·데드크로스를 잃지 않는다.
 * - 새 코드가 배포되기 전까지 옛 코드(20/50)도 이 시각 이후 행을 계속 쓴다. 첫 bootstrap이 다시 계산하는
 *   구간(최근 약 120세션)이 그 행을 모두 덮어야 하므로, 배포가 이 시각에서 약 120세션(미국 기준 2027년 5월 중순,
 *   한국은 더 늦다)을 넘기면 재계산 구간 앞의 옛 행이 옛 의미로 남는다.
 *   그 전에 배포하지 못하면 이 값을 첫 배포 시각 이전으로 옮긴다.
 *
 * `SymbolScanWrite.relabelCutover`와 `openEpisodesSince({ relabelCutover })` 두 곳에 같은 값을 넘긴다 —
 * 어긋나면 계획이 이어 간 에피소드와 DB가 바꾼 이름이 달라진다.
 */
export const SIGNAL_SCAN_RELABEL_CUTOVER = '2026-11-22T00:00:00.000Z';
