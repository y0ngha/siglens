import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import {
    CURATED_KOREAN_NAMES,
    POPULAR_TICKERS,
    TICKER_CATEGORIES,
} from '@/shared/config/popular-tickers';
import { CRYPTO_CATEGORIES } from '@/shared/config/crypto-categories';
import { KR_EXCHANGE_SUFFIX_RE, KR_SYMBOL_RE } from '@/shared/config/ticker';
import {
    MARKET_INDICES,
    SECTOR_ETFS,
    SECTOR_STOCKS,
} from '@/shared/config/dashboard-tickers';

/**
 * 한 심볼 페이지가 내보내는 연관 종목 링크 수. "관련 검색어" 스트립처럼 한눈에
 * 읽히는 크기여야 하므로 늘리지 않는다 — 유니버스 431종을 전부 나열하는 디렉터리
 * 페이지는 의도적으로 만들지 않았다(사용자 결정, 2026-08-24).
 */
export const RELATED_SYMBOL_COUNT = 8;

/**
 * 관련성 데이터가 없어도 **반드시** 확보해야 하는 링 이웃 수(한쪽당).
 *
 * 이 2칸(앞 1 + 뒤 1)이 유니버스 전체를 하나의 해밀턴 순환으로 잇는다 —
 * `relatedSymbolsFor`의 고아 0 보장이 여기서 나온다. 테마 피어가 아무리 많아도
 * 이 두 자리는 잘라내지 않는다.
 */
const GUARANTEED_RING_REACH = 1;

/** 테마 피어가 모자랄 때 링을 넓혀 채우는 최대 반경(한쪽당). */
const MAX_RING_REACH = 4;

export interface RelatedSymbol {
    /** canonical 심볼 — **URL에 쓰는 값**. 거래소 접미사를 그대로 유지한다. */
    symbol: string;
    /**
     * 칩에 **보여 줄** 티커. 국내 종목은 거래소 접미사(`.KS`/`.KQ`)를 뗀다
     * (`005930.KS` → `005930`).
     *
     * 접미사는 yahoo 벤더 규약이고 한국 검색량이 0이다 — 실제로 검색되는 건
     * 6자리 코드다. 사이트의 title 표기(`삼성전자(005930) 주가 전망`)와
     * JSON-LD 식별자(`KRX:005930`)가 이미 같은 절단을 하므로, 여기만 다르게
     * 두면 같은 종목이 화면마다 다른 이름으로 보인다.
     *
     * ⚠️ 표기 전용이다. {@link symbol}(=`href`)은 절대 자르지 않는다 — 접미사가
     * 없으면 라우트가 종목을 특정하지 못한다.
     */
    displayTicker: string;
    /** 큐레이션 소스에 한글명이 있으면 앵커 텍스트에 함께 쓴다. 없으면 티커만. */
    koreanName?: string;
}

/**
 * 무비용으로 얻을 수 있는 한글명 전부를 합친 맵 — **폴백 전용**이다.
 *
 * 실제 칩 이름은 `RelatedSymbols`가 `getAssetInfoResilient`(DB)로 채우고, 이 맵은
 * DB에 이름이 없을 때만 쓰인다. 이 모듈은 순수 함수라 I/O를 할 수 없으므로
 * (ISR cold-gen 경로에서 심볼당 8번 호출된다) 상수에서 긁을 수 있는 것만 모은다.
 * 유니버스 431종 중 약 3분의 1을 덮는다.
 *
 * ## 소스 우선순위 — 뒤에 spread된 쪽이 이긴다
 *
 * `Map` 생성자는 같은 키가 두 번 오면 **나중 값으로 조용히 덮어쓴다.** 그래서
 * 아래 나열 순서가 곧 우선순위이고, 의도는 "좁고 사람이 고른 것"보다 "넓고
 * 기계적인 것"을 뒤에 두지 않는 것이다:
 *
 * 1. `CURATED_KOREAN_NAMES` — 홈 디스커버리 카테고리(사람이 고른 표기)
 * 2. `SECTOR_STOCKS` / `SECTOR_ETFS` — 대시보드 섹터 표기
 * 3. `MARKET_INDICES` — 지수
 * 4. `CRYPTO_CATEGORIES` — 암호화폐(주식과 심볼이 겹치지 않는다)
 *
 * 현재 소스 간 값이 어긋나는 심볼은 없다. 다만 그건 우연이 아니라 **테스트가
 * 고정하는 계약**이다 — `relatedSymbols.test.ts`의 "소스 간 한글명이 어긋나지
 * 않는다"가 충돌을 즉시 실패로 만든다. 소스를 추가할 때 이름이 예고 없이 바뀌는
 * 회귀를 그 테스트가 잡는다(claude-review PR #765 제안).
 */
