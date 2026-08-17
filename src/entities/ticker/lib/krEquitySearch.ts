import { isKrEquitySymbol } from '@/shared/config/marketProfile';
import { krExchangeOf } from './krExchange';
import { CURATED_KOREAN_NAMES } from '@/shared/config/popular-tickers';
import { isKoreanInput } from './ticker';
import { pickYahooDisplayName } from '@/shared/api/yahoo/displayName';
import type { TickerSearchResult } from '@/shared/lib/types';

/**
 * 종목코드 형상 — 6자리 숫자, 거래소 접미사는 선택.
 *
 * KONEX(`.KN`)는 넣지 않는다. yahoo에 KONEX 데이터가 없음을 실측으로 확인했다
 * (2026-08-16: `.KN` 심볼 검색 0건, 후보 코드 전부 `.KQ`로만 해석). 통과시켜 봐야
 * 시세가 없어 404로 끝나므로, 형상 단계에서 막아 헛된 조회를 없앤다.
 */
const KR_CODE_QUERY_RE = /^\d{6}(\.K[SQ])?$/i;

/** 라틴 문자·숫자로 이뤄진 회사명 질의(`samsung`, `SK hynix`). 최소 2자. */
const LATIN_NAME_QUERY_RE = /^[A-Za-z0-9][A-Za-z0-9 .&'-]{1,}$/;

/**
 * yahoo `search`가 회사명으로 돌려주는 결과 상한.
 * 코드 질의는 1~2건이면 끝나지만 이름 질의는 동명 계열사가 많아 여유를 둔다.
 */
const MAX_NAME_RESULTS = 8;

/**
 * yahoo 검색을 태울 가치가 있는 질의인지 판정한다.
 *
 * **한글은 제외한다** — yahoo `search`는 한글 질의에 `BadRequestError: Invalid Search Query`를
 * 돌려준다(실측). 호출해 봐야 예외만 나므로 한글 경로는 `korean_tickers`(data.go.kr 시드 +
 * lazy 번역)가 전담한다.
 *
 * 영문 질의를 허용하는 이유: yahoo는 `samsung`에 한국 종목 4건을 정상 반환한다. 초기에는
 * 미국 검색 지연을 우려해 코드 질의만 열어 뒀는데, 그 결과 국내 종목을 영문명으로 찾는
 * 경로가 통째로 막혀 있었다. `searchTicker`가 이 호출을 FMP 조회와 **병렬**로 돌리므로
 * 추가 비용은 합이 아니라 최댓값이며, 실패 시 빈 배열로 degrade한다.
 */
function shouldQueryYahoo(query: string): boolean {
    if (isKoreanInput(query)) return false;
    return KR_CODE_QUERY_RE.test(query) || LATIN_NAME_QUERY_RE.test(query);
}

/**
 * 한국 상장 종목 검색.
 *
 * 종목코드(`005930`)와 영문 회사명(`samsung`) 질의를 yahoo로 보낸다. 한글 질의는
 * yahoo가 거부하므로 `searchTicker`의 한글 분기(`searchByKoreanName`)가 처리한다 —
 * 그쪽 데이터는 data.go.kr 종목 마스터 시드와 lazy 번역이 채운다.
 *
 * 크립토 파생 심볼(`005930-USD`, exchange `CCC`)이 같은 응답에 섞여 오지만
 * `isKrEquitySymbol`이 형상에서 걸러낸다.
 */
export async function searchKrEquity(
    query: string
): Promise<TickerSearchResult[]> {
    const trimmed = query.trim();
    if (!shouldQueryYahoo(trimmed)) return [];

    // 동적 import 근거는 krEquityQuoteName.ts 참조 — yahoo-finance2는 Node 전용이고
    // 이 모듈은 클라이언트가 import하는 ticker barrel 체인에 닿아 있다.
    const { searchYahooQuotes } =
        await import('@/shared/api/yahoo/yahooSearch');
    const quotes = await searchYahooQuotes(trimmed);

    return quotes
        .filter(q => isKrEquitySymbol(q.symbol))
        .slice(0, MAX_NAME_RESULTS)
        .map(q => {
            const symbol = q.symbol.toUpperCase();
            const exchange = krExchangeOf(symbol);
            // 카탈로그 한글명이 있으면 즉시 붙인다 — 검색 결과에 영문 사명만 뜨는 것을 막는다.
            // 카탈로그 밖 종목은 종목 마스터 시드나 방문 시 lazy 번역이 채운다.
            const koreanName = CURATED_KOREAN_NAMES.get(symbol);
            return {
                symbol,
                name: pickYahooDisplayName(symbol, q.longname, q.shortname),
                exchange: exchange.code,
                exchangeFullName: exchange.fullName,
                marketProfile: 'kr-equity' as const,
                ...(koreanName ? { koreanName } : {}),
            };
        });
}
