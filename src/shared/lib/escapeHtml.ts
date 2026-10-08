const HTML_ESCAPES: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

/** 문자열을 HTML 본문·속성값에 그대로 넣을 수 있게 이스케이프한다. */
export function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]!);
}
