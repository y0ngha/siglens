import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OAuthConsentForm } from '@/features/auth-oauth-consent/ui/OAuthConsentForm';
import { useFinalizeOAuthSignup } from '@/features/auth-oauth-consent/hooks/useFinalizeOAuthSignup';
import type { FinalizeOAuthSignupState } from '@/shared/lib/types';

vi.mock(
    '@/features/auth-oauth-consent/actions/finalizeOAuthSignupAction',
    () => ({
        finalizeOAuthSignupAction: vi.fn(),
    })
);

vi.mock('@/features/auth-oauth-consent/hooks/useFinalizeOAuthSignup');

vi.mock('@/shared/hooks/usePageShowReload', () => ({
    usePageShowReload: vi.fn(),
}));

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
    });

    it('renders profile email and name', () => {
        render(<OAuthConsentForm {...baseProps} />);
        expect(screen.getByText('new@example.com')).toBeInTheDocument();
        expect(screen.getByText('Hong Gildong')).toBeInTheDocument();
    });

    it('renders ConsentCheckboxGroup with master and individual checkboxes', () => {
        render(<OAuthConsentForm {...baseProps} />);
        expect(screen.getByLabelText('모두 동의')).toBeInTheDocument();
        expect(
            screen.getByLabelText(/개인정보 수집·이용 동의/)
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

    it('renders 가입 완료 and 취소 buttons', () => {
        render(<OAuthConsentForm {...baseProps} />);
        expect(
            screen.getByRole('button', { name: /가입 완료/ })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /취소/ })
        ).toBeInTheDocument();
    });

    // Branch coverage: avatarUrl provided → renders <Image> instead of placeholder div
    it('renders avatar image when avatarUrl is provided', () => {
        const { container } = render(
            <OAuthConsentForm
                {...baseProps}
                avatarUrl="https://example.com/avatar.png"
            />
        );
        // next/image renders an <img> with alt="" (presentational), so query via tag
        const img = container.querySelector('img');
        expect(img).not.toBeNull();
        expect(img).toHaveClass('rounded-full');
    });

    // Branch coverage: name omitted → name paragraph not rendered
    it('does not render name paragraph when name prop is absent', () => {
        render(<OAuthConsentForm {...baseProps} name={undefined} />);
        expect(screen.queryByText('Hong Gildong')).toBeNull();
    });

    // Branch coverage: provider without a PROVIDER_LABEL entry → falls back to provider string
    it('falls back to provider string when no label is defined', () => {
        render(
            <OAuthConsentForm
                {...baseProps}
                // cast to SupportedOAuthProvider to satisfy TS; tests the ?? fallback at runtime
                provider={'unknown_provider' as 'google'}
            />
        );
        expect(
            screen.getByText(/unknown_provider 계정으로 가입/)
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
        expect(screen.getByText('약관에 동의해 주세요.')).toBeInTheDocument();
    });

    // Branch coverage: isPending true → button shows '처리 중...' and is disabled
    it('shows 처리 중... and disables submit button when isPending', () => {
        setupHook({}, true);
        render(<OAuthConsentForm {...baseProps} />);
        const btn = screen.getByRole('button', { name: /처리 중/ });
        expect(btn).toBeInTheDocument();
        expect(btn).toBeDisabled();
    });

    // Branch coverage: privacyChecked true → hidden input value becomes 'true'
    it('updates agreed_privacy hidden input when privacy checkbox is clicked', async () => {
        const user = userEvent.setup();
        const { container } = render(<OAuthConsentForm {...baseProps} />);
        const privacyCheckbox =
            screen.getByLabelText(/개인정보 수집·이용 동의/);
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
