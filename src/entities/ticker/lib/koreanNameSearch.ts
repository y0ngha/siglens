import { CANONICAL_KOREAN_NAMES } from '@/shared/config/canonical-korean-names';
import { isKrEquitySymbol } from '@/shared/config/marketProfile/registry';
import { KOREAN_SEARCH_ALIASES } from '@/shared/config/korean-search-aliases';
import type { KoreanTickerEntry, TickerSearchResult } from '@/shared/lib/types';
import { koreanSearchKey, spellLatinLetters } from './koreanSearchKey';

/**
 * 검색 스냅샷 한 행 — 정본을 입힌 행에 매칭 키 목록을 미리 계산해 붙인다.
 * 키 입력마다 3.3만 행의 키 변환을 다시 하지 않으려는 것이다.
 * 반환할 때는 `koreanEntryToSearchResult`가 필드를 골라 담으므로 `searchNames`는
 * 밖으로 새지 않는다.
 */
export interface SearchableKoreanEntry extends KoreanTickerEntry {
    /** 정본 한글명과 검색 별칭(`KOREAN_SEARCH_ALIASES`)의 {@link koreanSearchKey}. */
    readonly searchNames: readonly string[];
    /**
     * 한글명의 영문 약어를 글자 이름으로 읽은 표기의 검색 키(`SK하이닉스` →
     * `에스케이하이닉스`). 한글명에 영문이 없으면 `null`.
     *
     * `searchNames`와 따로 두는 이유: 글자 이름에는 `이`(e)·`지`(g)·`비`(b) 같은 한 음절이
     * 많아, 한 글자 질의를 여기에 대면 화면의 이름에는 없는 글자로 영문이 섞인 종목이
     * 무더기로 걸린다. {@link SPELLED_MIN_QUERY_LENGTH} 이상인 질의만 대 본다.
     */
    readonly spelledName: string | null;
}

/** 디렉터리 표기용 이름 한 벌 — 한글명이 없으면 영문명으로 떨어진다. */
export interface TickerDisplayName {
    readonly koreanName: string | null;
    /** `korean_tickers.name` — 영문 정식 명칭. */
    readonly name: string | null;
}

interface MixedScriptRuns {
    readonly hangul: readonly string[];
    readonly latin: readonly string[];
}

/** 글자 읽기 표기(`spelledName`)에 대 볼 최소 질의 길이(검색 키 기준 글자 수). */
const SPELLED_MIN_QUERY_LENGTH = 2;

const HANGUL_RUN_REGEX = /[ㄱ-ㅣ가-힣]+/g;
const LATIN_RUN_REGEX = /[a-z0-9]+/g;

/**
 * 저장된 행에 정본 한글명을 입힌다 — `korean_tickers`를 읽는 단일 관문(`koreanNameStore`의
 * 로더 반환 지점)에서만 쓴다.
 *
 * `korean_tickers`는 `asset_translations`와 다른 테이블이라 `getAssetInfo` 출구의
 * 오버라이드가 닿지 않는다. 검색 자동완성·뉴스가 여기서 이름을 받으므로, 덮지
 * 않으면 종목 페이지엔 `실스큐`인데 검색엔 `씰스큐`가 뜬다.
 *
 * 호출부마다 흩뿌리면 새 리더가 생길 때 조용히 빠진다 — 실제로 `searchByKoreanName`이
 * 그렇게 빠져 있었고, 그 함수는 반환값뿐 아니라 **매칭 술어**도 원본을 보고 있어서
 * 사용자가 올바른 이름을 치면 0건이 나왔다. 로더에서 입히면 술어가 자동으로 정본을 본다.
 *
 * 검색 스냅샷에는 정본을 입힌 값이 담긴다 — 정본 맵을 고치면 스냅샷 TTL(10분)·재시작 뒤
 * 반영된다(DB의 원본 행은 그대로라 맵에서 빼면 저장된 값이 다시 드러난다).
 *
 * ⚠️ **`getKoreanNames`는 자체 오버라이드를 하나 더 갖는다 — 지우지 말 것.**
 * 이 함수는 *존재하는 행*만 고칠 수 있어서, 저장된 행이 아예 없는 심볼에는
 * 아무것도 못 한다. 번역이 아직 안 채워진 정본 심볼을 영문 대신 올바른 한글로
 * 보여 주려면 {@link toKoreanNameMap}의 `CANONICAL_KOREAN_NAMES.get(symbol) ?? …`가
 * 필요하다. 행이 있는 심볼에 대해선 결과가 같아 중복처럼 보이지만 죽은 코드가
 * 아니다.
 *
 * ## 저장된 행은 틀린 채로 남는다 — 의도다
 *
 * 정본이 있는 심볼은 `koreanName`이 항상 truthy가 되므로, `searchTicker`의
 * `unmapped` 필터와 `getAssetInfo`의 번역 트리거가 그 심볼을 다시 번역하지
 * 않는다. 즉 DB의 틀린 행(`LAES` → `씰스큐`)은 그대로 굳는다.
 *
 * 그게 맞다. 그 자가치유는 **LLM 번역기**이고, 애초에 저 틀린 이름을 만든 게
 * 그 번역기다. 사람이 정본을 정한 심볼에 다시 LLM을 붙이면 표기가 또 흔들린다.
 * 굳은 행은 이 관문을 지나는 한 어디에도 노출되지 않으므로 무해하다.
 * (심볼을 정본 맵에서 빼면 저장된 값이 다시 드러나고 자가치유도 되살아난다.)
 */
