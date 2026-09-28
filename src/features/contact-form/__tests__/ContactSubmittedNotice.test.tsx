import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { ContactSubmittedNotice } from '@/features/contact-form/ui/ContactSubmittedNotice';

describe('ContactSubmittedNotice', () => {
    // 라이브 영역은 부모(ContactForm)가 제출 전부터 소유한다 — 패널이 마운트와
    // 동시에 라이브 영역이 되면 보조기술이 읽지 않는다.
    it('does not own a live region itself', () => {
        render(<ContactSubmittedNotice />);
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
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

    it('is programmatically focusable and forwards ref', () => {
        const ref = createRef<HTMLDivElement>();
        render(<ContactSubmittedNotice ref={ref} />);
        expect(ref.current).toHaveAttribute('tabindex', '-1');
        ref.current?.focus();
        expect(document.activeElement).toBe(ref.current);
    });
});