const KOREAN_NAMES: ReadonlyMap<string, string> = new Map<string, string>([
    ...CURATED_KOREAN_NAMES,
    ...SECTOR_STOCKS.map(s => [s.symbol, s.koreanName] as const),
    ...SECTOR_ETFS.map(e => [e.symbol, e.koreanName] as const),
    ...MARKET_INDICES.map(i => [i.symbol, i.koreanName] as const),
    ...CRYPTO_CATEGORIES.flatMap(c =>
        c.items.map(i => [i.symbol, i.name] as const)
    ),
]);

/**
 * 시장을 넘는 큐레이션 테마 — **미국·한국을 의도적으로 한 그룹에 묶는다.**
 *
 * 나머지 소스는 시장이 갈려 있다: `TICKER_CATEGORIES`는 미국/한국 카테고리가
 * 분리돼 있고, `SECTOR_STOCKS`는 미국 전용이다. 그래서 이 상수가 없으면
 * `NVDA`와 `삼성전자`는 영원히 서로를 링크하지 않는다 — 실제 산업 관계는 그
 * 반대인데도. 엔비디아 GPU는 삼성전자·SK하이닉스 HBM 없이는 못 만들고, 한국
 * 사용자가 `NVDA 주가`를 검색한 뒤 다음으로 보는 것도 대개 그쪽이다.
 *
 * 그룹 안의 **순서가 노출 순서**다(앞쪽이 먼저 나간다). 밸류체인 상류→하류 또는
 * 대표성 순으로 적는다.
 *
 * ⚠️ 이 목록은 링(배열 인접성)과 성격이 다르다. 링은 위치 잡음이라 시장을 넘을
 * 근거가 못 되지만, 여기 적힌 관계는 사람이 판단한 근거다 —
 * `relatedSymbols.test.ts`의 "테마 근거 없이 시장을 넘지 않는다"가 그 구분을 고정한다.
 */
const CROSS_MARKET_THEME_GROUPS: readonly (readonly string[])[] = [
    // AI 반도체 밸류체인 — GPU/설계 → HBM/메모리 → 후공정 장비.
    [
        'NVDA',
        '005930.KS', // 삼성전자
        '000660.KS', // SK하이닉스
        'AMD',
        'AVGO',
        'TSM',
        'ASML',
        'MU',
        'AMAT',
        '058470.KQ', // 리노공업
        '403870.KQ', // HPSP
    ],
    // 전기차·2차전지 — 완성차 → 배터리셀 → 소재.
    [
        'TSLA',
        '005380.KS', // 현대차
        '000270.KS', // 기아
        '373220.KS', // LG에너지솔루션
        '006400.KS', // 삼성SDI
        'RIVN',
        'LCID',
        'NIO',
        'XPEV',
        'GM',
        'F',
        '012330.KS', // 현대모비스
        '051910.KS', // LG화학
        '247540.KQ', // 에코프로비엠
        '086520.KQ', // 에코프로
    ],
    // 인터넷·플랫폼 — 검색/메신저/콘텐츠.
    [
        'GOOGL',
        '035420.KS', // 네이버
        '035720.KS', // 카카오
        'META',
        'NFLX',
    ],
    // 바이오·제약 — 오리지널 신약 → 바이오시밀러/CDMO.
    [
        'LLY',
        '207940.KS', // 삼성바이오로직스
        '068270.KS', // 셀트리온
        'ABBV',
        'AMGN',
        '196170.KQ', // 알테오젠
    ],
];

