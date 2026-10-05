import type { SeoSnapshotTab } from '@/entities/seo-snapshot/model';
import type { SitemapEntry } from '../model';

/** 이번 배치가 스냅샷을 새로 쓴 심볼과 그 탭. */
export interface HarvestedUnits {
    readonly symbol: string;
    readonly tabs: readonly SeoSnapshotTab[];
}

/**
 * 프리웜이 새로 구운 (심볼, 탭) 중 **색인 대상인 URL**만 고른다.
 *
 * URL을 직접 조립하지 않고 sitemap 엔트리에서 거르는 이유: 어떤 탭이 색인 대상인지는
 * sitemap 빌더가 이미 정한다 — 항상 noindex인 다섯 탭 제외, 뉴스 탭의 산문 게이트,
 * 크립토 적용 탭. 여기서 탭 목록을 다시 적으면 빌더가 바뀔 때 한쪽만 따라가
 * noindex URL을 검색엔진에 "바뀌었다"고 알리게 된다(크롤 예산만 태우는 신호).
 *
 * **harvest된 탭의 URL만** 나간다. 예전에는 심볼의 모든 sitemap URL(차트·뉴스·공포탐욕)을
 * 보냈다 — 이번에 굽지 않은 탭(공포탐욕은 프리웜 대상이 아니다)까지 "바뀌었다"고 알리는 셈이었다.
 *
 * 심볼은 URL 경로의 **첫 세그먼트**와 대소문자 무시로 비교한다. 한국 심볼은 점이
 * 들어 있다(`005930.KS`) — 접두사 비교가 아니라 세그먼트 단위 일치여야 `BTC`가
 * `BTCUSD`를 끌어오지 않는다.
 */
export function selectIndexNowUrls(
    units: readonly HarvestedUnits[],
    entries: readonly SitemapEntry[]
): string[] {
    const wanted = new Set(
        units.flatMap(({ symbol, tabs }) =>
            tabs.map(tab => pathKey(symbol.toUpperCase(), tab))
        )
    );
    return entries
        .filter(entry => wanted.has(pathKeyOf(entry.url)))
        .map(entry => entry.url);
}

/** 차트(`technical`)는 심볼 루트, 나머지 탭은 `/{SYMBOL}/{tab}`이다. */
function pathKey(upperSymbol: string, tab: SeoSnapshotTab): string {
    return tab === 'technical'
        ? `/${upperSymbol}`
        : `/${upperSymbol}/${tab.toUpperCase()}`;
}

function pathKeyOf(url: string): string {
    try {
        return new URL(url).pathname.toUpperCase().replace(/\/$/, '');
    } catch {
        return '';
    }
}
