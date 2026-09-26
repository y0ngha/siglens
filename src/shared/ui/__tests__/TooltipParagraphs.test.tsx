import { render, screen } from '@testing-library/react';
import { TooltipParagraphs } from '@/shared/ui/TooltipParagraphs';

describe('TooltipParagraphs', () => {
    it('renders each catalog paragraph as its own <p>', () => {
        render(
            <TooltipParagraphs
                namespace="widgets.congress"
                tooltipKey="amountRange"
            />
        );

        const paragraphs = screen.getAllByText(/STOCK Act|거래의 실제 규모/);
        expect(paragraphs).toHaveLength(2);
        for (const p of paragraphs) {
            expect(p.tagName).toBe('P');
        }
        expect(
            screen.getByText(/STOCK Act\(2012\)는 의원이 정확한 금액 대신/)
        ).toBeInTheDocument();
        expect(
            screen.getByText(/거래의 실제 규모를 정확히 알기 어렵고/)
        ).toBeInTheDocument();
    });

    it('renders nothing when the catalog key resolves to a non-array value', () => {
        // `common.notFound` is a plain string in the catalog, not an array of
        // paragraphs, so the component must bail out to null instead of crashing.
        const { container } = render(
            <TooltipParagraphs
                namespace="widgets.congress"
                tooltipKey="doesNotExist"
            />
        );
        expect(container).toBeEmptyDOMElement();
    });
});
