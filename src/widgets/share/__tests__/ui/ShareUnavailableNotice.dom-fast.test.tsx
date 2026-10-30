import { render, screen } from '@testing-library/react';
import { ShareUnavailableNotice } from '../../ui/button/ShareUnavailableNotice';

describe('ShareUnavailableNotice', () => {
    it('keeps an empty status region mounted while hidden', () => {
        render(<ShareUnavailableNotice id="notice" visible={false} />);
        expect(screen.getByRole('status')).toBeEmptyDOMElement();
    });

    it('renders the notice text inside the status region when visible', () => {
        render(<ShareUnavailableNotice id="notice" visible />);
        expect(screen.getByRole('status')).toHaveTextContent(
            '이 탭은 공유할 분석이 아직 없어요'
        );
    });

    it('puts the id on the status region for aria-describedby', () => {
        render(<ShareUnavailableNotice id="notice" visible />);
        expect(screen.getByRole('status')).toHaveAttribute('id', 'notice');
    });
});
