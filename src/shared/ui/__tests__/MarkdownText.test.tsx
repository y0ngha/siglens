import { render, screen } from '@testing-library/react';
import { MarkdownText } from '@/shared/ui/MarkdownText';

describe('MarkdownText', () => {
    it('renders plain text', () => {
        render(<MarkdownText>Hello world</MarkdownText>);
        expect(screen.getByText('Hello world')).toBeInTheDocument();
    });

    it('renders bold text with strong tag', () => {
        render(<MarkdownText>**bold text**</MarkdownText>);
        const strong = screen.getByText('bold text');
        expect(strong.tagName).toBe('STRONG');
    });

    it('renders italic text with em tag', () => {
        render(<MarkdownText>*italic text*</MarkdownText>);
        const em = screen.getByText('italic text');
        expect(em.tagName).toBe('EM');
    });

    it('renders unordered lists', () => {
        render(<MarkdownText>{'- item 1\n- item 2'}</MarkdownText>);
        expect(screen.getByText('item 1')).toBeInTheDocument();
        expect(screen.getByText('item 2')).toBeInTheDocument();
    });

    it('renders inline code', () => {
        render(<MarkdownText>{'Use `code` here'}</MarkdownText>);
        expect(screen.getByText('code')).toBeInTheDocument();
        expect(screen.getByText('code').tagName).toBe('CODE');
    });

    it('applies custom className', () => {
        const { container } = render(
            <MarkdownText className="custom">text</MarkdownText>
        );
        expect(container.firstChild).toHaveClass('custom');
    });

    it('passes through additional div props', () => {
        render(<MarkdownText data-testid="md-wrapper">text</MarkdownText>);
        expect(screen.getByTestId('md-wrapper')).toBeInTheDocument();
    });
});
