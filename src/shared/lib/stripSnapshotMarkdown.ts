/**
 * Strips the small subset of markdown markers that core AI analysis prose
 * actually uses (bold `**`/`__`, italic `*`/`_`, inline code `` ` ``,
 * heading `#`, bullet `-`/`*`/`+`, and numbered-list `1.` line markers),
 * leaving plain text (audit fix FIX 4).
 *
 * Every `*SnapshotProse` source field (technical `summary`, overall
 * `headlineKo`/`integratedConclusionKo`/bullet arrays/scenario text, and the
 * equivalent primary-prose fields on the other tabs) is Korean markdown — the
 * CLIENT widgets render the identical fields through `MarkdownText`
 * (`react-markdown`) so `**bold**`/`- item` render as real emphasis/list
 * markup there. The SEO snapshot renderers are plain server-rendered `<p>`/
 * `<li>` text (no client JS, no `react-markdown` dependency to keep this
 * server-cacheable and dependency-free) — without stripping, the literal
 * marker characters leak into the crawler-visible/indexed text.
 *
 * Deliberately NOT a full markdown parser — no markdown dependency is
 * introduced (project constraint). It only removes marker characters; it does
 * not reformat lists/headings into different prose (paragraph/list structure
 * for arrays is already handled by each renderer's own JSX, not by this
 * function). Applied per-field, BEFORE a field is `\n`-split into paragraphs
 * so line-leading markers (`- `, `#`, `1. `) are recognized per line.
 *
 * Lives in `shared/lib` (moved from `views/symbol/snapshot/lib` on 2026-09-17)
 * because `buildSnapshotMetaDescription` in `shared/lib/seo.ts` reads the same
 * markdown fields for `<meta name="description">`, and a shared module cannot
 * import from `views`. Production crawl after v0.79.2: chart-tab descriptions
 * that fell back to the raw `summary` field started with a literal
 * `**종합 진단**:`.
 */
export function stripSnapshotMarkdown(text: string): string {
    return (
        text
            // Bold: **text** / __text__ — strip before the single-marker
            // (italic) passes below so a bold pair's own markers aren't first
            // consumed as two separate italic markers.
            .replace(/\*\*(.+?)\*\*/g, '$1')
            .replace(/__(.+?)__/g, '$1')
            // Inline code: `text`
            .replace(/`([^`]+)`/g, '$1')
            // Italic: *text* / _text_ (single marker, non-greedy). 여는 기호 뒤와
            // 닫는 기호 앞은 공백이 아니어야 하고, 기호 바깥쪽에 영숫자가 붙으면
            // 기호로 보지 않는다. 경계가 없던 예전 식은 무관한 두 기호 사이를
            // 통째로 지웠다 — `250*2 … 100*3` → `2502 … 1003`, `BRK_A와 BRK_B` →
            // `BRKA와 BRKB`. 이 결과가 `<meta name="description">`으로도 나가게
            // 되면서(seo.ts) 경계를 넣었다. `\w`는 `u` 플래그 없이 한글을 포함하지
            // 않으므로 `*강조*입니다`는 그대로 벗겨진다.
            .replace(/(?<![\w*])\*(?=\S)(.+?)(?<=\S)\*(?![\w*])/g, '$1')
            .replace(/(?<![\w_])_(?=\S)(.+?)(?<=\S)_(?![\w_])/g, '$1')
            // Line-leading heading markers: "#", "##", ... "######"
            .replace(/^#{1,6}\s+/gm, '')
            // Line-leading bullet markers: "- ", "* ", "+ "
            .replace(/^[-*+]\s+/gm, '')
            // Line-leading numbered-list markers: "1. ", "12. " — anchored to
            // line start so a mid-sentence decimal ("3.5%") is never touched.
            .replace(/^\d+\.\s+/gm, '')
    );
}
