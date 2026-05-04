export interface TocItem {
    id: string;
    label: string;
}

const H2_PATTERN = /^##\s+(.+?)\s*$/gm;

/** Convert heading text to a stable slug compatible with rehype-slug. */
function slugify(text: string): string {
    return text
        .trim()
        .toLowerCase()
        .replace(/[()[\]{}.,!?;:]/g, '')
        .replace(/\s+/g, '-');
}

/** Extract h2 headings from markdown for table-of-contents rendering. */
export function extractToc(markdown: string): readonly TocItem[] {
    return [...markdown.matchAll(H2_PATTERN)].map(match => {
        const label = match[1].trim();
        return { id: slugify(label), label };
    });
}
