const DRAFT_MAX_CHARS = 500;

/**
 * siglens.io의 질문 진입 링크(`?q=`)가 채팅 입력창에 미리 채우는 초안.
 * 비어 있거나 문자열이 아닌 값(배열 등)은 없는 것으로 보고, 길이는 `DRAFT_MAX_CHARS`로 자른다.
 */
export function draftFrom(
    searchParams: Record<string, string | string[] | undefined>
): string | undefined {
    const q = searchParams.q;
    if (typeof q !== 'string') return undefined;
    const draft = q.trim().slice(0, DRAFT_MAX_CHARS);
    return draft === '' ? undefined : draft;
}
