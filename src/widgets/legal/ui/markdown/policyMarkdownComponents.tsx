import type { Components } from 'react-markdown';
import { PolicyLink } from './PolicyLink';

/**
 * 약관 본문 마크다운의 요소별 렌더러(디자인 시스템 클래스 적용).
 *
 * 제목의 `id`는 `rehype-slug`가 붙인 값을 그대로 넘긴다 — 목차 링크(`#id`)가
 * 이 앵커를 가리키고, `scroll-mt-24`가 고정 헤더 아래로 제목을 내린다.
 */
export const POLICY_MARKDOWN_COMPONENTS: Components = {
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
    a: ({ href, children }) => <PolicyLink href={href}>{children}</PolicyLink>,
};
