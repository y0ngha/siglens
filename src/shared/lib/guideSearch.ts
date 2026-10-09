/** 검색이 읽는 최소 필드. `GuideEntrySummary`가 구조적으로 만족한다. */
export interface GuideSearchable {
    readonly slug: string;
    readonly title: string;
    readonly aliases: readonly string[];
    readonly summary: string;
}

/** 대소문자·유니코드 정규형 차이를 없앤다(NFC + 소문자 + 앞뒤 공백 제거). */
function normalize(text: string): string {
    return text.normalize('NFC').toLowerCase().trim();
}

const RANK = {
    exact: 0,
    prefix: 1,
    nameSubstring: 2,
    summarySubstring: 3,
} as const;

function rankOf(entry: GuideSearchable, query: string): number | null {
    // slug의 하이픈은 띄어쓰기와 같게 본다("double top" ↔ double-top).
    const names = [
        entry.title,
        ...entry.aliases,
        entry.slug,
        entry.slug.replaceAll('-', ' '),
    ].map(normalize);

    if (names.some(name => name === query)) return RANK.exact;
    if (names.some(name => name.startsWith(query))) return RANK.prefix;
    if (names.some(name => name.includes(query))) return RANK.nameSubstring;
    if (normalize(entry.summary).includes(query)) return RANK.summarySubstring;
    return null;
}

/**
 * 가이드 항목 검색 — 허브 UI와 에이전트 도구가 같은 함수를 쓴다.
 *
 * 순위: 제목·다른 이름·slug 완전 일치 > 접두 일치 > 제목·다른 이름·slug 부분 일치 > 요약 부분
 * 일치. 같은 순위 안에서는 입력 순서를 지킨다(카탈로그의 카테고리/order 순). 빈 질의는 결과가
 * 없다 — "전부 보기"는 호출부가 질의가 비었을 때 목록을 그대로 쓴다.
 */
export function searchGuide<T extends GuideSearchable>(
    entries: readonly T[],
    query: string,
    limit: number
): T[] {
    const normalized = normalize(query);
    if (normalized === '' || limit <= 0) return [];

    return entries
        .map((entry, index) => ({
            entry,
            index,
            rank: rankOf(entry, normalized),
        }))
        .filter(
            (scored): scored is typeof scored & { rank: number } =>
                scored.rank !== null
        )
        .toSorted((a, b) => a.rank - b.rank || a.index - b.index)
        .slice(0, limit)
        .map(scored => scored.entry);
}
