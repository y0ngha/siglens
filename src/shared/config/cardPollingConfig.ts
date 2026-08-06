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
