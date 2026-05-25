import { render, screen } from '@testing-library/react';
import { PasswordStrengthHint } from '@/shared/ui/auth/PasswordStrengthHint';

describe('PasswordStrengthHint', () => {
    it('renders all three rules', () => {
        render(<PasswordStrengthHint password="" />);
        expect(screen.getByText(/자 이상/)).toBeInTheDocument();
        expect(screen.getByText('영어 포함')).toBeInTheDocument();
        expect(screen.getByText('숫자 포함')).toBeInTheDocument();
    });

    it('marks length rule as passing when password is long enough', () => {
        const { container } = render(
            <PasswordStrengthHint password="abcdefgh1" />
        );
        const items = container.querySelectorAll('li');
        // First item is the length rule
        expect(items[0]).toHaveTextContent('✓');
    });

    it('marks letter rule as passing when password has a letter', () => {
        const { container } = render(<PasswordStrengthHint password="a" />);
        const items = container.querySelectorAll('li');
        // Second item is the letter rule
        expect(items[1]).toHaveTextContent('✓');
    });

    it('marks number rule as passing when password has a digit', () => {
        const { container } = render(<PasswordStrengthHint password="1" />);
        const items = container.querySelectorAll('li');
        // Third item is the number rule
        expect(items[2]).toHaveTextContent('✓');
    });

    it('shows all rules as not passing for empty password', () => {
        const { container } = render(<PasswordStrengthHint password="" />);
        const items = container.querySelectorAll('li');
        for (const item of items) {
            expect(item).toHaveTextContent('○');
        }
    });

    it('shows all rules as passing for a strong password', () => {
        const { container } = render(
            <PasswordStrengthHint password="abc12345" />
        );
        const items = container.querySelectorAll('li');
        for (const item of items) {
            expect(item).toHaveTextContent('✓');
        }
    });

    it('sets id from descriptionId prop', () => {
        const { container } = render(
            <PasswordStrengthHint password="" descriptionId="pw-hint" />
        );
        expect(container.querySelector('#pw-hint')).toBeInTheDocument();
    });
});
