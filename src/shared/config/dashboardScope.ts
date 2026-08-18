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
    /**
     * 시세 앞에 붙는 통화 기호.
     *
     * 예전에는 카드가 `$`를 문자열로 박아 뒀는데, 그대로 두면 `/market/kr`에서
     * 코스피가 `$6,869.83`, 삼성전자가 `$268,500`으로 나온다 — 렌더는 정상이고
     * 숫자도 맞아서 테스트로도 안 잡히는 종류의 거짓말이다(실측으로 발견).
     */
    readonly currencySymbol: string;
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
    /**
     * 섹터 ETF 카드를 `/{symbol}` 종목 페이지로 링크할지.
     *
     * 미국은 `true` — 섹터 ETF들이 이미 사이트맵·prewarm 대상이라 크롤러가 와도
     * 채워진 페이지를 본다.
     *
     * 한국은 `false`다. KR 섹터 ETF 6종은 `POPULAR_TICKERS`에 없어서 사이트맵에도,
     * prewarm 회전에도, 한글명 시드에도 없다. 링크를 열면 `/market/kr`(priority 0.9)이
     * **차가운 종목 페이지 6개로 가는 새 크롤 진입점**이 되는데, 봇은 캐시 미스에
     * 분석을 큐에 넣지 않으므로(`skipEnqueueIfMiss`) 딱 thin 변형만 보게 된다 —
     * 2026-07 노출 급감의 메커니즘 그대로다. 여섯 종목을 정식으로 큐레이션에
     * 편입하기 전까지는 링크를 열지 않는다.
     */
    readonly linkSectorCards: boolean;
    /**
     * 이 시장의 변동성 지수 이름. 없으면 `null`.
     *
     * AI 브리핑(`runBriefing`)의 `volatilityAnalysis.vixLevel`을 화면에 그릴지
     * 여기서 정한다. 한국은 `null`이다 — 우리 입력에 VKOSPI가 없는데도 core
     * 프롬프트가 "VIX 지수 값"을 요구해서 모델이 숫자를 **지어낸다**(실측:
     * `/market/kr`에 `VIX 18.30`이 떴는데 KR 요약에는 그런 값이 없다).
     * 근거 없는 숫자를 화면에 올리지 않는 것이 이 필드의 유일한 목적이다.
     */
    readonly volatilityIndexLabel: string | null;
}

export const US_DASHBOARD_SCOPE: DashboardScope = {
    id: 'us',
    currencySymbol: '$',
    linkSectorCards: true,
    volatilityIndexLabel: 'VIX',
    indices: MARKET_INDICES,
    sectorEtfs: SECTOR_ETFS,
    sectorGroups: SECTOR_GROUPS,
    signalSectors: SIGNAL_SECTORS,
    sectorStocks: SECTOR_STOCKS,
};

export const KR_DASHBOARD_SCOPE: DashboardScope = {
    id: 'kr',
    currencySymbol: '₩',
    linkSectorCards: false,
    volatilityIndexLabel: null,
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
    // `Object.hasOwn` — 평범한 객체 리터럴이라 `DASHBOARD_SCOPES['constructor']`가
    // 프로토타입 멤버를 truthy로 돌려준다. 지금은 모든 호출부가 앞서
    // `isDashboardScopeId`로 좁히지만, 이 함수의 계약("알 수 없는 id는 던진다")이
    // 앞으로의 호출부를 지키는 것이라 여기서도 막는다.
    const scope = Object.hasOwn(DASHBOARD_SCOPES, id)
        ? DASHBOARD_SCOPES[id as DashboardScopeId]
        : undefined;
    if (!scope) {
        throw new Error(`[dashboardScope] unknown scope id: ${id}`);
    }
    return scope;
}

/** 런타임 값이 유효한 scope id인지. Server Action 경계에서 좁힐 때 쓴다. */
export function isDashboardScopeId(value: unknown): value is DashboardScopeId {
    return value === 'us' || value === 'kr';
}

/**
 * 클라이언트 컴포넌트에 건네는 축약형 scope.
 *
 * `sectorStocks`를 뺀다. 신호 스캔 대상 목록은 **서버 전용 입력**이다 — 캐시가
 * core `getSectorSignals`에 넘길 때만 쓰고, 클라 위젯은 스캔 *결과*만 읽는다.
 * 그런데 `scope`를 통째로 `'use client'` 패널에 넘기면 그 표(미국 97행)가 RSC
 * Flight 페이로드와 ISR HTML에 매 렌더 실려 나간다. 예전에는 클라가 이 표를 JS
 * 번들에서 읽어 내비게이션 간에 재사용했으니, 배선을 prop으로 바꾸면서 생긴
 * 순수한 회귀다(`docs/architecture/CDN_CACHING.md` — RSC 페이로드 비용).
 */
export type ClientDashboardScope = Omit<DashboardScope, 'sectorStocks'>;

/** 서버 → 클라이언트 경계에서 한 번 호출. 넘길 필드를 여기 한 곳에서만 정한다. */
export function toClientScope(scope: DashboardScope): ClientDashboardScope {
    const { sectorStocks: _serverOnly, ...clientFields } = scope;
    return clientFields;
}
