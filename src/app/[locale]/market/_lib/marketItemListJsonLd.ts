import { isPopularSymbol } from '@/entities/ticker/lib/searchRelevance';
import type { DashboardScope } from '@/shared/config/dashboardScope';
import type { Locale } from '@/shared/i18n/locales';
import { localizedAbsoluteUrl, SITE_URL } from '@/shared/lib/seo';

/**
 * `/market`·`/market/kr`의 섹터 ETF `ItemList` 구조화데이터.
 *
 * - **`signalSectors`가 아니라 `sectorEtfs`를 싣는다.** 전자는 스캐너 탭 목록이라 ETF가 없는
 *   가상 테마까지 들어 있는데, 존재하지 않는 티커를 ListItem으로 선언하면 구조화데이터가
 *   화면·실물과 어긋난다. 가상 테마는 스캐너 UI에 그대로 남는다.
 * - 항목 `url`은 그 종목 페이지(`/{symbol}`, 로케일별)이고 색인되는 종목(`isPopularSymbol`)에만
 *   단다 — 큐레이션 밖 종목 페이지는 noindex라, 그 URL을 선언하면 크롤 예산만 그쪽으로 간다.
 *   나머지는 ListItem `name`(괄호 안 symbol)으로만 식별한다. 이 허브 자신(`?sector=` 변형은
 *   비-canonical)은 가리키지 않는다.
 * - `name`(`itemListName`)은 개수를 표기하지 않는다 — 설정이 바뀌면 고정 개수는 쉽게 낡는다.
 */
export function buildMarketItemListJsonLd(
    scope: DashboardScope,
    itemListName: string,
    locale: Locale
): Record<string, unknown> {
    return {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: itemListName,
        itemListElement: scope.sectorEtfs.map((sector, idx) => ({
            '@type': 'ListItem',
            position: idx + 1,
            name: `${sector.koreanName} (${sector.sectorName}, ${sector.symbol})`,
            ...(isPopularSymbol(sector.symbol) && {
                url: localizedAbsoluteUrl(
                    `${SITE_URL}/${sector.symbol}`,
                    locale
                ),
            }),
        })),
    };
}
