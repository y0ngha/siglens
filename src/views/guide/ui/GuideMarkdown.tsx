import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import ReactMarkdown, { type Components, type Options } from 'react-markdown';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';
import { cn } from '@/shared/lib/cn';
import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';
import {
    HEADING_SECTION,
    HEADING_SUBSECTION,
} from '@/shared/lib/typographyStyles';
import { LocaleLink } from '@/shared/ui/LocaleLink';

/**
 * GFM 플러그인 설정. 본문은 범위를 `5~30분봉`처럼 물결표 하나로 적는데, 기본값은 물결표
 * 하나도 취소선으로 읽어 두 범위 사이 글자를 지운다. 취소선은 `~~`만 인정한다.
 */
const REMARK_PLUGINS: NonNullable<Options['remarkPlugins']> = [
    [remarkGfm, { singleTilde: false }],
];

interface GuideMarkdownProps {
    readonly markdown: string;
}

const BODY_TEXT = 'text-[15px] leading-7 text-secondary-300 sm:text-base';

/** 본문 속 링크는 색만으로 구분하지 않는다(WCAG 1.4.1) — 밑줄을 둔다. */
const LINK =
    'rounded-sm text-primary-400 underline underline-offset-2 transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none motion-reduce:transition-none';

function isInternalHref(href: string | undefined): href is string {
    return href !== undefined && href.startsWith('/') && !href.startsWith('//');
}

/**
 * 가로로 넘치는 표의 스크롤 영역. 포커스가 없으면 키보드 사용자는 넘친 열을 볼 수 없다
 * (WCAG 2.1.1) — 스크롤 영역은 `tabIndex=0` + `role="region"` + 이름을 함께 가진다.
 */
function ScrollableTable({ children }: { children: ReactNode }) {
    const t = useTranslations('views.guide');
    return (
        <div
            tabIndex={0}
            role="region"
            aria-label={t('tableLabel')}
            className={cn(
                SURFACE_CARD,
                'mt-5 overflow-x-auto focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none'
            )}
        >
            <table className="w-full min-w-[26rem] border-collapse text-left text-sm">
                {children}
            </table>
        </div>
    );
}

/**
 * 가이드 본문 마크다운 요소 매핑 — 서버 렌더 전용이다.
 *
 * 실제 `h2`/`h3`와 `LocaleLink`를 그대로 HTML에 싣는 것이 목적이라 클라이언트
 * `MarkdownRenderer`를 쓰지 않는다. 제목 위계는 페이지 토큰을 따른다(DESIGN.md#DS-4).
 * 본문 `h2`는 `rehype-slug`가 붙인 id를 쓰며, 같은 알고리즘(github-slugger)의
 * `extractToc`가 목차를 만든다.
 */
const components: Components = {
    h2: ({ id, children }) => (
        <h2 id={id} className={cn(HEADING_SECTION, 'mt-12 scroll-mt-24')}>
            {children}
        </h2>
    ),
    h3: ({ id, children }) => (
        <h3 id={id} className={cn(HEADING_SUBSECTION, 'mt-8 scroll-mt-24')}>
            {children}
        </h3>
    ),
    p: ({ children }) => <p className={cn(BODY_TEXT, 'mt-4')}>{children}</p>,
    ul: ({ children }) => (
        <ul
            className={cn(
                BODY_TEXT,
                'mt-4 list-disc space-y-2 pl-5 marker:text-secondary-500'
            )}
        >
            {children}
        </ul>
    ),
    ol: ({ children }) => (
        <ol
            className={cn(
                BODY_TEXT,
                'mt-4 list-decimal space-y-2 pl-5 marker:text-secondary-500'
            )}
        >
            {children}
        </ol>
    ),
    li: ({ children }) => <li className="pl-1">{children}</li>,
    strong: ({ children }) => (
        <strong className="font-semibold text-secondary-100">{children}</strong>
    ),
    em: ({ children }) => <em className="italic">{children}</em>,
    blockquote: ({ children }) => (
        <blockquote className="mt-4 border-l-2 border-secondary-600 pl-4 text-secondary-400">
            {children}
        </blockquote>
    ),
    code: ({ children }) => (
        <code className="rounded bg-secondary-700/60 px-1.5 py-0.5 font-mono text-[0.9em] text-secondary-100">
            {children}
        </code>
    ),
    hr: () => <hr className="mt-10 border-secondary-700" />,
    // 표만 가로로 스크롤한다. 페이지가 360px에서 옆으로 밀리지 않게 하고, 키보드로도
    // 스크롤할 수 있게 포커스를 받는다.
    table: ({ children }) => <ScrollableTable>{children}</ScrollableTable>,
    thead: ({ children }) => (
        <thead className="bg-secondary-700/40">{children}</thead>
    ),
    th: ({ children }) => (
        <th
            scope="col"
            className="px-4 py-2.5 text-xs font-semibold whitespace-nowrap text-secondary-100"
        >
            {children}
        </th>
    ),
    td: ({ children }) => (
        <td className="border-t border-secondary-700 px-4 py-2.5 align-top leading-relaxed text-secondary-300">
            {children}
        </td>
    ),
    a: ({ href, children }) =>
        isInternalHref(href) ? (
            <LocaleLink href={href} prefetch={false} className={LINK}>
                {children}
            </LocaleLink>
        ) : (
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={LINK}
            >
                {children}
            </a>
        ),
};

/** 가이드 본문(DB 마크다운)을 디자인 시스템 클래스로 서버에서 렌더한다. */
export function GuideMarkdown({ markdown }: GuideMarkdownProps) {
    return (
        <div className="[&>:first-child]:mt-0">
            <ReactMarkdown
                remarkPlugins={REMARK_PLUGINS}
                rehypePlugins={[rehypeSlug]}
                components={components}
            >
                {markdown}
            </ReactMarkdown>
        </div>
    );
}
