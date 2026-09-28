import { render, screen, fireEvent } from '@testing-library/react';
import { ContactForm } from '@/features/contact-form/ui/ContactForm';
import { useContactForm } from '@/features/contact-form/hooks/useContactForm';
import { useCurrentUser } from '@/entities/auth/hooks/useCurrentUser';
import type { ContactFormState } from '@/shared/lib/types';
import type { UseQueryResult } from '@tanstack/react-query';
import type { AuthUserRecord } from '@/shared/lib/auth/types';

// Block transitive imports that pull in the Neon serverless client (which
// requires Web APIs not available in the jsdom test environment).
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));
vi.mock('@/features/contact-form/hooks/useContactForm');
vi.mock('@/entities/auth/hooks/useCurrentUser');

const mockUseContactForm = vi.mocked(useContactForm);
const mockUseCurrentUser = vi.mocked(useCurrentUser);

const IDLE_STATE: ContactFormState = {
    submitted: false,
    error: null,
    values: { title: '', email: '', content: '' },
};

function setContactFormState(state: ContactFormState) {
    mockUseContactForm.mockReturnValue([state, vi.fn(), false]);
}

type CurrentUserResult = UseQueryResult<AuthUserRecord | null>;

function pendingCurrentUser(): CurrentUserResult {
    return {
        data: undefined,
        isPending: true,
        isLoading: true,
        isFetching: true,
        isSuccess: false,
        isError: false,
        status: 'pending',
    } as unknown as CurrentUserResult;
}

function resolvedCurrentUser(
    user: AuthUserRecord | null = null
): CurrentUserResult {
    return {
        data: user,
        isPending: false,
        isLoading: false,
        isFetching: false,
        isSuccess: true,
        isError: false,
        status: 'success',
    } as unknown as CurrentUserResult;
}

describe('ContactForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setContactFormState(IDLE_STATE);
    });

    it('currentUser 쿼리가 pending 인 동안에는 이메일 입력 대신 스켈레톤을 렌더한다', () => {
        mockUseCurrentUser.mockReturnValue(pendingCurrentUser());
        render(<ContactForm />);

        expect(screen.queryByLabelText('이메일')).not.toBeInTheDocument();
        // Skeleton container is marked aria-busy
        const skeletonContainer = document.querySelector('[aria-busy="true"]');
        expect(skeletonContainer).not.toBeNull();
    });

    it('currentUser 쿼리가 resolve 되면 로그인된 이메일이 defaultValue 로 채워진다', () => {
        mockUseCurrentUser.mockReturnValue(
            resolvedCurrentUser({
                id: 'u-1',
                email: 'me@example.com',
            } as unknown as AuthUserRecord)
        );
        render(<ContactForm />);

        const emailInput = screen.getByLabelText('이메일') as HTMLInputElement;
        expect(emailInput).toBeInTheDocument();
        expect(emailInput.defaultValue).toBe('me@example.com');
    });

    it('비로그인 사용자(currentUser=null)에서는 이메일 defaultValue 가 빈 문자열이다', () => {
        mockUseCurrentUser.mockReturnValue(resolvedCurrentUser(null));
        render(<ContactForm />);

        const emailInput = screen.getByLabelText('이메일') as HTMLInputElement;
        expect(emailInput.defaultValue).toBe('');
    });

    it('쿼리 resolve 전후로 사용자가 입력한 다른 필드(title)가 보존된다', () => {
        mockUseCurrentUser.mockReturnValue(pendingCurrentUser());
        const { rerender } = render(<ContactForm />);

        // User types in the title before currentUser query resolves.
        const titleInput = screen.getByLabelText('제목') as HTMLInputElement;
        fireEvent.change(titleInput, { target: { value: '내가 입력한 제목' } });
        expect(titleInput.value).toBe('내가 입력한 제목');

        // currentUser query resolves; ContactForm re-renders.
        mockUseCurrentUser.mockReturnValue(
            resolvedCurrentUser({
                id: 'u-1',
                email: 'me@example.com',
            } as unknown as AuthUserRecord)
        );
        rerender(<ContactForm />);

        // Title input must NOT have been remounted — user input preserved.
        const titleAfter = screen.getByLabelText('제목') as HTMLInputElement;
        expect(titleAfter.value).toBe('내가 입력한 제목');
        // Email input now mounted with logged-in default.
        const emailInput = screen.getByLabelText('이메일') as HTMLInputElement;
        expect(emailInput.defaultValue).toBe('me@example.com');
    });

    it('제출 후 상태(submitted=true)에서는 성공 안내가 노출된다', () => {
        mockUseCurrentUser.mockReturnValue(resolvedCurrentUser(null));
        setContactFormState({
            submitted: true,
            error: null,
            values: IDLE_STATE.values,
        });
        render(<ContactForm />);

        expect(screen.getByText('문의가 접수되었습니다')).toBeInTheDocument();
    });

    /**
     * 회귀: 성공 시 조기 return으로 성공 안내만 반환하면 (1) 포커스를 쥐고 있던 제출
     * 버튼이 언마운트돼 포커스가 `<body>`로 떨어지고 (2) `aria-live` 영역이 내용과
     * 같은 순간에 삽입돼 읽히지 않는다. ForgotPasswordForm과 같은 패턴을 따른다.
     */
    it('라이브 영역은 제출 전부터 존재하고, 성공 시 같은 영역에 안내가 채워진다', () => {
        mockUseCurrentUser.mockReturnValue(resolvedCurrentUser(null));
        const { rerender } = render(<ContactForm />);
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveAttribute('aria-live', 'polite');
        expect(liveRegion).toBeEmptyDOMElement();

        setContactFormState({
            submitted: true,
            error: null,
            values: IDLE_STATE.values,
        });
        rerender(<ContactForm />);

        expect(screen.getByRole('status')).toBe(liveRegion);
        expect(liveRegion).toHaveTextContent('문의가 접수되었습니다');
    });

    it('성공 시 포커스를 성공 안내로 옮긴다', () => {
        mockUseCurrentUser.mockReturnValue(resolvedCurrentUser(null));
        const { rerender } = render(<ContactForm />);
        screen.getByRole('button', { name: '문의 보내기' }).focus();

        setContactFormState({
            submitted: true,
            error: null,
            values: IDLE_STATE.values,
        });
        rerender(<ContactForm />);

        const panel = screen
            .getByText('문의가 접수되었습니다')
            .closest('[tabindex="-1"]');
        expect(panel).not.toBeNull();
        expect(document.activeElement).toBe(panel);
    });

    it('submission_failed 에러는 폼 상단의 alert 로 노출된다', () => {
        mockUseCurrentUser.mockReturnValue(resolvedCurrentUser(null));
        setContactFormState({
            submitted: false,
            error: { code: 'submission_failed' },
            values: { title: 't', email: 'e@x.io', content: 'c' },
        });
        render(<ContactForm />);

        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent(
            '문의 전송에 실패했습니다. 잠시 후 다시 시도해 주세요.'
        );
    });
});