/**
 * 같은 테마로 묶인 심볼 그룹들. 한 그룹 안의 심볼끼리 서로 피어가 된다.
 *
 * 세 소스를 합친다:
 * - `TICKER_CATEGORIES` — 홈 디스커버리의 큐레이션 카테고리(메가캡, AI·반도체,
 *   양자컴퓨팅, 코스닥 …). 한국 카테고리도 여기 들어 있어 한국 종목의 피어가
 *   한국 종목으로 유지된다.
 * - `SECTOR_STOCKS` + 그 섹터 ETF — GICS 섹터 구성종목. **ETF를 같은 그룹에
 *   넣는 것이 핵심**이다: `XLK ↔ AAPL/MSFT/NVDA`처럼 "섹터 → 구성종목 →
 *   같은 섹터의 다른 종목"으로 타고 들어가는 동선이 생긴다.
 * - `CRYPTO_CATEGORIES` — 메이저/알트코인.
 */
const THEME_GROUPS: readonly (readonly string[])[] = [
    ...TICKER_CATEGORIES.map(c => c.items.map(i => i.symbol)),
    ...SECTOR_ETFS.map(etf => [
        etf.symbol,
        ...SECTOR_STOCKS.filter(s => s.sectorSymbol === etf.symbol).map(
            s => s.symbol
        ),
    ]),
    ...CRYPTO_CATEGORIES.map(c => c.items.map(i => i.symbol)),
    ...CROSS_MARKET_THEME_GROUPS,
];

/**
 * symbol → 그 심볼이 속한 **그룹별** 피어 목록(평탄화하지 않는다).
 *
 * 평탄화하면 먼저 나열된 그룹이 예산 6칸을 통째로 먹는다. 실제로 `NVDA`는
 * 메가캡 카테고리(피어 8개)와 AI 반도체 밸류체인 두 그룹에 속하는데, 평탄화
 * 순서대로 자르면 삼성전자·SK하이닉스가 한 칸도 못 들어간다 — 교차시장 그룹을
 * 만든 이유가 통째로 사라진다. 그래서 그룹을 나눠 두고 {@link themePeersOf}가
 * 라운드로빈으로 섞는다.
 */
const THEME_PEER_GROUPS: ReadonlyMap<string, readonly (readonly string[])[]> =
    (() => {
        const acc = new Map<string, readonly (readonly string[])[]>();
        for (const group of THEME_GROUPS) {
            for (const symbol of group) {
                const peers = group.filter(peer => peer !== symbol);
                if (peers.length === 0) continue;
                acc.set(symbol, [...(acc.get(symbol) ?? []), peers]);
            }
        }
        return acc;
    })();

/**
 * 그룹들을 **라운드로빈**으로 하나의 목록에 편다 — 각 그룹의 1번째 → 각 그룹의
 * 2번째 → … 순. 중복은 첫 등장 위치를 유지한 채 접는다(`Set`의 삽입 순서).
 *
 * 평탄화(`groups.flat()`)하면 먼저 나열된 그룹이 예산을 통째로 먹는다. `NVDA`는
 * 메가캡 카테고리(피어 8개)와 AI 반도체 밸류체인 두 그룹에 속하는데, 순서대로
 * 자르면 삼성전자·SK하이닉스가 한 칸도 못 들어간다 — 교차시장 그룹을 만든 이유가
 * 통째로 사라진다.
 *
 * `themePeersOf`에서 분리해 export한 이유는 `ringNeighbors`와 같다: 실제 데이터로는
 * 도달하지 않는 경우(그룹 길이가 서로 다른 조합, 그룹 간 중복 피어)를 작은 입력으로
 * 직접 고정하기 위해서다.
 */
export function roundRobinMerge(
    groups: readonly (readonly string[])[]
): string[] {
    const longest = groups.reduce((max, g) => Math.max(max, g.length), 0);
    return [
        ...new Set(
            Array.from({ length: longest }, (_, rank) => rank).flatMap(rank =>
                groups
                    .map(group => group[rank])
                    .filter((peer): peer is string => peer !== undefined)
            )
        ),
    ];
}

/**
 * 한 심볼의 테마 피어(같은 그룹의 다른 심볼들). 테스트가 "시장을 넘는 링크는
 * 테마 근거가 있어야 한다"를 단언하는 데 쓴다.
 *
 * **테마 피어는 시장을 넘어도 된다.** {@link SYMBOL_LINK_RINGS}의 자산군별 분리는
 * 배열 인접성(위치 잡음)에만 적용되는 규칙이지, "미국과 한국을 절대 잇지 마라"가
 * 아니다. 반도체 테마로 `NVDA ↔ SK하이닉스`를 묶는 큐레이션
 * ({@link CROSS_MARKET_THEME_GROUPS})은 정당한 관련 종목이다.
 */
