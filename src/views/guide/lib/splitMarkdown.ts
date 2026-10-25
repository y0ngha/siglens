/**
 * 라이브 종목 모듈을 끼워 넣는 기준 h2(ko 원문). howto 본문 규격(§1.4)이 이 제목을 쓴다.
 * 용어 항목에는 보통 없으므로 그때는 본문 뒤에 붙는다.
 */
export const LIVE_ANCHOR_HEADING = '## 시그렌즈에서 확인하는 법';

export interface SplitMarkdown {
    readonly before: string;
    /** 앵커 절 다음부터 끝까지. 앵커가 없거나 마지막 절이면 null. */
    readonly after: string | null;
}

const H2_LINE = /^##\s+/;
/** `extractToc`(legal-toc)와 같은 h2 제목 추출 — 여분 공백·닫는 `#`을 무시한다. `###`는 `\s+`에서 걸러진다. */
const H2_TITLE = /^##\s+(.+?)\s*#*\s*$/;

function h2Title(line: string): string | null {
    return H2_TITLE.exec(line)?.[1] ?? null;
}

const FENCE_LINE = /^\s*(```|~~~)/;

/** 줄마다 "코드 펜스 밖인가". 펜스를 여닫는 줄 자체는 밖이 아니다. */
function fenceMask(lines: readonly string[]): boolean[] {
    let inFence = false;
    return lines.map(line => {
        if (FENCE_LINE.test(line)) {
            inFence = !inFence;
            return false;
        }
        return !inFence;
    });
}

/**
 * `heading` 절이 끝나는 자리(다음 h2 직전)에서 마크다운을 둘로 나눈다. 두 조각은 각각
 * `GuideMarkdown`으로 렌더되며, 본문 안에서 h2/h3 제목이 유일하면 `rehype-slug` id는 분할 전과 같다
 * (코드 펜스 안의 `## `는 제목이 아니라 무시한다. 유일성은 시드 린트 `db/scripts/lib/guideSeed.ts`의 `duplicateHeadingErrors`가 강제한다.)
 */
export function splitMarkdownAtHeading(
    markdown: string,
    heading: string
): SplitMarkdown {
    const lines = markdown.split('\n');
    const anchorTitle = h2Title(heading.trim());
    const outsideFence = fenceMask(lines);
    const anchor =
        anchorTitle === null
            ? -1
            : lines.findIndex(
                  (line, index) =>
                      outsideFence[index] && h2Title(line) === anchorTitle
              );
    if (anchor === -1) return { before: markdown, after: null };
    const next = lines.findIndex(
        (line, index) =>
            index > anchor && outsideFence[index] && H2_LINE.test(line)
    );
    if (next === -1) return { before: markdown, after: null };
    return {
        before: lines.slice(0, next).join('\n').trimEnd(),
        after: lines.slice(next).join('\n'),
    };
}
