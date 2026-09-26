import { render, screen } from '@testing-library/react';
import AiNotFound from '../not-found';
import { koMessage } from '@/shared/test-utils/koMessage';

describe('AiNotFound', () => {
    it('404 안내 문구를 보여준다', () => {
        render(<AiNotFound />);

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
            koMessage('app.ai.not-found.047c35')
        );
    });

    it('홈으로 돌아가는 링크를 보여준다', () => {
        render(<AiNotFound />);

        const link = screen.getByRole('link', {
            name: koMessage('app.ai.not-found.04598e'),
        });
        expect(link).toHaveAttribute('href', '/');
    });
});
