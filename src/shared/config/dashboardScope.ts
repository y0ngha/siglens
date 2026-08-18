import type {
    IndexTicker,
    SectorEtf,
    SectorGroupDef,
    SectorStock,
} from '@y0ngha/siglens-core';
import {
    MARKET_INDICES,
    SECTOR_ETFS,
    SECTOR_GROUPS,
    SECTOR_STOCKS,
    SIGNAL_SECTORS,
} from './dashboard-tickers';
import {
    KR_MARKET_INDICES,
    KR_SECTOR_ETFS,
    KR_SECTOR_GROUPS,
    KR_SECTOR_STOCKS,
} from './dashboard-tickers-kr';

/** 대시보드가 다루는 시장. `/market`(us)과 `/market/kr`(kr)이 각각 하나씩 쓴다. */
export type DashboardScopeId = 'us' | 'kr';

/**
 * 한 시장의 대시보드 설정 묶음.
 *
 * **왜 묶는가**: 예전에는 `MARKET_INDICES`·`SECTOR_GROUPS`·`SIGNAL_SECTORS`를
 * 위젯·훅·캐시가 각자 모듈 최상단에서 직접 import했다. 시장이 하나일 때는 문제가
 * 없지만, 둘이 되는 순간 "어떤 시장의 설정인가"가 호출 그래프 어디에도 표현되지
 * 않아 한국 페이지가 조용히 미국 종목을 스캔한다. 묶어서 인자로 흐르게 하면
 * 배선 실수가 타입 에러가 된다.
 */
export interface DashboardScope {
    readonly id: DashboardScopeId;
    /** 상단 지수 카드. */
    readonly indices: readonly IndexTicker[];
    /** 시세 카드로 그리는 섹터 ETF. */
    readonly sectorEtfs: readonly SectorEtf[];
    /** 섹터 카드 묶음(성장/방어 등). `symbols`는 `sectorEtfs`의 부분집합이어야 한다. */
    readonly sectorGroups: readonly SectorGroupDef[];
    /**
     * 신호 스캐너 탭에 노출되는 섹터. 미국은 시세 카드에 없는 가상 테마(양자·우주)가
     * 더 붙어 `sectorEtfs`보다 길다. 한국은 지금 둘이 같다.
     */
    readonly signalSectors: readonly SectorEtf[];
    /** 신호를 스캔할 종목. `sectorSymbol`이 `signalSectors`를 가리킨다. */
    readonly sectorStocks: readonly SectorStock[];
}

export const US_DASHBOARD_SCOPE: DashboardScope = {
    id: 'us',
    indices: MARKET_INDICES,
    sectorEtfs: SECTOR_ETFS,
    sectorGroups: SECTOR_GROUPS,
    signalSectors: SIGNAL_SECTORS,
    sectorStocks: SECTOR_STOCKS,
};

export const KR_DASHBOARD_SCOPE: DashboardScope = {
    id: 'kr',
    indices: KR_MARKET_INDICES,
    sectorEtfs: KR_SECTOR_ETFS,
    sectorGroups: KR_SECTOR_GROUPS,
    // 국내에는 상장 ETF가 없는 가상 테마를 따로 두지 않는다 — 신호 탭과 시세 카드가
    // 같은 6종이다.
    signalSectors: KR_SECTOR_ETFS,
    sectorStocks: KR_SECTOR_STOCKS,
};

export const DASHBOARD_SCOPES: Record<DashboardScopeId, DashboardScope> = {
    us: US_DASHBOARD_SCOPE,
    kr: KR_DASHBOARD_SCOPE,
};

/**
 * id → scope. 라우트 파라미터나 Server Action 인자처럼 **직렬화를 건넌 값**에서
 * scope를 되찾을 때 쓴다. 알 수 없는 id는 던진다 — 조용히 미국으로 폴백하면
 * 한국 페이지가 미국 데이터를 그리고도 아무 신호가 없다.
 */
export function dashboardScopeOf(id: string): DashboardScope {
    const scope = DASHBOARD_SCOPES[id as DashboardScopeId];
    if (!scope) {
        throw new Error(`[dashboardScope] unknown scope id: ${id}`);
    }
    return scope;
}

/** 런타임 값이 유효한 scope id인지. Server Action 경계에서 좁힐 때 쓴다. */
export function isDashboardScopeId(value: unknown): value is DashboardScopeId {
    return value === 'us' || value === 'kr';
}
