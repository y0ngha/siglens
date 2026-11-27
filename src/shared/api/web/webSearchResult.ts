/**
 * `web_search` 도구 결과의 모양과, 보존 기간이 지난 대화에서 검색 결과를 걷어내는 규칙.
 *
 * 멤버 대화는 도구 결과를 그대로 저장한다. 검색 제공자(Brave)의 약관은 검색 결과의 "일시 저장" 밖의 보관을
 * 막으므로, 저장된 지 {@link WEB_SEARCH_RETENTION_DAYS}일이 지나면 결과마다 **제목과 출처 URL만** 남기고 나머지(검색
 * 스니펫, 페이지 발췌, 제공자의 시각 표기, 발췌 실패 사유, 최상위의 `asOf`·`source` 등)는 모두 지운다. 개인정보처리방침이 "제목과 링크만 남긴다"고
 * 약속하므로(`db/seeds/terms/privacy`) 이 목록과 문구가 한 쌍이다.
 *
 * 남길 필드를 **허용 목록**({@link WEB_SEARCH_KEPT_FIELDS})으로 둔다. 결과에 새 필드가 생겨도 이 목록에 넣기 전에는
 * 저장 기간이 지나면 지워지므로, 새 본문성 필드가 조용히 남는 일이 없다. 결과를 만드는 쪽(`webSearch.ts`)과 지우는 쪽
 * (보존 기간 작업)이 같은 파일을 읽는다.
 */
export const WEB_SEARCH_KEPT_FIELDS = ['title', 'url'] as const;

/** 저장된 `web_search` 결과를 이 일수 뒤에 {@link WEB_SEARCH_KEPT_FIELDS}만 남기도록 줄인다(메시지 생성 시각 기준). */
export const WEB_SEARCH_RETENTION_DAYS = 7;

export type WebSearchExcerptStatus =
    | 'blocked'
    | 'timeout'
    | 'not_html'
    | 'too_large'
    | 'robots'
    | 'error';

export interface WebSearchResultItem {
    title: string;
    url: string;
    snippet: string;
    age: string | null;
    /** 페이지 본문에서 질의와 가장 관련 있는 문단(최대 1,800자). 상위 2개 결과에만 붙는다. */
    excerpt?: string;
    /** `excerpt`를 못 붙인 이유. `excerpt`와 함께 오지 않는다. */
    excerptStatus?: WebSearchExcerptStatus;
    /** 페이지 메타데이터의 발행 시각(ISO). 발췌를 읽었고 메타가 있을 때만. */
    publishedAt?: string;
}

/**
 * 결과가 줄어들었음을 표시하는 최상위 키. 두 번 돌려도 같은 결과가 되게(멱등) 하는 표식이고, 보존 기간 작업이 이미 줄인
 * 행을 SQL에서 곧바로 건너뛰는 근거이기도 하다(직렬화에 공백이 없으므로 `"bodiesOmitted":true` 부분 문자열로 찾는다).
 */
export const WEB_SEARCH_BODIES_OMITTED_KEY = 'bodiesOmitted';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function keptFieldsOnly(item: unknown): unknown {
    if (!isRecord(item)) return item;
    return Object.fromEntries(
        Object.entries(item).filter(([key]) =>
            (WEB_SEARCH_KEPT_FIELDS as readonly string[]).includes(key)
        )
    );
}

/**
 * 저장된 `web_search` 결과에서 {@link WEB_SEARCH_KEPT_FIELDS} 밖의 필드를 지운 사본.
 * - `{ results: [...] }`: `{ results: [{ title, url }, ...], bodiesOmitted: true }`만 남는다. 최상위의 `asOf`·`source`·
 *   `cached` 등도 지운다(처리방침은 제목과 링크만 남긴다고 적는다).
 * - 잘림 봉투 `{ truncated: true, preview }`: `preview`는 직렬화된 결과를 앞에서 자른 문자열이라 스니펫이 그대로 들어
 *   있고 파싱해 골라낼 수 없다. `{ bodiesOmitted: true }`만 남긴다(읽는 쪽이 JSON으로 파싱할 수 있는 최소 모양).
 * - 그 밖(오류 결과 `{ error }`, 객체가 아닌 값)은 입력을 그대로 돌려준다. 입력을 바꾸지 않는다.
 */
export function stripWebSearchBodies(result: unknown): unknown {
    if (!isRecord(result)) return result;
    if (Array.isArray(result.results)) {
        return {
            results: result.results.map(keptFieldsOnly),
            [WEB_SEARCH_BODIES_OMITTED_KEY]: true,
        };
    }
    if (result.truncated === true && typeof result.preview === 'string') {
        return { [WEB_SEARCH_BODIES_OMITTED_KEY]: true };
    }
    return result;
}

function parseJsonOrUndefined(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}

/**
 * 저장된 도구 행의 `content`(결과 JSON 문자열)를 줄인 새 문자열. 줄일 것이 없으면 `null`이다 — 이미 줄였거나(표식),
 * JSON이 아니거나, 결과 모양이 아닌 경우(오류 결과). 같은 입력을 두 번 넣어도 두 번째는 `null`이라 멱등이다.
 */
export function stripStoredWebSearchContent(content: string): string | null {
    const parsed = parseJsonOrUndefined(content);
    if (isRecord(parsed) && parsed[WEB_SEARCH_BODIES_OMITTED_KEY] === true) {
        return null;
    }
    const stripped = stripWebSearchBodies(parsed);
    return stripped === parsed ? null : JSON.stringify(stripped);
}
