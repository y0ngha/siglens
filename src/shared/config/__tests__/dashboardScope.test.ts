import {
    CRYPTO_DASHBOARD_SCOPE,
    DASHBOARD_SCOPES,
    dashboardScopeOf,
    isDashboardScopeId,
    isPageDashboardScopeId,
    KR_DASHBOARD_SCOPE,
    US_DASHBOARD_SCOPE,
} from '../dashboardScope';
import { POPULAR_TICKERS, TICKER_CATEGORIES } from '../popular-tickers';
import { CRYPTO_CATEGORIES } from '../crypto-categories';

const SCOPES = [US_DASHBOARD_SCOPE, KR_DASHBOARD_SCOPE];

describe('dashboard scopes', () => {
    it('keeps every sector group symbol inside its own sectorEtfs', () => {
        // 그룹이 존재하지 않는 ETF를 가리키면 그 자리는 조용히 빈 칸이 된다.
        for (const scope of SCOPES) {
            const known = new Set(scope.sectorEtfs.map(e => e.symbol));
            for (const group of scope.sectorGroups) {
                for (const symbol of group.symbols) {
                    expect(known).toContain(symbol);
                }
            }
        }
    });

    it('places every sector group ETF in exactly one group', () => {
        for (const scope of SCOPES) {
            const grouped = scope.sectorGroups.flatMap(g => g.symbols);
            expect(new Set(grouped).size).toBe(grouped.length);
        }
    });

    it('points every signal stock at a real signal sector', () => {
        // 어긋나면 그 종목은 어느 섹터 탭에서도 보이지 않는다 — 스캔은 돌고 화면엔 없다.
        for (const scope of SCOPES) {
            const sectors = new Set(scope.signalSectors.map(s => s.symbol));
            for (const stock of scope.sectorStocks) {
                expect(sectors).toContain(stock.sectorSymbol);
            }
        }
    });

    it('leaves no signal sector without stocks', () => {
        // 종목이 없는 섹터 탭은 열어 봐야 빈 화면이다.
        for (const scope of SCOPES) {
            for (const sector of scope.signalSectors) {
                const count = scope.sectorStocks.filter(
                    s => s.sectorSymbol === sector.symbol
                ).length;
                expect(count).toBeGreaterThan(0);
            }
        }
    });

    it('never repeats a symbol inside one scope', () => {
        for (const scope of SCOPES) {
            const symbols = scope.sectorStocks.map(s => s.symbol);
            expect(new Set(symbols).size).toBe(symbols.length);
        }
    });

    it('reuses exactly the curated KR ticker set for KR signal scanning', () => {
        // 새 심볼을 넣으면 한글명 시드·사이트맵 범위·prewarm 회전까지 파생 작업이
        // 붙는다. 이 작업(동선 재편) 범위 밖이라 기존 20종을 그대로 쓴다.
        // `kr-trending`(방문 조회수로 스크립트가 채우는 수요 묶음)은 업종 분류가 없어
        // 섹터 스캔 대상이 아니다 — 스크립트가 넣을 때마다 이 검사가 깨지지 않게 뺀다.
        const trendingKr = new Set(
            TICKER_CATEGORIES.find(c => c.id === 'kr-trending')?.items.map(
                i => i.symbol
            ) ?? []
        );
        const curatedKr = POPULAR_TICKERS.filter(
            t => /\.(KS|KQ)$/.test(t) && !trendingKr.has(t)
        );
        expect(
            KR_DASHBOARD_SCOPE.sectorStocks.map(s => s.symbol).sort()
        ).toEqual([...curatedKr].sort());
    });

    it('uses yahoo-shaped provider symbols for KR', () => {
        // `IndexTicker.fmpSymbol`은 core에서 "프로바이더 심볼"이라는 뜻으로 쓰인다 —
        // KR은 yahoo라 `^KS11`/`KRW=X` 형태여야 `getQuote`가 응답한다.
        for (const index of KR_DASHBOARD_SCOPE.indices) {
            expect(index.fmpSymbol).toMatch(/^(\^|[A-Z]{3}=X$)/);
        }
        for (const etf of KR_DASHBOARD_SCOPE.sectorEtfs) {
            expect(etf.symbol).toMatch(/^\d{6}\.(KS|KQ)$/);
        }
    });

    it('declares its own id on every scope', () => {
        for (const [id, scope] of Object.entries(DASHBOARD_SCOPES)) {
            expect(scope.id).toBe(id);
        }
    });
});

describe('dashboardScopeOf', () => {
    it('resolves a known id', () => {
        expect(dashboardScopeOf('kr')).toBe(KR_DASHBOARD_SCOPE);
    });

    it('throws on an unknown id instead of falling back to US', () => {
        // 조용히 미국으로 폴백하면 한국 페이지가 미국 데이터를 그리고도 신호가 없다.
        expect(() => dashboardScopeOf('jp')).toThrow(/unknown scope id/);
    });
});

