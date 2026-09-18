import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { isKrEquitySymbol } from '@/shared/config/marketProfile';

/**
 * 디렉터리 한 줄. `label`은 화면에 그대로 찍히는 최종 문자열이다.
 *
 * 이름을 아는 종목은 `자산명 (티커)`, 모르면 티커만이다 — 옛 판(`티커 한글명`)은
 * 이름이 있는 줄과 없는 줄이 서로 다른 모양이 돼 목록이 들쭉날쭉했다.
 */
export interface SymbolDirectoryItem {
    readonly symbol: string;
    readonly label: string;
}

/** 심볼 → 표기 이름. 호출부(페이지)가 DB에서 읽어 넘긴다. */
export type SymbolNameMap = ReadonlyMap<string, string>;

function labelFor(symbol: string, names: SymbolNameMap): string {
    const name = names.get(symbol);
    return name === undefined || name === '' ? symbol : `${name} (${symbol})`;
}

/** 자산군 한 묶음. `labelKey`는 내비가 이미 네 로케일로 갖고 있는 지역 이름이다. */
export interface SymbolDirectorySection {
    readonly id: 'us' | 'kr' | 'crypto';
    readonly labelKey: string;
    readonly items: readonly SymbolDirectoryItem[];
}

/**
 * `/symbols` 디렉터리의 자산군 구성.
 *
 * **왜 이 페이지가 필요한가**: 2026-09-18 실측에서 sitemap 심볼 416개 중 147개가
 * 홈에서 3클릭 안에 닿지 않았다(깊이 2에서 sitemap 도달 27%, 깊이 3에서 51%).
 * 큐레이션 카테고리(`TICKER_CATEGORIES`, 84개)만 화면에 링크돼 있고 나머지는
 * `RelatedSymbols` 링에 걸린 것만 발견되기 때문이다. 구글은 내부 링크를 크롤
 * 우선순위 신호로 쓰므로, sitemap에만 있는 URL은 "발견됨 – 색인 안 됨"에 머문다.
 *
 * **왜 카테고리 라벨로 잘게 나누지 않는가**: `TICKER_CATEGORIES[].label`은 config
 * 안의 한국어 리터럴이라 네 로케일 화면에 그대로 새고, 84개만 덮으므로 나머지
 * 303개는 어차피 "그 외"로 몰린다. 자산군 3개로만 묶고 안에서 알파벳 정렬하면
 * 라벨을 새로 번역할 것이 없고(내비의 지역 이름 재사용), 크롤러가 얻는 것은
 * 동일하다 — 링크의 존재 자체다.
 *
 * **이름은 호출부가 넘긴다**: 416개 중 상수로 이름을 아는 건 84개뿐이고 나머지는
 * DB(`korean_tickers`·`crypto_assets`)에 있다. 이 모듈은 순수하게 두고, 페이지가
 * 로케일에 맞는 이름(한국어/영문)을 읽어 맵으로 넘긴다 — 여기서 DB를 읽으면
 * 순수 함수 테스트가 통째로 DB에 묶인다.
 */
export function buildSymbolDirectory(
    names: SymbolNameMap = new Map()
): readonly SymbolDirectorySection[] {
    const sorted = (symbols: readonly string[]) =>
        [...symbols]
            .sort((a, b) => a.localeCompare(b))
            .map(symbol => ({ symbol, label: labelFor(symbol, names) }));

    const krTickers = POPULAR_TICKERS.filter(isKrEquitySymbol);
    const usTickers = POPULAR_TICKERS.filter(t => !isKrEquitySymbol(t));

    return [
        {
            id: 'us',
            labelKey: 'shared.config.nav.region.us',
            items: sorted(usTickers),
        },
        {
            id: 'kr',
            labelKey: 'shared.config.nav.region.kr',
            items: sorted(krTickers),
        },
        {
            id: 'crypto',
            labelKey: 'shared.config.nav.region.crypto',
            items: sorted(POPULAR_CRYPTOS),
        },
    ];
}

/** 디렉터리가 링크하는 심볼 수 — 화면 캡션과 테스트가 같은 값을 쓴다. */
export function symbolDirectoryCount(
    sections: readonly SymbolDirectorySection[]
): number {
    return sections.reduce((sum, section) => sum + section.items.length, 0);
}
