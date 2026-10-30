import { MONTH_KEY_LENGTH } from './groupCasesByMonth';

/**
 * `YYYY-MM-DD` → `YYYY.MM`. next-intl을 거치지 않는다 — 앞의 `BACKTESTING RESULTS`
 * 키커가 모든 로케일에서 번역되지 않는 라틴 라벨이라, 날짜 조각도 로케일과 무관한
 * 같은 형식으로 둔다.
 */
export function formatPeriodMonth(isoDate: string): string {
    return isoDate.slice(0, MONTH_KEY_LENGTH).replace('-', '.');
}
