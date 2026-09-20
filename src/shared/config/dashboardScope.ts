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
import {
    CRYPTO_MARKET_INDICES,
    CRYPTO_SECTOR_STOCKS,
    CRYPTO_SIGNAL_SECTORS,
} from './dashboard-tickers-crypto';

/**
 * 대시보드가 다루는 시장. `/market`(us)과 `/market/kr`(kr)이 각각 하나씩 쓰고,
 * `crypto`는 **페이지가 없다** — 에이전트의 `get_market_overview`가 크립토 신호
 * 스캔을 돌릴 때만 쓴다(`CRYPTO_DASHBOARD_SCOPE` 주석 참고).
 */
export type DashboardScopeId = 'us' | 'kr' | 'crypto';

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
     * 이 시장의 표시 이름. core `runBriefing`의 `MarketBriefingContext.marketLabel`로
     * 그대로 흘러가 프롬프트 프레이밍과 캐시 키에 들어간다.
     *
     * 예전에는 core가 시장을 몰랐고, 한국 요약을 넣어도 프롬프트가 미국을 전제해
     * `XLK·XLV·XLY` 같은 **입력에 없는 티커**를 돌려줬다. 이름을 데이터로 넘겨
     * "다른 시장 것은 끌어오지 말라"는 경계 규칙이 걸리게 한다.
     */
    readonly marketLabel: string;
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
     * 이 시장 변동성 지수의 {@link indices} 내 `symbol`. 없으면 `null`.
     *
     * 두 곳이 쓴다: 요약에서 그 지수 시세를 찾아 core에 **값으로 건네고**(브리핑
     * 프롬프트는 안 준 숫자를 묻지 않는다), 카드에서 그 숫자를 그릴 때 라벨로 쓴다.
     * 지금은 심볼과 표시 이름이 같아(`'VIX'`) 한 필드로 충분하다 — 둘이 갈리는
     * 시장이 생기면 그때 나눈다.
     *
     * 한국은 `null`이다. 우리 입력에 VKOSPI가 없는데도 예전 core 프롬프트가
     * "VIX 지수 값"을 요구해서 모델이 숫자를 **지어냈다**(실측: `/market/kr`에
     * `VIX 18.30`이 떴는데 KR 요약에는 그런 값이 없다).
     */
    readonly volatilityIndexSymbol: string | null;
    /**
     * 이 시장의 티커가 **사람이 읽어서 뜻이 통하는가**.
     *
     * 시세 카드는 티커를 크게, 한국어명을 작게 두는 배치였다. 미국은 그게 맞다 —
     * `XLK`·`XLF`는 독자가 알아보는 이름이다. 한국은 `091160.KS`·`005930.KS`처럼
     * KRX 6자리 숫자라 **누구에게도 의미가 없고**, 정작 알아볼 수 있는 `반도체`·
     * `삼성전자`가 작은 회색 글씨로 밀려난다(2026-08-19 `/market/kr` 프로덕션 실측).
     * 같은 화면의 AI 브리핑이 이미 "반도체·은행"으로 이름을 쓰고 있어 표기가
     * 화면 안에서 엇갈리기까지 했다.
     *
     * `false`면 카드가 한국어명을 주 제목으로, 티커를 보조로 뒤집는다. 티커는
     * 그대로 DOM에 남는다 — 크롤러와 검색 대상에서 빼려는 게 아니라 시각적
     * 우선순위만 바꾸는 것이다. `$`를 원화에 붙였던 것과 같은 축의 미국 전제다.
     */
    readonly tickerIsReadable: boolean;
    /**
     * 이 시장을 **렌더하는 허브 페이지가 있는가**(`/market`, `/market/kr`).
     *
     * scope 목록을 통째로 도는 코드가 있다 — `seo-prewarm`의 `marketBriefingTargets`는
     * `Object.values(DASHBOARD_SCOPES)`를 돌며 시장 브리핑을 **생성**한다(LLM 호출).
     * 화면이 없는 scope가 그 순회에 끼면 아무도 읽지 않는 브리핑을 매일 밤 돈 주고
     * 굽는다. `crypto`가 정확히 그런 scope다(에이전트 도구 전용).
     *
     * 불리언을 여기 두는 이유는 순회하는 쪽에서 id를 하드코딩해 거르면, 다음에
     * 추가되는 scope가 **아무 결정도 하지 않은 채** 프리웜에 딸려 들어가기 때문이다.
     */
    readonly hasHubPage: boolean;
}

