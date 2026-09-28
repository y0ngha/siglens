import { render, screen } from '@testing-library/react';
import React from 'react';

// react-markdown and its plugins are ESM-only. Mock the module with a minimal
// implementation that parses the markdown just enough for structural testing.
vi.mock('react-markdown', async () => {
    const React = await vi.importActual<typeof import('react')>('react');
    return {
        __esModule: true,
        default: function ReactMarkdown({
            children,
            components = {},
        }: {
            children: string;
            components?: Record<string, unknown>;
        }) {
            // Minimal parser: split by lines and produce basic elements
            const lines = (children as string).split('\n');
            const elements: React.ReactElement[] = [];
            let i = 0;

            while (i < lines.length) {
                const line = lines[i];

                if (line.startsWith('### ')) {
                    const text = line.slice(4).trim();
                    const id = text
                        .toLowerCase()
                        .replace(/[()[\]{}.,!?;:]/g, '')
                        .replace(/\s+/g, '-');
                    const H3 = components['h3'] as
                        | React.ComponentType<{ id: string; children: string }>
                        | undefined;
                    if (H3) {
                        elements.push(
                            <H3 key={i} id={id}>
                                {text}
                            </H3>
                        );
                    } else {
                        elements.push(
                            <h3 key={i} id={id}>
                                {text}
                            </h3>
                        );
                    }
                } else if (line.startsWith('## ')) {
                    const text = line.slice(3).trim();
                    const id = text
                        .toLowerCase()
                        .replace(/[()[\]{}.,!?;:]/g, '')
                        .replace(/\s+/g, '-');
                    const H2 = components['h2'] as
                        | React.ComponentType<{ id: string; children: string }>
                        | undefined;
                    if (H2) {
                        elements.push(
                            <H2 key={i} id={id}>
                                {text}
                            </H2>
                        );
                    } else {
                        elements.push(
                            <h2 key={i} id={id}>
                                {text}
                            </h2>
                        );
                    }
                } else if (line.startsWith('- ')) {
                    const listItems: React.ReactElement[] = [];
                    const Li = components['li'] as
                        | React.ComponentType<{ children: string }>
                        | undefined;
                    while (i < lines.length && lines[i].startsWith('- ')) {
                        const itemText = lines[i].slice(2);
                        listItems.push(
                            Li ? (
                                <Li key={i}>{itemText}</Li>
                            ) : (
                                <li key={i}>{itemText}</li>
                            )
                        );
                        i++;
                    }
                    const Ul = components['ul'] as
                        | React.ComponentType<{
                              children: React.ReactElement[];
                          }>
                        | undefined;
                    elements.push(
                        Ul ? (
                            <Ul key={`ul-${i}`}>{listItems}</Ul>
                        ) : (
                            <ul key={`ul-${i}`}>{listItems}</ul>
                        )
                    );
                    continue;
                } else if (line.trim()) {
                    // Inline link parsing for anchor tests
                    const linkRegex = /\[([^\]]+)\]\(([^)]*)\)/g;
                    const P = components['p'] as
                        | React.ComponentType<{ children: React.ReactNode }>
                        | undefined;
                    const A = components['a'] as
                        | React.ComponentType<{
                              href: string;
                              children: string;
                          }>
                        | undefined;
                    const Strong = components['strong'] as
                        | React.ComponentType<{ children: React.ReactNode }>
                        | undefined;
                    const boldRegex = /\*\*([^*]+)\*\*/g;

                    if (boldRegex.test(line) && Strong) {
                        boldRegex.lastIndex = 0;
                        const parts: React.ReactNode[] = [];
                        let last = 0;
                        let bm: RegExpExecArray | null;
                        while ((bm = boldRegex.exec(line)) !== null) {
                            if (bm.index > last) {
                                parts.push(line.slice(last, bm.index));
                            }
                            parts.push(<Strong key={bm.index}>{bm[1]}</Strong>);
                            last = bm.index + bm[0].length;
                        }
                        if (last < line.length) parts.push(line.slice(last));
                        elements.push(
                            components['p'] ? (
                                (() => {
                                    const P = components[
                                        'p'
                                    ] as React.ComponentType<{
                                        children: React.ReactNode;
                                    }>;
                                    return <P key={i}>{parts}</P>;
                                })()
                            ) : (
                                <p key={i}>{parts}</p>
                            )
                        );
                    } else if (linkRegex.test(line) && A) {
                        linkRegex.lastIndex = 0;
                        const parts: React.ReactNode[] = [];
                        let last = 0;
                        let m: RegExpExecArray | null;
                        while ((m = linkRegex.exec(line)) !== null) {
                            if (m.index > last) {
                                parts.push(line.slice(last, m.index));
                            }
                            parts.push(
                                <A key={m.index} href={m[2]}>
                                    {m[1]}
                                </A>
                            );
                            last = m.index + m[0].length;
                        }
                        if (last < line.length) parts.push(line.slice(last));
                        elements.push(
                            P ? <P key={i}>{parts}</P> : <p key={i}>{parts}</p>
                        );
                    } else {
                        elements.push(
                            P ? <P key={i}>{line}</P> : <p key={i}>{line}</p>
                        );
                    }
                }
                i++;
            }

            return React.createElement(React.Fragment, null, ...elements);
        },
    };
});

