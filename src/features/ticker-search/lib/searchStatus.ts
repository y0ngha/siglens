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