export function themePeersOf(symbol: string): readonly string[] {
    return roundRobinMerge(THEME_PEER_GROUPS.get(symbol.toUpperCase()) ?? []);
}

/**
 * 링크 링. **순서가 곧 연관성**이므로 원본 배열 순서를 절대 정렬하지 않는다 —
 * `POPULAR_TICKERS`는 이미 테마 블록(`// --- [N] ... ---`)으로 묶여 있어
 * 이웃이 대체로 같은 테마다. 테마 그룹 데이터가 없는 심볼(402종 중 256종)에게는
 * 이 배열 인접성이 사실상 유일한 관련성 신호다.
 *
 * **자산군마다 링을 따로 둔다.** 하나로 합치면 배열 양 끝이 맞물리는 지점에서
 * 관련 없는 이웃이 생긴다 — 실제로 합쳐 두었을 때 `AAPL`(배열 0번)의 이웃에
 * `HPSP(403870.KQ)`가 붙었다. 링 하나당 하나의 순환이므로 분리해도 고아 0 보장은
 * 그대로다(각 링이 자기 원소를 모두 잇는다).
 *
 * ⚠️ 이 분리는 **링에만** 적용된다. 시장을 넘는 링크 자체를 금지하는 규칙이
 * 아니다 — 테마 피어는 시장을 넘어도 되고(`themePeersOf` JSDoc), 배열 인접성만
 * 시장을 넘을 근거가 되지 못한다는 뜻이다.
 *
 * 한국 종목은 `KR_SYMBOL_RE`(6자리 + `.KS`/`.KQ`)로 판별한다 — canonical 심볼에
 * 접미사가 내장돼 있어 DB 조회 없이 순수 함수로 끝난다(그 상수의 설계 의도).
 */
const KR_RING: readonly string[] = POPULAR_TICKERS.filter(s =>
    KR_SYMBOL_RE.test(s)
);
const US_RING: readonly string[] = POPULAR_TICKERS.filter(
    s => !KR_SYMBOL_RE.test(s)
);
export const SYMBOL_LINK_RINGS: readonly (readonly string[])[] = [
    US_RING,
    KR_RING,
    POPULAR_CRYPTOS,
];

/** symbol → [ring, index]. 링 스캔을 매 요청 반복하지 않도록 모듈 로드 시 1회 구축. */
const RING_POSITION: ReadonlyMap<string, readonly [readonly string[], number]> =
    new Map(
        SYMBOL_LINK_RINGS.flatMap(ring =>
            ring.map(
                (symbol, index) => [symbol, [ring, index] as const] as const
            )
        )
    );

/**
 * 링에서 `±1 … ±reach` 위치의 이웃을 가까운 순으로 편다(모듈러 — 배열 양 끝도 이어짐).
 *
 * 상한이 `floor(length / 2)`인 이유: 그 이상 나가면 offset이 반대편으로 감겨
 * **자기 자신**이 섞인다(length 4에서 offset 4 = 자기 자신). 반대로 예전처럼
 * `floor((length - 1) / 2)`로 두면 **length 2에서 0이 되어 이웃이 하나도 안 나온다**
 * — 그 링의 두 심볼이 서로를 링크하지 않아 고아가 된다. 지금 링은 전부 20개가
 * 넘어 도달하지 않지만, 링을 쪼개다 2개가 되는 순간 조용히 깨진다.
 *
 * 같은 이웃이 두 번 나올 수는 있다(length 4에서 -2와 +2가 같은 원소). 호출부
 * (`relatedSymbolsFor`)가 `seen`으로 접으므로 중복은 결과에 남지 않는다.
 *
 * length 1(원소 하나뿐인 링)은 이웃이 없어 0을 반환한다 — 같은 자산군에 짝이
 * 없다는 뜻이라 링으로는 이을 수 없고, 그 심볼은 테마 피어로만 연결된다.
 *
 * 테스트를 위해 export한다(2원소·4원소 같은 경계는 실제 링에 없어 통합
 * 테스트로는 고정할 수 없다).
 */
