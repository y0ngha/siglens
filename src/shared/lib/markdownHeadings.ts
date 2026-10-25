export interface MarkdownHeading {
    readonly level: 2 | 3;
    readonly title: string;
}

export interface MarkdownLine {
    readonly text: string;
    /** 코드 펜스를 여닫는 줄과 그 안쪽 줄. 이 줄들은 제목이 될 수 없다. */
    readonly inFence: boolean;
    readonly heading: MarkdownHeading | null;
}

const FENCE_LINE = /^\s*(```|~~~)/;
/** `extractToc`(legal-toc)와 같은 h2·h3 제목 추출 — 여분 공백·닫는 `#`을 무시한다. `####`는 걸러진다. */
const SECTION_HEADING = /^(#{2,3})\s+(.+?)\s*#*\s*$/;

/** 한 줄이 h2/h3 제목이면 레벨과 제목을, 아니면 `null`. 코드 펜스 여부는 보지 않는다. */
export function parseHeadingLine(line: string): MarkdownHeading | null {
    const match = SECTION_HEADING.exec(line);
    if (match === null) return null;
    return { level: match[1].length === 2 ? 2 : 3, title: match[2] };
}

interface ScanState {
    readonly open: boolean;
    readonly lines: readonly MarkdownLine[];
}

/**
 * 마크다운을 줄 단위로 훑어 코드 펜스 안팎과 h2/h3 제목을 한 번에 판정한다.
 * 가이드 시드 린트(`guideSeed`)와 본문 분할(`splitMarkdown`)이 같은 판정을 쓰도록 한 곳에 둔다.
 */
export function scanMarkdownLines(markdown: string): readonly MarkdownLine[] {
    return markdown.split('\n').reduce<ScanState>(
        ({ open, lines }, text) => {
            if (FENCE_LINE.test(text)) {
                return {
                    open: !open,
                    lines: [...lines, { text, inFence: true, heading: null }],
                };
            }
            return {
                open,
                lines: [
                    ...lines,
                    {
                        text,
                        inFence: open,
                        heading: open ? null : parseHeadingLine(text),
                    },
                ],
            };
        },
        { open: false, lines: [] }
    ).lines;
}