export const US_DASHBOARD_SCOPE: DashboardScope = {
    id: 'us',
    hasHubPage: true,
    // 화면 문구가 아니라 **core 프롬프트로 가는 값**이다(§marketBriefingContext).
    // 영어로 두는 이유는 `CALENDAR_REGION_LABEL`과 같다 — 모델 지시문이
    // 로케일로 갈리면 프롬프트만 흔들린다. 화면은 `MarketDataErrorNotice`처럼
    // 별도 메시지 키를 쓴다.
    marketLabel: 'US market',
    currencySymbol: '$',
    linkSectorCards: true,
    volatilityIndexSymbol: 'VIX',
    tickerIsReadable: true,
    indices: MARKET_INDICES,
    sectorEtfs: SECTOR_ETFS,
    sectorGroups: SECTOR_GROUPS,
    signalSectors: SIGNAL_SECTORS,
    sectorStocks: SECTOR_STOCKS,
};

export const KR_DASHBOARD_SCOPE: DashboardScope = {
    id: 'kr',
    hasHubPage: true,
    marketLabel: 'Korean market',
    currencySymbol: '₩',
    linkSectorCards: false,
    volatilityIndexSymbol: null,
    // `091160.KS`는 읽어서 뜻이 통하지 않는다.
    tickerIsReadable: false,
    indices: KR_MARKET_INDICES,
    sectorEtfs: KR_SECTOR_ETFS,
    sectorGroups: KR_SECTOR_GROUPS,
    // 국내에는 상장 ETF가 없는 가상 테마를 따로 두지 않는다 — 신호 탭과 시세 카드가
    // 같은 6종이다.
    signalSectors: KR_SECTOR_ETFS,
    sectorStocks: KR_SECTOR_STOCKS,
};

/**
 * 크립토 — **화면 없는 scope**. `/market/crypto` 페이지는 없고, 에이전트 도구
 * (`get_market_overview`의 `market: 'crypto'`)만 이 scope로 신호 스캔과 시세를
 * 읽는다. 페이지가 없으니 카드 표시용 필드(`sectorEtfs`·`sectorGroups`)는 비고,
 * 그 결과 시장 요약의 `sectors`도 빈 배열이 된다 — 크립토에는 섹터 ETF가 없어
 * 억지로 채울 대상 자체가 없다. 묶음은 `signalSectors`(메이저·알트코인)가 대신한다.
 *
 * `volatilityIndexSymbol`은 `null`이다. 한국과 같은 이유로, 입력에 없는 변동성
 * 지수를 요구하면 모델이 숫자를 지어낸다.
 */
export const CRYPTO_DASHBOARD_SCOPE: DashboardScope = {
    id: 'crypto',
    // `/market/crypto`는 없다 — 프리웜·페이지용 Server Action이 이 scope를 건드리면 안 된다.
    hasHubPage: false,
    marketLabel: 'Crypto market',
    currencySymbol: '$',
    // 카드가 없으니 링크할 것도 없다.
    linkSectorCards: false,
    volatilityIndexSymbol: null,
    tickerIsReadable: true,
    indices: CRYPTO_MARKET_INDICES,
    sectorEtfs: [],
    sectorGroups: [],
    signalSectors: CRYPTO_SIGNAL_SECTORS,
    sectorStocks: CRYPTO_SECTOR_STOCKS,
};

export const DASHBOARD_SCOPES: Record<DashboardScopeId, DashboardScope> = {
    us: US_DASHBOARD_SCOPE,
    kr: KR_DASHBOARD_SCOPE,
    crypto: CRYPTO_DASHBOARD_SCOPE,
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
    return value === 'us' || value === 'kr' || value === 'crypto';
}

/**
 * **허브 페이지가 쓰는** scope id인지. 페이지에 붙은 Server Action은 이쪽으로 좁힌다.
 *
 * `isDashboardScopeId`는 "이 앱이 아는 시장인가"만 본다. 그 유니온이 넓어질 때마다
 * 페이지용 액션의 입력도 같이 넓어지는데, 액션은 네트워크로 직접 부를 수 있으므로
 * 화면이 없는 scope까지 시세 조회와 브리핑 생성을 시킬 수 있게 된다 —
 * `crypto`를 추가했을 때 실제로 그랬다.
 */
export function isPageDashboardScopeId(
    value: unknown
): value is DashboardScopeId {
    return isDashboardScopeId(value) && DASHBOARD_SCOPES[value].hasHubPage;
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
