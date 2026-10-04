import { render, screen } from '@testing-library/react';
import { ReadoutRow } from '@/widgets/portfolio-position/ui/ReadoutRow';

describe('ReadoutRow', () => {
    it('라벨을 dt, 값을 dd로 렌더하고 값 클래스를 덧붙인다', () => {
        render(
            <dl>
                <ReadoutRow
                    label="수익률"
                    value="+12.3%"
                    valueClassName="text-ui-success-text"
                />
            </dl>
        );
        expect(screen.getByText('수익률').tagName).toBe('DT');
        const value = screen.getByText('+12.3%');
        expect(value.tagName).toBe('DD');
        expect(value).toHaveClass('tabular-nums', 'text-ui-success-text');
    });
});
