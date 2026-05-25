import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContactForm } from '@/features/contact-form/ui/ContactForm';
import type { UseQueryResult } from '@tanstack/react-query';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));

let contactState = {
    submitted: false,
    error: null as unknown,
    values: { title: '', email: '', content: '' },
};

const mockFormAction = vi.fn();

vi.mock('@/features/contact-form/hooks/useContactForm', () => ({
    useContactForm: () => [contactState, mockFormAction],
}));

vi.mock('@/entities/session', () => ({
    useCurrentUser: () =>
        ({
            data: null,
            isPending: false,
        }) as Partial<UseQueryResult>,
}));

vi.mock('@/entities/inquiry', () => ({
    CONTACT_TITLE_MAX_LENGTH: 100,
    CONTACT_CONTENT_MAX_LENGTH: 5000,
}));

describe('Contact Form Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        contactState = {
            submitted: false,
            error: null,
            values: { title: '', email: '', content: '' },
        };
    });

    it('renders all contact form fields', () => {
        render(<ContactForm />);
        expect(screen.getByLabelText('제목')).toBeInTheDocument();
        expect(screen.getByLabelText('이메일')).toBeInTheDocument();
        expect(screen.getByLabelText('문의 내용')).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: '문의 보내기' })
        ).toBeInTheDocument();
    });

    it('allows filling in all fields', async () => {
        render(<ContactForm />);
        const user = userEvent.setup();
        await user.type(screen.getByLabelText('제목'), '버그 신고');
        await user.type(screen.getByLabelText('이메일'), 'test@test.com');
        await user.type(
            screen.getByLabelText('문의 내용'),
            '차트가 로딩되지 않습니다'
        );
        expect(screen.getByLabelText('제목')).toHaveValue('버그 신고');
        expect(screen.getByLabelText('이메일')).toHaveValue('test@test.com');
    });

    it('shows submission success notice', () => {
        contactState = {
            submitted: true,
            error: null,
            values: { title: '', email: '', content: '' },
        };
        render(<ContactForm />);
        expect(screen.queryByLabelText('제목')).not.toBeInTheDocument();
    });

    it('shows submission error when server returns an error', () => {
        contactState = {
            submitted: false,
            error: { code: 'submission_failed' },
            values: { title: 'test', email: 'test@test.com', content: 'body' },
        };
        render(<ContactForm />);
        expect(screen.getByRole('alert')).toBeInTheDocument();
    });
});
