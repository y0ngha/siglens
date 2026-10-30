vi.mock('@/features/contact-form/ui/ContactForm', () => ({
    ContactForm: () => <form aria-label="문의 폼" />,
}));

import { fireEvent, render, screen } from '@testing-library/react';
import {
    CONTACT_DIALOG_TITLE_ID,
    ContactDialogContent,
} from '../../../ui/contact/ContactDialogContent';

describe('ContactDialogContent', () => {
    it('제목 요소가 다이얼로그가 가리킬 id를 갖는다', () => {
        render(<ContactDialogContent onClose={vi.fn()} />);

        expect(
            screen.getByRole('heading', { name: '문의하기' })
        ).toHaveAttribute('id', CONTACT_DIALOG_TITLE_ID);
    });

    it('문의 폼을 포함한다', () => {
        render(<ContactDialogContent onClose={vi.fn()} />);

        expect(
            screen.getByRole('form', { name: '문의 폼' })
        ).toBeInTheDocument();
    });

    it('닫기 버튼이 onClose를 부른다', () => {
        const onClose = vi.fn();
        render(<ContactDialogContent onClose={onClose} />);

        fireEvent.click(screen.getByRole('button', { name: '닫기' }));

        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
