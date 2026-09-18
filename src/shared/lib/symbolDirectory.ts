import {
    CURATED_KOREAN_NAMES,
    POPULAR_TICKERS,
} from '@/shared/config/popular-tickers';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { isKrEquitySymbol } from '@/shared/config/marketProfile';

/** 디렉터리 한 줄. `koreanName`은 큐레이션 목록에 있을 때만 채워진다. */
export interface SymbolDirectoryItem {
    readonly symbol: string;
    readonly koreanName: string | null;
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
 * **한글명을 `ko`에서만 보여주는 이유**: `CURATED_KOREAN_NAMES`는 한국어 표기라
 * `/en/symbols`에 그대로 두면 영어 화면에 한국어가 섞인다. 심볼만 남겨도 링크
 * 목적에는 충분하다.
 */
export function buildSymbolDirectory(
    options: { readonly withKoreanNames: boolean } = { withKoreanNames: true }
): readonly SymbolDirectorySection[] {
    const toItem = (symbol: string): SymbolDirectoryItem => ({
        symbol,
        koreanName: options.withKoreanNames
            ? (CURATED_KOREAN_NAMES.get(symbol) ?? null)
            : null,
    });
    const sorted = (symbols: readonly string[]) =>
        [...symbols].sort((a, b) => a.localeCompare(b)).map(toItem);

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
