import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AgentMarkdown } from '@/widgets/agent-chat/AgentMarkdown';

describe('AgentMarkdown', () => {
    it('drops images, and renders an http(s) link with a safe rel and the host shown', () => {
        const { container } = render(
            <AgentMarkdown>
                {'![x](https://evil/a.png) [뉴스](https://example.com/p)'}
            </AgentMarkdown>
        );
        expect(container.querySelector('img')).toBeNull();
        const a = screen.getByRole('link');
        expect(a).toHaveAttribute('rel', 'noopener noreferrer nofollow');
        expect(a).toHaveAttribute('target', '_blank');
        expect(a.textContent).toContain('example.com');
    });

    it('price ranges with single tildes stay plain text — only ~~double~~ strikes through', () => {
        const { container } = render(
            <AgentMarkdown>
                {
                    '중립: 266,500~270,666원에서 등락 반복 시 263,225~277,250원 횡보. ~~취소~~'
                }
            </AgentMarkdown>
        );
        const struck = container.querySelectorAll('del');
        expect(struck).toHaveLength(1);
        expect(struck[0]!.textContent).toBe('취소');
        expect(container.textContent).toContain('266,500~270,666원');
    });

    it('renders non-http(s) schemes as plain text, not a link', () => {
        render(<AgentMarkdown>{'[click](javascript:alert(1))'}</AgentMarkdown>);
        expect(screen.queryByRole('link')).toBeNull();
        expect(screen.getByText('click')).toBeInTheDocument();
    });

    it('renders GFM tables as a table, not rows of raw pipes', () => {
        const { container } = render(
            <AgentMarkdown>
                {'| 항목 | 값 |\n| --- | --- |\n| 현재가 | 195.70 |'}
            </AgentMarkdown>
        );
        expect(container.querySelector('table')).not.toBeNull();
        expect(
            screen.getByRole('columnheader', { name: '항목' })
        ).toBeInTheDocument();
        expect(container.textContent).not.toContain('| ---');
    });

    it('answer headings sit below the page outline (no h1/h2 inside a message)', () => {
        const { container } = render(
            <AgentMarkdown>{'# 요약\n\n## 시세\n\n### 뉴스'}</AgentMarkdown>
        );
        expect(container.querySelector('h1, h2')).toBeNull();
        expect(
            screen.getByRole('heading', { level: 3, name: '요약' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { level: 4, name: '뉴스' })
        ).toBeInTheDocument();
    });
});
