import { render, screen } from '@testing-library/react';
import { ContactTextField } from '@/features/contact-form/ui/ContactTextField';

describe('ContactTextField', () => {
    const defaultProps = {
        id: 'test-field',
        name: 'email',
        label: '이메일',
        type: 'email' as const,
    };

    it('renders label and input', () => {
        render(<ContactTextField {...defaultProps} />);
        expect(screen.getByLabelText('이메일')).toBeInTheDocument();
        expect(screen.getByLabelText('이메일').tagName).toBe('INPUT');
    });

    it('sets correct input type', () => {
        render(<ContactTextField {...defaultProps} />);
        expect(screen.getByLabelText('이메일')).toHaveAttribute(
            'type',
            'email'
        );
    });

    it('does not show error when error prop is absent', () => {
        render(<ContactTextField {...defaultProps} />);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows error alert when error prop is provided', () => {
        render(
            <ContactTextField {...defaultProps} error="이메일을 입력하세요" />
        );
        expect(screen.getByRole('alert')).toHaveTextContent(
            '이메일을 입력하세요'
        );
    });

    it('sets aria-invalid when error prop is provided', () => {
        render(<ContactTextField {...defaultProps} error="에러" />);
        expect(screen.getByLabelText('이메일')).toHaveAttribute(
            'aria-invalid',
            'true'
        );
    });

    it('sets aria-invalid to false when no error', () => {
        render(<ContactTextField {...defaultProps} />);
        expect(screen.getByLabelText('이메일')).toHaveAttribute(
            'aria-invalid',
            'false'
        );
    });

    it('renders with placeholder', () => {
        render(
            <ContactTextField {...defaultProps} placeholder="you@example.com" />
        );
        expect(
            screen.getByPlaceholderText('you@example.com')
        ).toBeInTheDocument();
    });

    it('renders with defaultValue', () => {
        render(
            <ContactTextField {...defaultProps} defaultValue="pre@filled.com" />
        );
        expect(screen.getByLabelText('이메일')).toHaveValue('pre@filled.com');
    });

    it('renders text type correctly', () => {
        render(
            <ContactTextField
                {...defaultProps}
                id="test-text"
                name="title"
                label="제목"
                type="text"
            />
        );
        expect(screen.getByLabelText('제목')).toHaveAttribute('type', 'text');
    });

    it('sets aria-describedby to error id when error exists', () => {
        render(<ContactTextField {...defaultProps} error="에러" />);
        expect(screen.getByLabelText('이메일')).toHaveAttribute(
            'aria-describedby',
            'test-field-error'
        );
    });

    it('does not set aria-describedby when no error', () => {
        render(<ContactTextField {...defaultProps} />);
        expect(
            screen.getByLabelText('이메일').getAttribute('aria-describedby')
        ).toBeNull();
    });
});
