/** 미국 주식의 정규장 밖 거래 세션. 거래일에만 존재한다. */
export type ExtendedSessionKind = 'pre-market' | 'after-hours';

/**
 * 프리·애프터마켓 한 줄 시세 — **표시 전용**.
 *
 * 봉·`todayBar`·지표·분석 입력·SEO 스냅샷에는 절대 들어가지 않는다
 * (`src/__tests__/guards/extendedHoursDisplayOnly.test.ts`가 고정한다).
 *
 * - `price`: 마지막 확장 세션 체결가(FMP `aftermarket-trade`).
 * - `referenceClose`: 등락 기준 정규장 종가. 프리마켓은 직전 세션 종가, 애프터마켓은
 *   오늘 정규장 종가 — 둘 다 정규장 전용으로 갱신되는 `/quote` 스냅샷의 가격이다.
 * - `tradedAtMs`: 체결 시각(epoch ms).
 */
export interface ExtendedHoursQuote {
    session: ExtendedSessionKind;
    price: number;
    referenceClose: number;
    change: number;
    changePercent: number;
    tradedAtMs: number;
}
