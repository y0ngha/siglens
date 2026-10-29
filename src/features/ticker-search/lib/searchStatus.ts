import { isKoreanInput } from '@/entities/ticker/lib/ticker';

/**
 * 검색 표면(데스크톱 자동완성·모바일 오버레이)이 지금 보여 주고 고지할 상태.
 *
 * - `idle`: 질의가 아직 없다.
 * - `searching`: 조회가 진행 중이다(재시도 대기 포함).
 * - `error`: 조회가 실패했다. "결과 없음"과 다르다 — 실패한 조회의 빈 결과는 "없다"가 아니다.
 * - `results`: 결과가 하나 이상 있다.
 * - `emptyKorean`: 결과가 없고 한글로 쳤다. 회사명은 직행 대상이 아니라 티커로 다시 치라는
 *   안내가 유일한 출구다.
 * - `empty`: 결과가 없다.
 */
export type SearchStatus =
    | 'idle'
    | 'searching'
    | 'error'
    | 'results'
    | 'emptyKorean'
    | 'empty';

/** `searchStatus`의 입력. `useTickerSearch`가 주는 값과 지금 친 문자열이다. */
export interface SearchStatusInput {
    query: string;
    hasQuery: boolean;
    isSearching: boolean;
    isError: boolean;
    resultCount: number;
}

/**
 * 검색 조회 한 번의 상태. `useTickerSearch`의 반환 타입이 이 인터페이스를 확장하므로
 * 필드가 바뀌면 컴파일러가 두 곳을 함께 맞추게 한다. `results`는 개수만 읽어 요소 타입을 묻지 않는다.
 */
export interface SearchSnapshot {
    results: readonly unknown[];
    isSearching: boolean;
    hasQuery: boolean;
    /** 조회가 실패했는지. 호출부는 "결과 없음"과 구분해 보여줘야 한다. */
    isError: boolean;
    /**
     * 실제로 조회에 쓰인 질의(앞뒤 공백을 뗀 값). `query.trim()`과 다르면 `results`는
     * 한 박자 전 것이다 — 첫 결과로 바로 이동하는 호출부(검색 키)가 이를 확인해야 한다.
     */
    debouncedQuery: string;
}

/**
 * 조회가 입력을 따라잡았는지와 그 위의 표시 상태를 한곳에서 계산한다.
 *
 * `debouncedQuery`는 이미 앞뒤 공백을 뗀 값이므로 입력 쪽만 trim해 비교한다 —
 * `"apple "`을 친 채 검색하면 화면의 첫 결과를 믿어야 한다.
 */
export function deriveSearchState(
    query: string,
    { results, isSearching, hasQuery, isError, debouncedQuery }: SearchSnapshot
): { isSettled: boolean; status: SearchStatus } {
    return {
        isSettled: debouncedQuery === query.trim(),
        status: searchStatus({
            query,
            hasQuery,
            isSearching,
            isError,
            resultCount: results.length,
        }),
    };
}

/**
 * 검색 상태를 하나로 정한다. 두 표면이 같은 우선순위를 쓰도록 한곳에 둔다.
 *
 * `searching`을 결과 수보다 먼저 본다 — 새 질의는 응답 전 결과가 빈 배열이라, 그대로
 * 읽으면 "결과 없음"을 먼저 말한 뒤 응답이 오면 번복한다.
 */
export function searchStatus({
    query,
    hasQuery,
    isSearching,
    isError,
    resultCount,
}: SearchStatusInput): SearchStatus {
    if (isSearching) return 'searching';
    if (isError) return 'error';
    if (!hasQuery) return 'idle';
    if (resultCount > 0) return 'results';
    return isKoreanInput(query) ? 'emptyKorean' : 'empty';
}
