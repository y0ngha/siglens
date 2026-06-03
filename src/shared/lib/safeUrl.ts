/** http(s) URL만 허용한다. javascript:/data: 등 위험 스킴은 링크를 렌더하지 않아 방어한다. */
export function toSafeHttpUrl(url: string | null): string | null {
    if (url === null) return null;
    return /^https?:\/\//i.test(url) ? url : null;
}