describe('isDashboardScopeId', () => {
    it('accepts only the declared ids', () => {
        expect(isDashboardScopeId('us')).toBe(true);
        expect(isDashboardScopeId('kr')).toBe(true);
        expect(isDashboardScopeId('jp')).toBe(false);
        expect(isDashboardScopeId(undefined)).toBe(false);
        expect(isDashboardScopeId(null)).toBe(false);
    });
});

/**
 * KRX 티커는 `091160.KS`처럼 6자리 숫자라 읽어서 뜻이 통하지 않는다. 카드가 티커를
 * 주 제목으로 두면 한국 화면의 제목이 전부 숫자가 된다(2026-08-19 프로덕션 실측).
 */
describe('tickerIsReadable', () => {
    it('미국만 티커를 읽을 수 있는 이름으로 취급한다', () => {
        expect(US_DASHBOARD_SCOPE.tickerIsReadable).toBe(true);
        expect(KR_DASHBOARD_SCOPE.tickerIsReadable).toBe(false);
    });
});

/**
 * 크립토 scope는 **화면이 없다** — `get_market_overview`의 `market: 'crypto'`만
 * 쓴다. 스캔 대상이 비면 도구는 조용히 빈 결과를 내고, 그건 "신호가 없는 날"과
 * 구분되지 않는다.
 */
describe('CRYPTO_DASHBOARD_SCOPE', () => {
    it('스캔 대상과 묶음을 갖고, 카드용 필드는 비어 있다', () => {
        expect(CRYPTO_DASHBOARD_SCOPE.sectorStocks.length).toBeGreaterThan(0);
        expect(CRYPTO_DASHBOARD_SCOPE.signalSectors.length).toBeGreaterThan(0);
        expect(CRYPTO_DASHBOARD_SCOPE.indices.length).toBeGreaterThan(0);
        // 크립토에는 섹터 ETF가 없다 — 억지로 채우면 없는 시세를 조회한다.
        expect(CRYPTO_DASHBOARD_SCOPE.sectorEtfs).toEqual([]);
        expect(CRYPTO_DASHBOARD_SCOPE.sectorGroups).toEqual([]);
        expect(CRYPTO_DASHBOARD_SCOPE.volatilityIndexSymbol).toBeNull();
    });

    it('모든 스캔 종목의 sectorSymbol이 signalSectors 안에 있다', () => {
        const groups = new Set(
            CRYPTO_DASHBOARD_SCOPE.signalSectors.map(s => s.symbol)
        );
        for (const stock of CRYPTO_DASHBOARD_SCOPE.sectorStocks)
            expect(groups.has(stock.sectorSymbol)).toBe(true);
    });

    /**
     * 같은 코인의 한국어명이 두 파일에 존재하면 한쪽만 고쳐도 아무 곳에서도
     * 실패하지 않는다 — 이름의 출처는 `CRYPTO_CATEGORIES` 하나여야 한다.
     */
    it('지수 자리의 한국어명은 크립토 카탈로그에서 온다', () => {
        const catalog = new Map(
            CRYPTO_CATEGORIES.flatMap(c => c.items).map(i => [i.symbol, i.name])
        );
        expect(CRYPTO_DASHBOARD_SCOPE.indices.length).toBeGreaterThan(0);
        for (const index of CRYPTO_DASHBOARD_SCOPE.indices) {
            expect(catalog.get(index.symbol)).toBe(index.koreanName);
        }
    });

    it('id로 되찾을 수 있고 런타임 가드도 통과한다', () => {
        expect(dashboardScopeOf('crypto')).toBe(CRYPTO_DASHBOARD_SCOPE);
        expect(isDashboardScopeId('crypto')).toBe(true);
    });

    /**
     * 페이지용 Server Action은 네트워크로 직접 부를 수 있다. 화면 없는 scope가 그
     * 입력으로 통과하면, 아무 페이지도 쓰지 않는 시장의 시세 조회와 브리핑 생성을
     * 외부에서 시킬 수 있다.
     */
    it('허브 페이지가 없으므로 페이지용 scope 가드는 통과하지 못한다', () => {
        expect(CRYPTO_DASHBOARD_SCOPE.hasHubPage).toBe(false);
        expect(isPageDashboardScopeId('crypto')).toBe(false);
        expect(isPageDashboardScopeId('us')).toBe(true);
        expect(isPageDashboardScopeId('kr')).toBe(true);
    });
});

describe('volatilityIndexSymbol', () => {
    /**
     * 근거 없는 숫자를 화면에 올리지 않기 위한 필드다. 미국은 VIX가 실제로
     * 브리핑 입력에 있고, 한국은 없다 — 그런데 core 프롬프트가 VIX 값을 요구해
     * 모델이 지어낸 적이 있다(2026-08-19 `/market/kr` 실측 `VIX 18.30`).
     */
    it('미국만 변동성 지수를 선언한다', () => {
        expect(US_DASHBOARD_SCOPE.volatilityIndexSymbol).toBe('VIX');
        expect(KR_DASHBOARD_SCOPE.volatilityIndexSymbol).toBeNull();
    });
});
