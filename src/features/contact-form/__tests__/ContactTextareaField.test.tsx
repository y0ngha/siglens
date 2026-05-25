import { render, screen } from '@testing-library/react';
import { ContactTextareaField } from '@/features/contact-form/ui/ContactTextareaField';

describe('ContactTextareaField', () => {
    const defaultProps = {
        id: 'test-textarea',
        name: 'content',
        label: '내용',
        maxLength: 1000,
    };

    it('renders label and textarea', () => {
        render(<ContactTextareaField {...defaultProps} />);
        expect(screen.getByLabelText('내용')).toBeInTheDocument();
        expect(screen.getByLabelText('내용').tagName).toBe('TEXTAREA');
    });

    it('renders max length helper text', () => {
        render(<ContactTextareaField {...defaultProps} />);
        expect(screen.getByText('최대 1,000자')).toBeInTheDocument();
    });

    it('does not show error when error prop is absent', () => {
        render(<ContactTextareaField {...defaultProps} />);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows error alert when error prop is provided', () => {
        render(
            <ContactTextareaField {...defaultProps} error="내용을 입력하세요" />
        );
        expect(screen.getByRole('alert')).toHaveTextContent(
            '내용을 입력하세요'
        );
    });

    it('sets aria-invalid when error prop is provided', () => {
        render(<ContactTextareaField {...defaultProps} error="에러 메시지" />);
        expect(screen.getByLabelText('내용')).toHaveAttribute(
            'aria-invalid',
            'true'
        );
    });

    it('sets aria-invalid to false when no error', () => {
        render(<ContactTextareaField {...defaultProps} />);
        expect(screen.getByLabelText('내용')).toHaveAttribute(
            'aria-invalid',
            'false'
        );
    });

    it('renders with custom rows', () => {
        render(<ContactTextareaField {...defaultProps} rows={10} />);
        expect(screen.getByLabelText('내용')).toHaveAttribute('rows', '10');
    });

    it('renders with placeholder', () => {
        render(
            <ContactTextareaField
                {...defaultProps}
                placeholder="내용을 입력해 주세요"
            />
        );
        expect(
            screen.getByPlaceholderText('내용을 입력해 주세요')
        ).toBeInTheDocument();
    });

    it('uses default rows of 6', () => {
        render(<ContactTextareaField {...defaultProps} />);
        expect(screen.getByLabelText('내용')).toHaveAttribute('rows', '6');
    });
});
