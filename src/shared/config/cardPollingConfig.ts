/**
 * 뉴스 카드 enrichment 폴링 임계값 — 단일 출처.
 *
 * 분석 job 폴링(`pollingConfig`)은 worker·Redis 신호 체계와 함께 사라졌지만, 카드
 * 폴링은 남아 있다. 이건 job 상태를 캐는 게 아니라 **DB에 적재된 카드가 AI로 채워졌는지**
 * 를 확인하는 것이고, 그 적재는 별도 server action이 비동기로 진행하기 때문이다.
 *
 * news / market-news 두 슬라이스가 같은 값을 써야 한다(둘 다 같은 UX 계약 — 5분 안에
 * 안 채워지면 포기). 슬라이스별로 리터럴을 복제해 두면 한쪽만 바뀌어 조용히 어긋난다.
 */
export const POLL_INTERVAL_MS = 3_000;
export const MAX_CONSECUTIVE_FAILURES = 3;
export const EMPTY_SNAPSHOT_MAX_POLLS = 20;
export const MAX_POLL_DURATION_MS = 5 * 60_000;

/**
 * 보강 진전이 이 횟수만큼 연속으로 없으면 폴링을 접는다.
 *
 * 종료 조건이 "창 안의 **모든** 카드가 보강됨"인데 공급은 방문자 25건/10분 +
 * 크론 12건/밤이라, 기사가 그보다 많은 종목은 그 조건이 구조적으로 참이 되지
 * 않는다 — 그대로 두면 매 조회가 상한(100틱)을 다 채운다.
 *
 * 6틱 = 18초. 카드 한 건의 LLM 왕복이 실측 4~13초이고 `withConcurrencyLimit`가
 * 청크를 순차 실행하므로 쓰기 사이 침묵이 13초까지 벌어진다 — 창을 그보다 짧게
 * 잡으면 진행 중인 청크를 두고 접는다.
 */
export const STAGNANT_POLL_LIMIT = 6;

/**
 * 정체 판정을 시작하기 전에 반드시 지나야 하는 최소 폴 수.
 *
 * "이번 마운트에서 진전이 있었다"를 보강 카드 수로 판정하면 **SSR 스냅샷에 이미
 * 있던 카드**로도 충족된다. 그래서 스피너 floor(5틱=15초)를 재사용하면, 이번
 * 마운트가 유발한 첫 카드가 도착하기 전에 접는다 — 실측 구간은 적재 2~5초 +
 * upsert 파동 + 첫 LLM 왕복 4~13초 = 최악 22~30초다.
 *
 * 12틱 = 36초로 그 구간을 넘긴다. 스피너 floor는 UI 표시용이라 목적이 다르므로
 * 분리한다.
 */
export const STAGNATION_FLOOR_POLLS = 12;
