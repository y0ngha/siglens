'use client';

import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';

/**
 * `MarkdownText`의 실제 렌더러. `react-markdown`(+ micromark·remark, 원본 ~112KB)을
 * 여기에만 두고 `MarkdownText`가 지연 로드한다 — 정적으로 import하면 그 무게가 차트 탭·
 * 종합 탭의 첫 JS에 실리는데, 그 화면들의 마크다운은 하이드레이션 뒤 AI 응답이 와야
 * 그려진다(2026-10-05 JS 커버리지: `/AAPL`에서 이 청크 78% 미사용).
 */
export const MARKDOWN_TEXT_COMPONENTS: Components = {
    p: ({ children }) => (
        <p className="mb-2 leading-[1.75] whitespace-pre-line last:mb-0">
            {children}
        </p>
    ),
    strong: ({ children }) => (
        <strong className="font-semibold text-secondary-100">{children}</strong>
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
        <p className="mb-2 leading-[1.6] font-semibold text-secondary-100 last:mb-0">
            {children}
        </p>
    ),
    h2: ({ children }) => (
        <p className="mb-2 leading-[1.6] font-semibold text-secondary-100 last:mb-0">
            {children}
        </p>
    ),
    h3: ({ children }) => (
        <p className="mb-1.5 leading-[1.65] font-medium text-secondary-200 last:mb-0">
            {children}
        </p>
    ),
    code: ({ children }) => (
        <code className="rounded bg-secondary-800 px-1 py-0.5 font-mono text-[10px] text-secondary-300">
            {children}
        </code>
    ),
    pre: ({ children }) => (
        <pre className="mb-1.5 overflow-x-auto rounded bg-secondary-800 p-2 font-mono text-[10px] text-secondary-300 last:mb-0">
            {children}
        </pre>
    ),
};

interface MarkdownRendererProps {
    children: string;
    components?: Components;
}

export function MarkdownRenderer({
    children,
    components = MARKDOWN_TEXT_COMPONENTS,
}: MarkdownRendererProps) {
    return <ReactMarkdown components={components}>{children}</ReactMarkdown>;
}
