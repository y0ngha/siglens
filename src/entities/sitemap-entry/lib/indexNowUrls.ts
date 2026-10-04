import type { SitemapEntry } from '../model';

/**
 * 프리웜이 새로 구운 심볼 중 **색인 대상인 URL**만 고른다.
 *
 * URL을 직접 조립하지 않고 sitemap 엔트리에서 거르는 이유: 어떤 탭이 색인 대상인지는
 * sitemap 빌더가 이미 정한다 — 항상 noindex인 다섯 탭 제외, 뉴스 탭의 산문 게이트,
 * 크립토 적용 탭. 여기서 탭 목록을 다시 적으면 빌더가 바뀔 때 한쪽만 따라가
 * noindex URL을 검색엔진에 "바뀌었다"고 알리게 된다(크롤 예산만 태우는 신호).
 *
 * 심볼은 URL 경로의 **첫 세그먼트**와 대소문자 무시로 비교한다. 한국 심볼은 점이
 * 들어 있다(`005930.KS`) — 접두사 비교가 아니라 세그먼트 단위 일치여야 `BTC`가
 * `BTCUSD`를 끌어오지 않는다.
 */
export function selectIndexNowUrls(
    symbols: readonly string[],
    entries: readonly SitemapEntry[]
): string[] {
    const wanted = new Set(symbols.map(symbol => symbol.toUpperCase()));
    return entries
        .filter(entry => wanted.has(firstSegmentOf(entry.url)))
        .map(entry => entry.url);
}

function firstSegmentOf(url: string): string {
    try {
        const [, segment = ''] = new URL(url).pathname.split('/');
        return segment.toUpperCase();
    } catch {
        return '';
    }
}
