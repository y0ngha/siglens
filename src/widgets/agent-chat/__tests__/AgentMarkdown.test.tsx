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
});
