/** 항목 본문을 라이브 종목 모듈 자리(앵커 h2 절 끝)에서 두 조각으로 나눈다. */
import {
    parseHeadingLine,
    scanMarkdownLines,
} from '@/shared/lib/markdownHeadings';

/** 나눈 두 조각. 항목 페이지가 두 조각 사이에 라이브 종목 모듈을 끼운다. */
export interface SplitMarkdown {
    readonly before: string;
    /** 앵커 절 다음부터 끝까지. 앵커가 없거나 마지막 절이면 null. */
    readonly after: string | null;
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
    const lines = scanMarkdownLines(markdown);
    const anchorHeading = parseHeadingLine(heading.trim());
    const anchorTitle = anchorHeading?.level === 2 ? anchorHeading.title : null;
    const isH2 = (line: (typeof lines)[number], title?: string) =>
        line.heading?.level === 2 &&
        (title === undefined || line.heading.title === title);
    const anchor =
        anchorTitle === null
            ? -1
            : lines.findIndex(line => isH2(line, anchorTitle));
    if (anchor === -1) return { before: markdown, after: null };
    const next = lines.findIndex((line, index) => index > anchor && isH2(line));
    if (next === -1) return { before: markdown, after: null };
    return {
        before: lines
            .slice(0, next)
            .map(line => line.text)
            .join('\n')
            .trimEnd(),
        after: lines
            .slice(next)
            .map(line => line.text)
            .join('\n'),
    };
}
