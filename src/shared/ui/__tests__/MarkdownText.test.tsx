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

    it('renders ordered lists with numbered list items', () => {
        render(<MarkdownText>{'1. first\n2. second'}</MarkdownText>);
        const list = screen.getByText('first').closest('ol');
        expect(list).toBeInTheDocument();
        expect(screen.getByText('first').tagName).toBe('LI');
        expect(screen.getByText('second').tagName).toBe('LI');
    });

    it('renders h1/h2/h3 headings as visually-demoted <p> tags (not real heading elements)', () => {
        render(
            <MarkdownText>
                {'# Heading 1\n\n## Heading 2\n\n### Heading 3'}
            </MarkdownText>
        );

        const h1 = screen.getByText('Heading 1');
        const h2 = screen.getByText('Heading 2');
        const h3 = screen.getByText('Heading 3');

        expect(h1.tagName).toBe('P');
        expect(h2.tagName).toBe('P');
        expect(h3.tagName).toBe('P');
        expect(h1.className).toContain('font-semibold');
        expect(h3.className).toContain('font-medium');
    });

    it('renders fenced code blocks with a <pre> wrapper', () => {
        render(<MarkdownText>{'```\nconst x = 1;\n```'}</MarkdownText>);
        const code = screen.getByText('const x = 1;');
        expect(code.tagName).toBe('CODE');
        expect(code.closest('pre')).toBeInTheDocument();
    });

    it('allows overriding the default component map via the components prop', () => {
        render(
            <MarkdownText
                components={{
                    strong: ({ children }) => (
                        <strong data-testid="custom-strong">{children}</strong>
                    ),
                }}
            >
                **bold text**
            </MarkdownText>
        );
        expect(screen.getByTestId('custom-strong')).toHaveTextContent(
            'bold text'
        );
    });
});
