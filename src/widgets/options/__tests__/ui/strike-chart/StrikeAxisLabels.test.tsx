import { render } from '@testing-library/react';
import { StrikeAxisLabels } from '@/widgets/options/ui/strike-chart/StrikeAxisLabels';

function renderLabels(strikes: number[], indices: number[]) {
    return render(
        <svg>
            <StrikeAxisLabels
                strikes={strikes}
                labelIndices={new Set(indices)}
            />
        </svg>
    ).container.querySelectorAll('text');
}

describe('StrikeAxisLabels', () => {
    describe('with few labels', () => {
        it('renders only the selected strikes, horizontal and centered', () => {
            const texts = renderLabels([100, 110, 120], [0, 2]);
            expect([...texts].map(t => t.textContent)).toEqual(['100', '120']);
            expect(texts[0]).toHaveAttribute('text-anchor', 'middle');
            expect(texts[0]).not.toHaveAttribute('transform');
        });
    });

    describe('with more labels than the rotation threshold', () => {
        it('rotates every label -45deg and end-anchors it', () => {
            const strikes = Array.from({ length: 8 }, (_, i) => 100 + i);
            const texts = renderLabels(
                strikes,
                strikes.map((_, i) => i)
            );
            expect(texts).toHaveLength(8);
            expect(texts[0]?.getAttribute('transform')).toMatch(
                /^rotate\(-45,/
            );
            expect(texts[0]).toHaveAttribute('text-anchor', 'end');
        });
    });

    it('renders nothing when no index is selected', () => {
        expect(renderLabels([100, 110], [])).toHaveLength(0);
    });
});
