/**
 * 섹터·타임프레임 선택을 URL 쿼리로 옮기는 순수 헬퍼.
 */
import type { DashboardTimeframe } from '@y0ngha/siglens-core';
import { DEFAULT_DASHBOARD_TIMEFRAME } from '@/shared/config/dashboard-tickers';

const SECTOR_PARAM = 'sector';
const TIMEFRAME_PARAM = 'timeframe';

interface SectorSignalSelection {
    sector: string;
    timeframe: DashboardTimeframe;
    /** 기본 섹터(첫 탭). 기본값이면 쿼리에서 뺀다. */
    defaultSector: string | undefined;
}

/**
 * 현재 쿼리에서 섹터·타임프레임만 갱신한 쿼리 문자열(`?` 없이).
 *
 * 기본값은 쿼리에서 지워 URL을 짧게 유지하고, utm 같은 다른 쿼리는 그대로 보존한다.
 */
export function buildSectorSignalQuery(
    currentSearch: string,
    { sector, timeframe, defaultSector }: SectorSignalSelection
): string {
    const params = new URLSearchParams(currentSearch);
    if (sector === defaultSector) params.delete(SECTOR_PARAM);
    else params.set(SECTOR_PARAM, sector);
    if (timeframe === DEFAULT_DASHBOARD_TIMEFRAME)
        params.delete(TIMEFRAME_PARAM);
    else params.set(TIMEFRAME_PARAM, timeframe);
    return params.toString();
}

/** 경로에 쿼리를 붙인다. 쿼리가 비어 있으면 경로 그대로다. */
export function withQuery(pathname: string, query: string): string {
    return query === '' ? pathname : `${pathname}?${query}`;
}
