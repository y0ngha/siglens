import { render, screen } from '@testing-library/react';
import { FooterSocialLink } from '../../../ui/footer/FooterSocialLink';

describe('FooterSocialLink', () => {
    it('새 탭으로 열고 opener를 끊는다', () => {
        render(
            <FooterSocialLink href="https://example.com" label="예시 계정">
                <svg />
            </FooterSocialLink>
        );

        const link = screen.getByRole('link', { name: '예시 계정' });
        expect(link).toHaveAttribute('href', 'https://example.com');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('아이콘만 있는 링크라 label이 접근 가능한 이름이다', () => {
        render(
            <FooterSocialLink href="https://example.com" label="예시 계정">
                <svg />
            </FooterSocialLink>
        );

        expect(screen.getByRole('link')).toHaveAccessibleName('예시 계정');
    });
});
