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
            // Italic: *text* / _text_ (single marker, non-greedy, no
            // surrounding word-char requirement — Korean prose has no
            // snake_case identifiers to false-positive on here).
            .replace(/\*(.+?)\*/g, '$1')
            .replace(/_(.+?)_/g, '$1')
            // Line-leading heading markers: "#", "##", ... "######"
            .replace(/^#{1,6}\s+/gm, '')
            // Line-leading bullet markers: "- ", "* ", "+ "
            .replace(/^[-*+]\s+/gm, '')
            // Line-leading numbered-list markers: "1. ", "12. " — anchored to
            // line start so a mid-sentence decimal ("3.5%") is never touched.
            .replace(/^\d+\.\s+/gm, '')
    );
}
