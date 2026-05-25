import { render } from '@testing-library/react';
import { JsonLd } from '@/shared/ui/JsonLd';

describe('JsonLd', () => {
    it('renders a script tag with type application/ld+json', () => {
        const data = { '@type': 'WebPage', name: 'Test' };
        const { container } = render(<JsonLd data={data} />);
        const script = container.querySelector(
            'script[type="application/ld+json"]'
        );
        expect(script).toBeInTheDocument();
    });

    it('serializes data as JSON', () => {
        const data = { '@type': 'WebPage', name: 'Test' };
        const { container } = render(<JsonLd data={data} />);
        const script = container.querySelector('script');
        const content = script?.innerHTML ?? '';
        expect(JSON.parse(content.replace(/\\u003c/g, '<'))).toEqual(data);
    });

    it('escapes < characters to prevent script injection', () => {
        const data = { name: '</script><script>alert(1)</script>' };
        const { container } = render(<JsonLd data={data} />);
        const script = container.querySelector('script');
        expect(script?.innerHTML).not.toContain('</script>');
        expect(script?.innerHTML).toContain('\\u003c');
    });
});
