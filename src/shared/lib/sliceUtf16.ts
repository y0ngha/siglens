/**
 * 앞에서 `max` UTF-16 코드 단위까지 자른다. 끝이 서로게이트 쌍의 앞 절반이면 한 단위 더 줄여 깨진 문자를 남기지 않는다
 * (이모지·확장 한자). `cut`은 원문이 `max`보다 길었는지다.
 */
export function sliceUtf16(
    text: string,
    max: number
): { text: string; cut: boolean } {
    if (text.length <= max) return { text, cut: false };
    if (max <= 0) return { text: '', cut: true };
    const slice = text.slice(0, max);
    const code = slice.charCodeAt(slice.length - 1);
    const highSurrogate = code >= 0xd800 && code <= 0xdbff;
    return { text: highSurrogate ? slice.slice(0, -1) : slice, cut: true };
}
