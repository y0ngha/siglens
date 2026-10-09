/**
 * 가입 코호트 재방문 창 — 가입일 기준 `[startDay, endDay]`일 안에 회원 방문이 있으면 그
 * 지표의 재방문이다(D7: +7~+13, D30: +30~+36). 창은 7일 폭이다.
 *
 * `signupCohortRetention` SQL과 리포트의 "창이 닫혔는가" 판정(`cohortMaturity`)이 **같은
 * 값**을 써야 한다 — 따로 두면 덜 닫힌 코호트를 확정으로 보여 재방문율이 낮게 찍힌다.
 */
export const RETENTION_WINDOWS = {
    d7: { startDay: 7, endDay: 13 },
    d30: { startDay: 30, endDay: 36 },
} as const;