vi.mock('remark-gfm', () => ({ __esModule: true, default: () => {} }));
vi.mock('rehype-slug', () => ({ __esModule: true, default: () => {} }));

import { PolicyMarkdownBody } from '@/widgets/legal/PolicyMarkdownBody';

describe('PolicyMarkdownBody', () => {
    it('renders h2 with slug id', () => {
        const md = '## 1. 총칙\n\n본문\n';
        render(<PolicyMarkdownBody markdown={md} />);
        const h2 = screen.getByRole('heading', { level: 2, name: '1. 총칙' });
        expect(h2.id).toBe('1-총칙');
    });

    it('renders internal link as next/link', () => {
        const md = '단어 [계정 설정](/account/delete) 안내';
        const { container } = render(<PolicyMarkdownBody markdown={md} />);
        const anchor = container.querySelector('a[href="/account/delete"]');
        expect(anchor).not.toBeNull();
        // 외부 target 없어야 함
        expect(anchor?.getAttribute('target')).toBeNull();
    });

    it('renders external link with target=_blank rel=noopener', () => {
        const md = '문의 [메일](mailto:stock.siglens@gmail.com)';
        const { container } = render(<PolicyMarkdownBody markdown={md} />);
        const anchor = container.querySelector('a[href^="mailto:"]');
        expect(anchor?.getAttribute('target')).toBe('_blank');
        expect(anchor?.getAttribute('rel')).toContain('noopener');
    });

    it('renders unordered list', () => {
        const md = '- 항목1\n- 항목2\n';
        render(<PolicyMarkdownBody markdown={md} />);
        const items = screen.getAllByRole('listitem');
        expect(items).toHaveLength(2);
    });

    it('renders h3 with slug id and demoted styling', () => {
        const md = '### 2.1 하위 조항\n\n본문\n';
        render(<PolicyMarkdownBody markdown={md} />);
        const h3 = screen.getByRole('heading', {
            level: 3,
            name: '2.1 하위 조항',
        });
        expect(h3.id).toBe('21-하위-조항');
        expect(h3.className).toContain('text-secondary-200');
    });

    it('renders bold text as <strong>', () => {
        const md = '이용자는 **본인 확인**을 거쳐야 한다.';
        render(<PolicyMarkdownBody markdown={md} />);
        const strong = screen.getByText('본인 확인');
        expect(strong.tagName).toBe('STRONG');
        expect(strong.className).toContain('font-semibold');
    });

    it('treats a link with an empty href as external (falsy short-circuit)', () => {
        // isInternalHref bails out early on a falsy href, so an empty-string
        // href must not be routed through next/link.
        const md = '자료 [빈 링크]()';
        const { container } = render(<PolicyMarkdownBody markdown={md} />);
        const anchor = container.querySelector('a');
        expect(anchor?.getAttribute('target')).toBe('_blank');
        expect(anchor?.getAttribute('rel')).toContain('noopener');
    });

    it('treats a protocol-relative link (//) as external, not internal', () => {
        // isInternalHref requires a leading "/" but rejects "//" so
        // protocol-relative URLs (e.g. //cdn.example.com) don't get routed
        // through next/link, which can't resolve them.
        const md = '자료 [다운로드](//cdn.example.com/file.pdf)';
        const { container } = render(<PolicyMarkdownBody markdown={md} />);
        const anchor = container.querySelector(
            'a[href="//cdn.example.com/file.pdf"]'
        );
        expect(anchor?.getAttribute('target')).toBe('_blank');
        expect(anchor?.getAttribute('rel')).toContain('noopener');
    });
});
