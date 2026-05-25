import { render, screen } from '@testing-library/react';
import { ContactSubmittedNotice } from '@/features/contact-form/ui/ContactSubmittedNotice';

describe('ContactSubmittedNotice', () => {
    it('renders status region', () => {
        render(<ContactSubmittedNotice />);
        expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('renders submitted title', () => {
        render(<ContactSubmittedNotice />);
        expect(screen.getByText('문의가 접수되었습니다')).toBeInTheDocument();
    });

    it('renders reply message', () => {
        render(<ContactSubmittedNotice />);
        expect(
            screen.getByText('확인 후 입력하신 이메일로 답변드리겠습니다.')
        ).toBeInTheDocument();
    });

    it('renders wait message', () => {
        render(<ContactSubmittedNotice />);
        expect(screen.getByText('잠시만 기다려 주세요.')).toBeInTheDocument();
    });

    it('has aria-live polite', () => {
        render(<ContactSubmittedNotice />);
        expect(screen.getByRole('status')).toHaveAttribute(
            'aria-live',
            'polite'
        );
    });
});
