import { render, screen } from '@testing-library/react';
import { BriefingThemes } from '@/widgets/dashboard/ui/briefing/BriefingThemes';

describe('BriefingThemes', () => {
    it('테마마다 칩 하나를 그린다', () => {
        render(<BriefingThemes themes={['AI', 'Earnings']} />);
        expect(screen.getByText('AI')).toBeInTheDocument();
        expect(screen.getByText('Earnings')).toBeInTheDocument();
    });

    it('테마가 없으면 아무것도 그리지 않는다', () => {
        const { container } = render(<BriefingThemes themes={[]} />);
        expect(container).toBeEmptyDOMElement();
    });
});
