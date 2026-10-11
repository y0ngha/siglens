import { render } from '@testing-library/react';
import { Sparkline, sparklinePoints } from '@/features/watchlist/ui/Sparkline';

describe('sparklinePoints', () => {
    it('첫 점은 왼쪽 끝, 마지막 점은 오른쪽 끝이고 큰 값일수록 위에 있다', () => {
        const points = sparklinePoints([1, 3]).split(' ');
        expect(points).toEqual(['0.0,22.0', '64.0,2.0']);
    });

    it('값이 모두 같으면 가운데 수평선', () => {
        expect(sparklinePoints([5, 5, 5])).toBe('0.0,12.0 32.0,12.0 64.0,12.0');
    });
});

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
