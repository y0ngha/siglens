/**
 * 1년에 해당하는 거래일 수. 비교 게이지의 "1년 전" 기준점과 시계열 차트의
 * "최근 1년" 구간이 같은 값을 쓴다 — 서버는 1년 전 비교에 필요한 약 2년
 * (`CLIENT_FEAR_GREED_HISTORY_POINTS`)을 보내므로, 차트는 이 길이로 잘라 그린다.
 */
export const TRADING_DAYS_1Y = 252;
