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
