import type { ComponentPropsWithoutRef } from 'react';
import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/cn';

export const MARKDOWN_TEXT_COMPONENTS: Components = {
    p: ({ children }) => (
        <p className="mb-2 leading-[1.75] whitespace-pre-line last:mb-0">
            {children}
        </p>
    ),
    strong: ({ children }) => (
        <strong className="text-secondary-100 font-semibold">{children}</strong>
    ),
    em: ({ children }) => (
        <em className="text-secondary-300 italic">{children}</em>
    ),
    ul: ({ children }) => (
        <ul className="mb-2 ml-4 list-disc space-y-1 leading-[1.75] last:mb-0">
            {children}
        </ul>
    ),
    ol: ({ children }) => (
        <ol className="mb-2 ml-4 list-decimal space-y-1 leading-[1.75] last:mb-0">
            {children}
        </ol>
    ),
    li: ({ children }) => <li className="pl-0.5">{children}</li>,
    h1: ({ children }) => (
        <p className="text-secondary-100 mb-2 leading-[1.6] font-semibold last:mb-0">
            {children}
        </p>
    ),
    h2: ({ children }) => (
        <p className="text-secondary-100 mb-2 leading-[1.6] font-semibold last:mb-0">
            {children}
        </p>
    ),
    h3: ({ children }) => (
        <p className="text-secondary-200 mb-1.5 leading-[1.65] font-medium last:mb-0">
            {children}
        </p>
    ),
    code: ({ children }) => (
        <code className="bg-secondary-800 text-secondary-300 rounded px-1 py-0.5 font-mono text-[10px]">
            {children}
        </code>
    ),
    pre: ({ children }) => (
        <pre className="bg-secondary-800 text-secondary-300 mb-1.5 overflow-x-auto rounded p-2 font-mono text-[10px] last:mb-0">
            {children}
        </pre>
    ),
};

interface MarkdownTextProps extends Omit<
    ComponentPropsWithoutRef<'div'>,
    'children'
> {
    children: string;
    components?: Components;
}

export function MarkdownText({
    children,
    className,
    components = MARKDOWN_TEXT_COMPONENTS,
    ...props
}: MarkdownTextProps) {
    return (
        <div
            className={cn(
                'leading-[1.75] tracking-normal [word-break:keep-all]',
                className
            )}
            {...props}
        >
            <ReactMarkdown components={components}>{children}</ReactMarkdown>
        </div>
    );
}
