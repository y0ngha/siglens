import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';

interface PolicyMarkdownBodyProps {
    markdown: string;
}

function isInternalHref(href: string | undefined): boolean {
    if (!href) return false;
    return href.startsWith('/') && !href.startsWith('//');
}

const components: Components = {
    h2: ({ id, children }) => (
        <h2
            id={id}
            className="scroll-mt-24 text-lg font-semibold text-secondary-100 sm:text-xl"
        >
            {children}
        </h2>
    ),
    h3: ({ id, children }) => (
        <h3
            id={id}
            className="scroll-mt-24 text-base font-medium text-secondary-200 sm:text-lg"
        >
            {children}
        </h3>
    ),
    p: ({ children }) => (
        <p className="mt-3 text-sm leading-relaxed text-secondary-300 sm:text-base">
            {children}
        </p>
    ),
    ul: ({ children }) => (
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-secondary-300 sm:text-base">
            {children}
        </ul>
    ),
    li: ({ children }) => <li>{children}</li>,
    strong: ({ children }) => (
        <strong className="font-semibold text-secondary-200">{children}</strong>
    ),
    a: ({ href, children }) => {
        if (isInternalHref(href)) {
            return (
                <Link
                    href={href ?? '#'}
                    className="rounded-sm text-primary-400 transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-950 focus-visible:outline-none"
                >
                    {children}
                </Link>
            );
        }
        return (
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-sm text-primary-400 transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-950 focus-visible:outline-none"
            >
                {children}
            </a>
        );
    },
};

/** Render legal terms markdown body with SigLens design system classes.
 *  Internal links are converted to next/link; external links open in a new tab. */
export function PolicyMarkdownBody({ markdown }: PolicyMarkdownBodyProps) {
    return (
        <div className="space-y-8">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSlug]}
                components={components}
            >
                {markdown}
            </ReactMarkdown>
        </div>
    );
}
