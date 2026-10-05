/**
 * 문장 안의 사이트 경로(`/market`, `/NVDA/overall`)를 링크로 바꿀 수 있게 조각낸다.
 *
 * 홈 FAQ 답변은 "예: /BTCUSD."처럼 경로를 글자로 적는다. 구조화데이터(JSON-LD)에는
 * 그 문자열이 그대로 가야 하므로(화면과 마크업이 같은 배열에서 나온다) 원문은 건드리지
 * 않고, 화면에서만 이 함수로 조각내 링크로 그린다.
 *
 * 경계는 **공백이 아니라 문자 종류**로 정한다. 일본어·중국어 답변은 띄어쓰기 없이
 * `Siglensの/marketページ`, `NVIDIAは/NVDA/overallです`, `例：/BTCUSD。`처럼 쓰므로
 * 공백·ASCII 구두점만 경계로 보면 두 로케일의 경로 대부분이 링크가 되지 않았다.
 *
 * 경로로 보는 조건:
 * - 앞이 영숫자·`/`·`.`·`:`가 아닐 것(lookbehind). `PER/PBR`, `24/7`, `https://x.com/foo`,
 *   `a.com/b`처럼 단어·URL 안의 슬래시는 경로가 아니다. 한글·가나·한자·전각 문장부호는 허용한다.
 * - 첫 세그먼트는 영문자로 시작한다(`/7`, `/2` 제외). 이후 세그먼트는 소문자·하이픈(`/overall`).
 * - 뒤가 영숫자·`/`·`-`가 아닐 것(lookahead). 문장 끝 `.`·`。`은 경로에 포함하지 않는다.
 */
const SITE_PATH_PATTERN =
    /(?<![A-Za-z0-9/.:])\/[A-Za-z][A-Za-z0-9-]*(?:\/[a-z-]+)*(?![A-Za-z0-9/-])/g;

export type SitePathSegment =
    | { readonly kind: 'text'; readonly value: string }
    | { readonly kind: 'path'; readonly value: string };

export function splitSitePaths(text: string): SitePathSegment[] {
    const segments: SitePathSegment[] = [];
    let cursor = 0;
    for (const match of text.matchAll(SITE_PATH_PATTERN)) {
        const [path] = match;
        if (match.index > cursor) {
            segments.push({
                kind: 'text',
                value: text.slice(cursor, match.index),
            });
        }
        segments.push({ kind: 'path', value: path });
        cursor = match.index + path.length;
    }
    if (cursor < text.length) {
        segments.push({ kind: 'text', value: text.slice(cursor) });
    }
    return segments;
}
