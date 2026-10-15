import { render } from '@testing-library/react';
import { sparklinePoints } from '@/features/watchlist/lib/sparklinePoints';
import { Sparkline } from '@/features/watchlist/ui/Sparkline';

describe('Sparkline', () => {
    it('값이 2개 미만이면 아무것도 그리지 않는다', () => {
        const { container } = render(<Sparkline values={[1]} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('장식 SVG로 그리고 호출부 클래스를 합친다', () => {
        const { container } = render(
            <Sparkline values={[1, 2, 3]} className="text-ui-success-text" />
        );
        const svg = container.querySelector('svg');
        expect(svg).toHaveAttribute('aria-hidden', 'true');
        expect(svg).toHaveClass('text-ui-success-text', 'h-6', 'w-16');
        expect(svg?.querySelector('polyline')).toHaveAttribute(
            'points',
            sparklinePoints([1, 2, 3])
        );
    });
});