export function withCanonical(entry: KoreanTickerEntry): KoreanTickerEntry {
    const canonical = CANONICAL_KOREAN_NAMES.get(entry.symbol);
    return canonical === undefined
        ? entry
        : { ...entry, koreanName: canonical };
}

/** 스냅샷 로드 시 행마다 한 번 매칭 키를 계산해 붙인다. */
export function toSearchableEntry(
    entry: KoreanTickerEntry
): SearchableKoreanEntry {
    const aliases = KOREAN_SEARCH_ALIASES.get(entry.symbol) ?? [];
    const spelled = spellLatinLetters(entry.koreanName);
    return {
        ...entry,
        searchNames: [
            ...new Set([entry.koreanName, ...aliases].map(koreanSearchKey)),
        ],
        spelledName: spelled === null ? null : koreanSearchKey(spelled),
    };
}

/** 검색 스냅샷 행을 화면용 검색 결과로 바꾼다. `searchNames` 등 내부 필드는 싣지 않는다. */
export function koreanEntryToSearchResult(
    entry: KoreanTickerEntry
): TickerSearchResult {
    return {
        symbol: entry.symbol,
        name: entry.name,
        koreanName: entry.koreanName,
        exchange: entry.exchange,
        exchangeFullName: entry.exchangeFullName,
        // `korean_tickers`는 미국·한국 종목을 함께 담는다(크립토만 별도 테이블). 행 자체에는
        // 프로필 컬럼이 없으므로 심볼 형상으로 판정한다 — 이게 없으면 한글 검색으로 찾은
        // 한국 종목이 us-equity로 표시된다.
        ...(isKrEquitySymbol(entry.symbol)
            ? { marketProfile: 'kr-equity' as const }
            : {}),
    };
}

/** 검색 키 하나가 이 행의 이름(필요하면 글자 읽기 표기 포함)에 들어 있는가. */
function nameKeyIncludes(entry: SearchableKoreanEntry, key: string): boolean {
    if (entry.searchNames.some(name => name.includes(key))) return true;
    return (
        entry.spelledName !== null &&
        key.length >= SPELLED_MIN_QUERY_LENGTH &&
        entry.spelledName.includes(key)
    );
}

/**
 * 한글과 영문(숫자)이 섞인 질의를 문자 체계별 토막으로 나눈다. 한쪽만 있으면 `null`.
 *
 * 사용자는 회사명의 일부만 한글로 옮겨 적는다 — `SEALSQ`를 `실SQ`로, `삼성SDI`를
 * `삼성 SDI`로. 저장된 한글명(`실스큐`)에는 질의 전체가 부분 문자열로 들어 있지 않아
 * 0건이 되므로, 토막별로 나눠 맞춘다({@link matchesMixedScriptRuns}).
 */
function splitMixedScriptRuns(lowerQuery: string): MixedScriptRuns | null {
    const hangul = (lowerQuery.match(HANGUL_RUN_REGEX) ?? []).map(
        koreanSearchKey
    );
    const latin = lowerQuery.match(LATIN_RUN_REGEX) ?? [];
    return hangul.length > 0 && latin.length > 0 ? { hangul, latin } : null;
}

/**
 * 한글 토막은 전부 한글명(별칭 포함)에, 영문 토막은 전부 한글명·영문명·심볼 중 하나에
 * 들어 있어야 일치로 본다. 영문 토막을 한글명에도 대 보는 이유: `삼성SDI`처럼 한글명
 * 자체가 영문을 품은 종목을 띄어 쓴 질의(`삼성 SDI`)로도 찾게 하려는 것이다.
 *
 * 토막 전부를 요구(AND)하므로 `실` 한 글자처럼 넓은 한글 토막도 영문 토막이 좁혀 준다.
 */
function matchesMixedScriptRuns(
    entry: SearchableKoreanEntry,
    runs: MixedScriptRuns
): boolean {
    const latinFields = [
        ...entry.searchNames,
        entry.name.toLowerCase(),
        entry.symbol.toLowerCase(),
    ];
    return (
        runs.hangul.every(run => nameKeyIncludes(entry, run)) &&
        runs.latin.every(run => latinFields.some(f => f.includes(run)))
    );
}

