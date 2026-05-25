import { vi } from 'vitest';
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

                if (line.startsWith('## ')) {
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
                    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
                    const P = components['p'] as
                        | React.ComponentType<{ children: React.ReactNode }>
                        | undefined;
                    const A = components['a'] as
                        | React.ComponentType<{
                              href: string;
                              children: string;
                          }>
                        | undefined;

                    if (linkRegex.test(line) && A) {
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
});
