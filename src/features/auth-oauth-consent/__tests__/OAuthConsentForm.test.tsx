import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OAuthConsentForm } from '@/features/auth-oauth-consent/ui/OAuthConsentForm';
import { useFinalizeOAuthSignup } from '@/features/auth-oauth-consent/hooks/useFinalizeOAuthSignup';
import type { FinalizeOAuthSignupState } from '@/shared/lib/auth/formTypes';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { CONSENT_DECLINED_VALUE } from '@/features/auth-oauth-consent/lib/readConsentForm';

vi.mock(
    '@/features/auth-oauth-consent/actions/finalizeOAuthSignupAction',
    () => ({
        finalizeOAuthSignupAction: vi.fn(),
    })
);

vi.mock('@/features/auth-oauth-consent/hooks/useFinalizeOAuthSignup');

vi.mock('../hooks/usePageShowReload', () => ({
    usePageShowReload: vi.fn(),
}));

const mockUseFormStatus = vi.fn(() => ({ pending: false }));

vi.mock('react-dom', async () => {
    const actual = await vi.importActual('react-dom');
    return { ...actual, useFormStatus: () => mockUseFormStatus() };
});

const mockUseFinalizeOAuthSignup = vi.mocked(useFinalizeOAuthSignup);
const mockFormAction = vi.fn();

function setupHook(
    state: FinalizeOAuthSignupState = {},
    isPending = false
): void {
    mockUseFinalizeOAuthSignup.mockReturnValue([
        state,
        mockFormAction,
        isPending,
    ]);
}

describe('OAuthConsentForm', () => {
    const baseProps = {
        token: 'token-abc',
        provider: 'google' as const,
        email: 'new@example.com',
        name: 'Hong Gildong',
        avatarUrl: undefined,
        cancelAction: vi.fn() as unknown as (
            formData: FormData
        ) => Promise<void>,
    };

    beforeEach(() => {
        setupHook();
        mockUseFormStatus.mockReturnValue({ pending: false });
    });

    it('renders the account card with the profile email and name', () => {
        render(<OAuthConsentForm {...baseProps} />);
        expect(screen.getByText('new@example.com')).toBeInTheDocument();
        expect(screen.getByText('Hong Gildong')).toBeInTheDocument();
    });

    it('renders ConsentCheckboxGroup with master and individual checkboxes', () => {
        render(<OAuthConsentForm {...baseProps} />);
        expect(screen.getByLabelText('모두 동의')).toBeInTheDocument();
        expect(
            screen.getByLabelText(/개인정보 수집 및 이용 동의/)
        ).toBeInTheDocument();
        expect(
            screen.getByLabelText(/서비스 이용약관 동의/)
        ).toBeInTheDocument();
    });

    it('includes hidden token input in finalize form', () => {
        const { container } = render(<OAuthConsentForm {...baseProps} />);
        const tokenInput = container.querySelector(
            'input[name="token"][value="token-abc"]'
        );
        expect(tokenInput).not.toBeNull();
    });

    it('renders the submit and cancel buttons', () => {
        render(<OAuthConsentForm {...baseProps} />);
        expect(
            screen.getByRole('button', { name: /가입 완료/ })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /취소/ })
        ).toBeInTheDocument();
    });

    // Branch coverage: consentError truthy → error message shown in ConsentCheckboxGroup
    it('passes consent error message when finalizeState has consent_required error', () => {
        setupHook({
            error: {
                code: 'consent_required',
                message: '약관에 동의해 주세요.',
            },
        });
        render(<OAuthConsentForm {...baseProps} />);
        // 액션의 한국어 폴백 `message`가 아니라 코드로 번역한 카탈로그 문구를 띄운다.
        expect(
            screen.getByText('개인정보처리방침과 이용약관에 동의해주세요.')
        ).toBeInTheDocument();
        expect(
            screen.queryByText('약관에 동의해 주세요.')
        ).not.toBeInTheDocument();
    });

    /**
     * 회귀: 제출 버튼이 전송 중 `disabled`가 되며 포커스를 잃어, 약관 미동의 오류가
     * 와도 포커스가 빠진 항목과 무관한 곳에 남았다. 동의 안 한 첫 항목으로 옮긴다.
     */
    it('moves focus to the first unticked consent when a consent_required error arrives', () => {
        const { rerender } = render(<OAuthConsentForm {...baseProps} />);
        screen.getByRole('button', { name: /가입 완료/ }).focus();

        setupHook({
            error: {
                code: 'consent_required',
                message: '약관에 동의해 주세요.',
            },
        });
        rerender(<OAuthConsentForm {...baseProps} />);

        expect(document.activeElement).toBe(
            screen.getByLabelText(/개인정보 수집 및 이용 동의/)
        );
    });

    it('shows the consent_required error in the active non-Korean locale', () => {
        setupHook({
            error: {
                code: 'consent_required',
                message: '개인정보처리방침과 이용약관에 동의해주세요.',
            },
        });
        renderWithIntl(<OAuthConsentForm {...baseProps} />, { locale: 'en' });
        expect(
            screen.getByText(
                'Please accept the privacy policy and the terms of service.'
            )
        ).toBeInTheDocument();
        expect(
            screen.queryByText('개인정보처리방침과 이용약관에 동의해주세요.')
        ).not.toBeInTheDocument();
    });

    // 제출 중 상태는 SubmitButton이 감싼 form의 useFormStatus로 읽는다.
    it('shows the pending label and disables the submit button while the form is pending', () => {
        mockUseFormStatus.mockReturnValue({ pending: true });
        render(<OAuthConsentForm {...baseProps} />);
        const btn = screen.getByRole('button', { name: /처리 중/ });
        expect(btn).toBeInTheDocument();
        expect(btn).toHaveAttribute('aria-disabled', 'true');
    });

    it('starts both consent hidden inputs at the declined value', () => {
        const { container } = render(<OAuthConsentForm {...baseProps} />);
        for (const name of ['agreed_privacy', 'agreed_tos']) {
            const hiddenInput = container.querySelector(
                `input[name="${name}"]`
            ) as HTMLInputElement;
            expect(hiddenInput.value).toBe(CONSENT_DECLINED_VALUE);
        }
    });

    // Branch coverage: privacyChecked true → hidden input value becomes 'true'
    it('updates agreed_privacy hidden input when privacy checkbox is clicked', async () => {
        const user = userEvent.setup();
        const { container } = render(<OAuthConsentForm {...baseProps} />);
        const privacyCheckbox = screen.getByLabelText(
            /개인정보 수집 및 이용 동의/
        );
        await user.click(privacyCheckbox);
        const hiddenInput = container.querySelector(
            'input[name="agreed_privacy"]'
        ) as HTMLInputElement;
        expect(hiddenInput.value).toBe('true');
    });

    // Branch coverage: tosChecked true → hidden input value becomes 'true'
    it('updates agreed_tos hidden input when tos checkbox is clicked', async () => {
        const user = userEvent.setup();
        const { container } = render(<OAuthConsentForm {...baseProps} />);
        const tosCheckbox = screen.getByLabelText(/서비스 이용약관 동의/);
        await user.click(tosCheckbox);
        const hiddenInput = container.querySelector(
            'input[name="agreed_tos"]'
        ) as HTMLInputElement;
        expect(hiddenInput.value).toBe('true');
    });
});