/**
 * 스냅샷 행 중 질의에 맞는 것을 검색 결과로 돌려준다.
 *
 * 매칭은 질의와 저장명 양쪽을 {@link koreanSearchKey}로 바꿔 비교한다 — 대소문자·공백,
 * 된소리(`써클`/`서클`)와 구별되지 않는 모음 차이를 무시한다. 한글·영문이 섞인 질의는
 * 토막별로 맞춘다({@link matchesMixedScriptRuns}). 키가 빈 질의는 아무것도 고르지 않는다.
 */
export function matchKoreanNameQuery(
    entries: readonly SearchableKoreanEntry[],
    query: string
): TickerSearchResult[] {
    const queryKey = koreanSearchKey(query);
    if (queryKey === '') return [];
    const mixedRuns = splitMixedScriptRuns(query.toLowerCase());
    return entries.flatMap(entry =>
        nameKeyIncludes(entry, queryKey) ||
        (mixedRuns !== null && matchesMixedScriptRuns(entry, mixedRuns))
            ? [koreanEntryToSearchResult(entry)]
            : []
    );
}

/**
 * 요청 심볼 순서대로 표기용 이름 맵을 만든다. 저장된 행이 없어도 정본 한글명은 내보낸다
 * ({@link toKoreanNameMap}과 같은 이유) — 한글명·영문명이 모두 없는 심볼은 키 자체를 뺀다.
 */
export function toTickerDisplayNames(
    symbols: readonly string[],
    entries: readonly KoreanTickerEntry[]
): Record<string, TickerDisplayName> {
    const bySymbol = new Map(entries.map(e => [e.symbol, e]));
    const pairs = symbols.flatMap<readonly [string, TickerDisplayName]>(
        symbol => {
            const entry = bySymbol.get(symbol);
            const koreanName =
                CANONICAL_KOREAN_NAMES.get(symbol) ?? entry?.koreanName ?? null;
            const name = entry?.name ?? null;
            return koreanName === null && name === null
                ? []
                : [[symbol, { koreanName, name }]];
        }
    );
    // `Object.fromEntries`는 반환 타입을 `{ [k: string]: TickerDisplayName }`로 넓히지만,
    // 위 `flatMap`이 `readonly [string, TickerDisplayName]`만 만들어 넣으므로 이 캐스트는 안전하다.
    return Object.fromEntries(pairs) as Record<string, TickerDisplayName>;
}

/**
 * 심볼별 한글명 맵. 정본이 저장된 이름을 덮고, 저장된 행이 없어도 정본은 내보낸다
 * (`?? symbolMap.get`이 아니라 앞에 둔 이유) — 번역이 아직 안 채워진 종목도 올바른 이름으로
 * 보이는 편이 낫다. `korean_tickers`는 `asset_translations`와 다른 테이블이라
 * `getAssetInfo` 출구의 오버라이드가 닿지 않아 여기에도 같은 덮어쓰기가 필요하다.
 */
export function toKoreanNameMap(
    symbols: readonly string[],
    entries: readonly KoreanTickerEntry[]
): Record<string, string> {
    const symbolMap = new Map(entries.map(e => [e.symbol, e.koreanName]));
    const pairs = symbols.flatMap<readonly [string, string]>(symbol => {
        const koreanName =
            CANONICAL_KOREAN_NAMES.get(symbol) ?? symbolMap.get(symbol);
        return koreanName ? [[symbol, koreanName]] : [];
    });
    // `Object.fromEntries`는 반환 타입을 넓히지만 `pairs`는 `readonly [string, string]`뿐이라 캐스트는 안전하다.
    return Object.fromEntries(pairs) as Record<string, string>;
}

/**
 * `.KS`/`.KQ` 한쪽만 마스터에 있을 때 있는 쪽 심볼을 돌려준다. 요청 심볼의 행이 있으면
 * (상폐 표시가 있어도) 그대로 둔다 — 시장을 옮긴 종목처럼 두 행이 모두 있는 경우를
 * 마스터가 판정하지 않기 때문이다.
 */
export function pickListedKrSuffix(
    upper: string,
    sibling: string,
    entries: readonly KoreanTickerEntry[]
): string {
    const found = new Set(entries.map(e => e.symbol));
    return !found.has(upper) && found.has(sibling) ? sibling : upper;
}

/** 한국 심볼의 반대편 거래소 접미사 심볼(`.KS` ↔ `.KQ`). */
export function siblingKrSymbol(upper: string): string {
    const code = upper.slice(0, -'.KS'.length);
    return upper.endsWith('.KS') ? `${code}.KQ` : `${code}.KS`;
}
