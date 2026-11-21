/** `ESCAPABLE` 정규식이 잡는 다섯 글자와 대응하는 엔티티. */
function entityOf(ch: string): string {
    switch (ch) {
        case '&':
            return '&amp;';
        case '<':
            return '&lt;';
        case '>':
            return '&gt;';
        case '"':
            return '&quot;';
        case "'":
            return '&#39;';
        default:
            throw new Error(`escapeHtml: no entity for ${JSON.stringify(ch)}`);
    }
}

/** 문자열을 HTML 본문·속성값에 그대로 넣을 수 있게 이스케이프한다. */
export function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, entityOf);
}
