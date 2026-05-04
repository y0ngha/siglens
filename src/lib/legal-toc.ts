import GithubSlugger from 'github-slugger';

export interface TocItem {
    id: string;
    label: string;
}

const H2_PATTERN = /^##\s+(.+?)\s*$/gm;

/** Extract h2 headings from markdown for table-of-contents rendering. */
export function extractToc(markdown: string): readonly TocItem[] {
    const slugger = new GithubSlugger();
    return [...markdown.matchAll(H2_PATTERN)].map(match => {
        const label = match[1].trim();
        return { id: slugger.slug(label), label };
    });
}
