import { render, screen } from '@testing-library/react';
import { FooterDisclaimer } from '../../../ui/footer/FooterDisclaimer';

describe('FooterDisclaimer', () => {
    it('이름 붙은 note 역할로 고지 문구를 그린다', () => {
        render(
            <FooterDisclaimer label="투자 면책 고지">
                고지 본문
            </FooterDisclaimer>
        );

        const note = screen.getByRole('note', { name: '투자 면책 고지' });
        expect(note).toHaveTextContent('고지 본문');
        expect(note.tagName).toBe('DIV');
    });
});
