import type { MarketDailyClose } from '@y0ngha/siglens-core';

/**
 * 실현변동성 창(거래일). CNN이 쓰는 VIX가 30일 내재변동성이라 그 축척에 맞춘 20일 —
 * 국내 지수의 월 평균 거래일수이기도 하다.
 */
export const REALIZED_VOL_WINDOW = 20;

/** 연율화 계수(거래일 기준). KRX 정규장은 연 약 245~250일이라 통상값 252를 쓴다. */
const TRADING_DAYS_PER_YEAR = 252;

/**
 * 일별 종가 시리즈 → 20일 실현변동성(연율) 시리즈.
 *
 * **왜 이 함수가 필요한가**: core의 시장 공포·탐욕 지수는 `vix` 슬롯에 "변동성 레벨
 * 시계열"을 요구한다(요인 정의: 50일 이동평균 대비 거리를 부호 반전). 미국은 `^VIX`를
 * 그대로 넣지만, 한국의 대응 지수 VKOSPI는 **무료로 받을 수 있는 경로가 없다** —
 * yahoo는 `^VKOSPI`에 `No data found`를 반환하고(2026-08-18 실측), 공공데이터포털
 * 지수시세 서비스는 기존 서비스키로 `SERVICE_KEY_IS_NOT_REGISTERED_ERROR`(403)다.
 * 그래서 코스피 종가에서 직접 산출한다.
 *
 * **왜 이것이 정당한 대체인가**: 요인이 보는 것은 "변동성 수준이 자기 평균 대비
 * 높은가 낮은가"이고, 실현변동성은 내재변동성과 같은 방향(높을수록 공포)의 레벨
 * 시리즈다. 백분위 환산은 시리즈 자신의 과거 분포 안에서 이뤄지므로 절대 수준이
 * VKOSPI와 달라도 요인 값은 왜곡되지 않는다.
 *
 * **왜 core가 아니라 여기인가**: 이것은 새 보조지표가 아니라 데이터 소스 적응이다 —
 * 미국 쪽이 `^GSPC` 대신 SPY를 고른 것과 같은 층의 결정이고, core는 티커도 소스도
 * 모른다(`marketFearGreedSymbols.ts` 주석: data-source knowledge belongs to the
 * consumer). 화면에는 "실현변동성"이라고 명시해 감추지 않는다.
 *
 * @param closes - 정렬 여부 무관. 내부에서 날짜 오름차순으로 정렬한다.
 * @returns 창이 다 찬 날짜부터의 연율 변동성. 입력이 창보다 짧으면 `[]`.
 *   반환 시리즈는 입력보다 `REALIZED_VOL_WINDOW`개 짧다 — core가 여섯 시리즈를
 *   날짜 기준 inner join하므로 앞쪽이 잘려도 나머지 시리즈가 자동으로 맞춰진다.
 */
export function toRealizedVolatilitySeries(
    closes: readonly MarketDailyClose[]
): MarketDailyClose[] {
    const sorted = [...closes].sort((a, b) => a.date.localeCompare(b.date));

    // 로그수익률. 0 이하 종가는 로그가 정의되지 않으므로 그 지점에서 창을 끊는다
    // (분할·병합 같은 데이터 오류가 NaN으로 전파되는 것을 막는다).
    const returns: { date: string; value: number }[] = [];
    for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1].close;
        const curr = sorted[i].close;
        if (prev <= 0 || curr <= 0) continue;
        returns.push({ date: sorted[i].date, value: Math.log(curr / prev) });
    }

    if (returns.length < REALIZED_VOL_WINDOW) return [];

    const out: MarketDailyClose[] = [];
    for (let end = REALIZED_VOL_WINDOW; end <= returns.length; end++) {
        const window = returns.slice(end - REALIZED_VOL_WINDOW, end);
        const mean =
            window.reduce((sum, r) => sum + r.value, 0) / REALIZED_VOL_WINDOW;
        // 표본분산(n-1). 창이 20이라 모분산(n)과의 차이가 작지만, 표본에서
        // 추정하는 값이므로 통계적으로 맞는 쪽을 쓴다.
        const variance =
            window.reduce((sum, r) => sum + (r.value - mean) ** 2, 0) /
            (REALIZED_VOL_WINDOW - 1);
        out.push({
            date: window[window.length - 1].date,
            // 백분율 표기(VIX와 같은 축척) — `16.4`는 연율 16.4%를 뜻한다.
            // core는 레벨의 상대 위치만 보므로 배율 자체는 결과에 영향이 없지만,
            // 로그에 찍혔을 때 사람이 바로 읽을 수 있는 단위를 고른다.
            close: Math.sqrt(variance * TRADING_DAYS_PER_YEAR) * 100,
        });
    }
    return out;
}
