import {
    DASHBOARD_SCOPES,
    dashboardScopeOf,
    isDashboardScopeId,
    KR_DASHBOARD_SCOPE,
    US_DASHBOARD_SCOPE,
} from '../dashboardScope';
import { POPULAR_TICKERS } from '../popular-tickers';

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
        const curatedKr = POPULAR_TICKERS.filter(t => /\.(KS|KQ)$/.test(t));
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
