import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { SECTOR_ETFS, SECTOR_STOCKS } from '@/shared/config/dashboard-tickers';
import { evaluateSymbolIndexability } from '@/entities/symbol-indexability/lib/evaluateSymbolIndexability';
import { isCuratedSymbol } from '@/entities/symbol-indexability/lib/isCuratedSymbol';
import { DASHBOARD_SCOPES } from '@/shared/config/dashboardScope';
import type { AssetInfo } from '@/shared/lib/types';

/**
 * `/market` 섹터 허브(색인 대상)가 링크하는 심볼은 전부 색인 가능해야 한다.
 *
 * 2026-08-24 프로덕션 실측에서 `SECTOR_ETFS` 11종 전부와 `SECTOR_STOCKS` 12종이
 * `POPULAR_TICKERS`에 없어 `evaluateSymbolIndexability`가
 * `longtail-default-blocked`로 판정하고 있었다 — 색인된 허브가
 * `noindex, nofollow` + 본문 893~1,131자짜리 막다른 페이지 23개를 링크하는
 * 상태였다. 크롤 예산은 소모하면서 색인은 되지 않고, 허브의 ItemList JSON-LD가
 * 가리키는 대상이 색인 불가다.
 *
 * dashboard 그리드에 심볼을 추가할 때 `POPULAR_TICKERS`를 같이 갱신하지 않으면
 * 같은 결함이 조용히 재발하므로 여기서 강제한다.
 *
 * 멤버십이 아니라 **게이트 판정**을 단언한다 — `POPULAR_TICKERS`에 있다는 것과
 * `evaluateSymbolIndexability`가 indexable을 준다는 것은 다른 명제이고, 페이지가
 * 실제로 쓰는 건 후자다.
 */
describe('/market 섹터 허브 링크 대상의 색인 가능성', () => {
    const hubSymbols = [
        ...SECTOR_ETFS.map(e => e.symbol),
        ...SECTOR_STOCKS.map(s => s.symbol),
    ];

    it('허브 심볼 목록이 비어 있지 않다 (빈 배열로 통과하는 공허한 참 방지)', () => {
        expect(hubSymbols.length).toBeGreaterThan(50);
    });

    it('허브가 링크하는 심볼이 전부 POPULAR_TICKERS에 있다', () => {
        const popular = new Set<string>(POPULAR_TICKERS);
        expect(hubSymbols.filter(s => !popular.has(s))).toEqual([]);
    });

    it('허브가 링크하는 심볼이 전부 색인 가능으로 판정된다', () => {
        const blocked = hubSymbols.filter(
            symbol =>
                !evaluateSymbolIndexability({
                    symbol,
                    assetInfo: { symbol, name: symbol } as AssetInfo,
                    degraded: false,
                    locale: 'ko',
                }).indexable
        );
        expect(blocked).toEqual([]);
    });
});

/**
 * `SectorFactsSummary`(`/market`·`/market/kr` 영구 서버 sibling)는 섹터 신호가 잡힌 종목의
 * `/{symbol}` 앵커를 **큐레이션 검사 없이** 낸다. 그 근거가 이 불변식이다 — 스캔 대상
 * (`DashboardScope.sectorStocks`: 미국·한국·암호화폐 전부)은 항상 큐레이션 집합(`isCuratedSymbol`)
 * 안에 있어, 앵커가 noindex 롱테일로 가는 일이 없다. 스캔 목록에 심볼을 더할 때 큐레이션
 * 집합(`POPULAR_TICKERS`/`POPULAR_CRYPTOS`)에도 더하지 않으면 이 테스트가 실패한다 — 그때는
 * 목록을 고치거나 `SectorFactsSummary`에 `isCuratedSymbol` 분기를 넣는다(`SignalStockCard` 방식).
 */
describe('대시보드 스캔 대상(sectorStocks)은 전부 큐레이션 집합이다', () => {
    it.each(Object.entries(DASHBOARD_SCOPES))(
        '%s 스코프의 sectorStocks가 전부 isCuratedSymbol이다',
        (_id, scope) => {
            expect(scope.sectorStocks.length).toBeGreaterThan(0);
            expect(
                scope.sectorStocks
                    .map(stock => stock.symbol)
                    .filter(symbol => !isCuratedSymbol(symbol))
            ).toEqual([]);
        }
    );
});
