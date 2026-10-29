import ReactMarkdown, { type Options } from 'react-markdown';
import rehypeSlug from 'rehype-slug';
import { KOREAN_SAFE_REMARK_PLUGINS } from '@/shared/ui/markdownPlugins';
import { POLICY_MARKDOWN_COMPONENTS } from './ui/markdown/policyMarkdownComponents';

/** Heading ids come from rehype-slug so TOC anchors (`extractToc`) resolve. */
const REHYPE_PLUGINS: NonNullable<Options['rehypePlugins']> = [rehypeSlug];

interface PolicyMarkdownBodyProps {
    /** Policy body markdown as stored in the `terms` table. */
    readonly markdown: string;
}

/**
 * Render a terms/privacy markdown body with SIGLENS design system classes.
 * Link handling (locale-preserving internal links, new-tab external links,
 * same-tab mail/anchor links) lives in `PolicyLink`.
 */
export function PolicyMarkdownBody({ markdown }: PolicyMarkdownBodyProps) {
    return (
        <div className="space-y-8">
            <ReactMarkdown
                remarkPlugins={KOREAN_SAFE_REMARK_PLUGINS}
                rehypePlugins={REHYPE_PLUGINS}
                components={POLICY_MARKDOWN_COMPONENTS}
            >
                {markdown}
            </ReactMarkdown>
        </div>
    );
}
