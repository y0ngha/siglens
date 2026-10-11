import { SECONDS_PER_MINUTE } from '@/shared/config/time';

/**
 * 시세 스냅샷(`quote:snapshot:<SYM>`) TTL의 상한.
 *
 * 세션 기본 TTL은 장중 60초, 장외에는 "다음 개장까지"(최대 24시간)다. 장외 TTL을 그대로 쓰면
 * 마감 뒤 **첫 요청이 받은 시세**가 다음 개장까지(금요일이면 주말 내내) 현재가로 굳는다 —
 * 그 순간이 종가 단일가 체결이 다 반영되기 전이면 확정 종가가 아닌 값이 남는다. 차트 일봉은
 * 마감 + 발행 버퍼에 공식 일봉이 들어오며 바로잡히지만 `getQuote`(현재가 표시·분석 현재가)는
 * 그대로였다. 그래서 장외에도 5분을 넘기지 않는다 — 언제 들어오든 5분 안에 받은 값을 본다.
 *
 * 장중(60초)과 24시간 시장(크립토, 늘 60초)은 이 상한보다 짧아 영향이 없다. 시세·오늘 봉 중
 * 한쪽만 매핑된 부분 스냅샷도 같은 상한을 받아, 공급자가 행을 고치면 5분 안에 반영된다.
 * 백그라운드 갱신이 아니라 요청 시점의 만료라, 아무도 보지 않는 종목은 호출이 늘지 않는다.
 */
export const QUOTE_SNAPSHOT_MAX_TTL_SECONDS = 5 * SECONDS_PER_MINUTE;

/** 세션 기본 TTL(초)에 {@link QUOTE_SNAPSHOT_MAX_TTL_SECONDS} 상한을 씌운다. */
export function quoteSnapshotTtlSeconds(sessionTtlSeconds: number): number {
    return Math.min(sessionTtlSeconds, QUOTE_SNAPSHOT_MAX_TTL_SECONDS);
}
