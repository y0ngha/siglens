import { render, screen } from '@testing-library/react';
import { SharePreparingStatus } from '../../ui/modal/SharePreparingStatus';

describe('SharePreparingStatus', () => {
    describe('pending phase', () => {
        it('renders the progress text and the timing hint', () => {
            const { container } = render(
                <SharePreparingStatus phase="pending" />
            );
            expect(container).toHaveTextContent(
                'AI가 분석 결과를 준비하고 있어요…보통 10–30초면 끝나요'
            );
        });
    });

    describe('error phase', () => {
        it('renders only the retry prompt', () => {
            const { container } = render(
                <SharePreparingStatus phase="error" />
            );
            expect(container).toHaveTextContent(
                /^분석을 끝내지 못했어요\. 다시 시도할까요\?$/
            );
        });

        it('does not render the timing hint', () => {
            render(<SharePreparingStatus phase="error" />);
            expect(
                screen.queryByText('보통 10–30초면 끝나요')
            ).not.toBeInTheDocument();
        });
    });
});
