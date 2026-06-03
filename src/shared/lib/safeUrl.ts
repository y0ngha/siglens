/** http(s) URL만 허용한다. javascript:/data: 등 위험 스킴 및 빈 문자열/null은 null을 반환한다. */
export function toSafeHttpUrl(url: string | null): string | null {
    if (url === null) return null;
    return /^https?:\/\//i.test(url) ? url : null;
}