export function ringNeighbors(
    ring: readonly string[],
    index: number,
    reach: number
): string[] {
    const bounded = Math.min(reach, Math.floor(ring.length / 2));
    return Array.from({ length: bounded }, (_, i) => i + 1).flatMap(step =>
        [-step, step].map(
            offset => ring[(index + offset + ring.length) % ring.length]
        )
    );
}

/**
 * 한 심볼의 "관련 종목" 링크 목록. **순수 함수 · I/O 없음 · 결정적**이라 ISR HTML이
 * 재생성마다 달라지지 않는다.
 *
 * ## 왜 필요한가 — 431종 중 303종(70%)이 내부링크 고아였다
 *
 * 2026-08-24 프로덕션 실측: 모든 허브 페이지(`/`, `/market*`, `/news*`,
 * `/economy*`, `/fear-greed*`, `/backtesting`)와 심볼 페이지의 anchor를 전수
 * 수집한 결과, sitemap이 광고하는 심볼 431종 중 내부링크를 하나라도 받는 것은
 * **128종뿐**이었다(홈 94 + `/market` 50 + `/market/kr` 16의 합집합). 심볼
 * 페이지끼리는 서로를 **0개** 링크했다 — 탭 바(`CrossLinkCards`/`SymbolTabs`)는
 * 같은 심볼의 다른 탭만 잇는다.
 *
 * 나머지 303종은 XML sitemap 외에 진입로가 없었다. 색인은 되지만 "사이트 자신도
 * 중요하게 보지 않는 페이지"라는 신호가 되고, 실제로 같은 시점 GSC에서 차트 탭
 * 평균 순위가 44.7위(형제 탭은 3~8위)였다.
 *
 * ## 선정 순서 — 관련성 우선, 연결성은 불변식으로 보장
 *
 * 1. **테마 피어**({@link themePeersOf}) — 같은 큐레이션 카테고리 / 같은 GICS
 *    섹터(+그 섹터 ETF) / 같은 암호화폐 그룹. 사용자가 실제로 "타고 갈" 만한
 *    이웃이라 맨 앞에 온다.
 * 2. **링 ±1**({@link GUARANTEED_RING_REACH}) — 테마 피어가 몇 개든 이 두
 *    자리는 잘리지 않는다. 이게 유니버스 전체를 하나의 순환으로 이어
 *    **고아 0을 산술적으로 보장**한다(`relatedSymbols.test.ts`가 고정).
 *    섹터/테마만으로 짜면 커버리지가 146/402라 나머지 256종이 다시 고아가 된다.
 * 3. 그래도 {@link RELATED_SYMBOL_COUNT}에 못 미치면 링 반경을 ±2…±4로 넓혀 채운다.
 *
 * 유니버스에 없는 심볼(승인 롱테일 등)은 빈 배열을 반환해 호출부가 섹션을 생략한다.
 */
export function relatedSymbolsFor(symbol: string): RelatedSymbol[] {
    const upper = symbol.toUpperCase();
    const position = RING_POSITION.get(upper);
    if (position === undefined) return [];
    const [ring, index] = position;

    const guaranteed = ringNeighbors(ring, index, GUARANTEED_RING_REACH);
    // 테마 피어가 8개를 넘어도 링 ±1 자리를 남겨 둔다 — 남기지 않으면 그 심볼이
    // 이웃에게 주던 인바운드 링크가 사라져 고아 0 보장이 깨진다.
    const themeBudget = Math.max(
        0,
        RELATED_SYMBOL_COUNT - new Set(guaranteed).size
    );
    const theme = themePeersOf(upper).slice(0, themeBudget);

    const ordered = [
        ...theme,
        ...guaranteed,
        ...ringNeighbors(ring, index, MAX_RING_REACH),
    ];

    const seen = new Set<string>([upper]);
    const picked: RelatedSymbol[] = [];
    for (const candidate of ordered) {
        if (seen.has(candidate)) continue;
        seen.add(candidate);
        const koreanName = KOREAN_NAMES.get(candidate);
        const displayTicker = candidate.replace(KR_EXCHANGE_SUFFIX_RE, '');
        picked.push(
            koreanName === undefined
                ? { symbol: candidate, displayTicker }
                : { symbol: candidate, displayTicker, koreanName }
        );
        if (picked.length === RELATED_SYMBOL_COUNT) break;
    }
    return picked;
}
