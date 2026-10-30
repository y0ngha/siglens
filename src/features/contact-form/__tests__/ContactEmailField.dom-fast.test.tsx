import { render, screen } from '@testing-library/react';
import { ContactEmailField } from '@/features/contact-form/ui/ContactEmailField';

/** ko 로케일의 이메일 칸 라벨(`ContactForm.3c3776`). */
const EMAIL_LABEL = '이메일';

describe('ContactEmailField', () => {
    it('renders the skeleton instead of the input while the current user is pending', () => {
        const { container } = render(
            <ContactEmailField isPending defaultValue="user@example.com" />
        );
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(screen.getByText(EMAIL_LABEL)).toBeInTheDocument();
        expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    });

    it('mounts the input with the resolved defaultValue once settled', () => {
        render(
            <ContactEmailField
                isPending={false}
                defaultValue="user@example.com"
            />
        );
        const input = screen.getByLabelText(EMAIL_LABEL);
        expect(input).toHaveAttribute('type', 'email');
        expect(input).toHaveAttribute('name', 'email');
        expect(input).toHaveValue('user@example.com');
    });

    it('mounts the input with the resolved defaultValue when pending settles', () => {
        const { container, rerender } = render(
            <ContactEmailField isPending defaultValue="" />
        );
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

        rerender(
            <ContactEmailField
                isPending={false}
                defaultValue="user@example.com"
            />
        );
        expect(container.querySelector('[aria-busy="true"]')).toBeNull();
        expect(screen.getByLabelText(EMAIL_LABEL)).toHaveValue(
            'user@example.com'
        );
    });

    it('shows the field error on the settled input', () => {
        render(
            <ContactEmailField
                isPending={false}
                defaultValue=""
                error="이메일을 입력하세요"
            />
        );
        expect(screen.getByLabelText(EMAIL_LABEL)).toHaveAttribute(
            'aria-invalid',
            'true'
        );
        expect(screen.getByRole('alert')).toHaveTextContent(
            '이메일을 입력하세요'
        );
    });
});
