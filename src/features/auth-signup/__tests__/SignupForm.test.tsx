import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SignupForm } from '@/features/auth-signup/ui/SignupForm';
import { useSignupForm } from '@/features/auth-signup/hooks/useSignupForm';
import {
    useRequestEmailVerification,
    useVerifyEmail,
} from '@/features/auth-email-verification';
import type { RequestEmailVerificationFormState } from '@/shared/lib/auth/formTypes';
import type { VerifyEmailFormState, SignupFormState } from '@/shared/lib/types';

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));
vi.mock('@/features/auth-signup/hooks/useSignupForm');
vi.mock('@/features/auth-email-verification');

const mockUseSignupForm = vi.mocked(useSignupForm);
const mockUseRequestEmailVerification = vi.mocked(useRequestEmailVerification);
const mockUseVerifyEmail = vi.mocked(useVerifyEmail);

const mockEmailFormAction = vi.fn();
const mockCodeFormAction = vi.fn();
const mockSignupFormAction = vi.fn();

function setupPhase(
    emailState: RequestEmailVerificationFormState,
    codeState: VerifyEmailFormState,
    signupState: SignupFormState = { error: null }
) {
    mockUseRequestEmailVerification.mockReturnValue([
        emailState,
        mockEmailFormAction,
        false,
    ]);
    mockUseVerifyEmail.mockReturnValue([codeState, mockCodeFormAction, false]);
    mockUseSignupForm.mockReturnValue([
        signupState,
        mockSignupFormAction,
        false,
    ]);
}

describe('SignupForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Phase 1: email', () => {
        beforeEach(() => {
            setupPhase(
                { submitted: false, error: null },
                { verified: false, error: null }
            );
        });

        it('renders step indicator for phase 1', () => {
            render(<SignupForm />);
            expect(
                screen.getByText('1단계: 이메일 인증 요청')
            ).toBeInTheDocument();
        });

        it('renders email input and submit button', () => {
            render(<SignupForm />);
            expect(screen.getByLabelText('이메일')).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: '인증 코드 받기' })
            ).toBeInTheDocument();
        });

        it('shows error alert when email phase has error', () => {
            setupPhase(
                {
                    submitted: false,
                    error: {
                        code: 'invalid_email',
                        message: '유효한 이메일을 입력하세요.',
                    },
                },
                { verified: false, error: null }
            );
            render(<SignupForm />);
            expect(screen.getByRole('alert')).toHaveTextContent(
                '유효한 이메일을 입력하세요.'
            );
        });

        it('allows typing in the email field', async () => {
            const user = userEvent.setup();
            render(<SignupForm />);
            await user.type(
                screen.getByLabelText('이메일'),
                'test@example.com'
            );
            expect(screen.getByLabelText('이메일')).toHaveValue(
                'test@example.com'
            );
        });
    });

    describe('Phase 2: code', () => {
        function setupPhase2WithGuardBypass(
            codeError?: VerifyEmailFormState['error']
        ) {
            let callCount = 0;
            mockUseRequestEmailVerification.mockImplementation(() => {
                callCount++;
                if (callCount <= 1) {
                    return [
                        { submitted: false, error: null },
                        mockEmailFormAction,
                        false,
                    ];
                }
                return [
                    { submitted: true, error: null },
                    mockEmailFormAction,
                    false,
                ];
            });
            mockUseVerifyEmail.mockReturnValue([
                { verified: false, error: codeError ?? null },
                mockCodeFormAction,
                false,
            ]);
            mockUseSignupForm.mockReturnValue([
                { error: null },
                mockSignupFormAction,
                false,
            ]);
        }

        it('renders step indicator for phase 2', () => {
            setupPhase2WithGuardBypass();
            const { rerender } = render(<SignupForm />);
            rerender(<SignupForm />);
            expect(
                screen.getByText('2단계: 인증 코드 확인')
            ).toBeInTheDocument();
        });

        it('renders code input and submit button', () => {
            setupPhase2WithGuardBypass();
            const { rerender } = render(<SignupForm />);
            rerender(<SignupForm />);
            expect(screen.getByLabelText('인증 코드')).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: '코드 확인' })
            ).toBeInTheDocument();
        });

        it('renders email edit button', () => {
            setupPhase2WithGuardBypass();
            const { rerender } = render(<SignupForm />);
            rerender(<SignupForm />);
            expect(
                screen.getByRole('button', { name: '이메일 수정' })
            ).toBeInTheDocument();
        });

        it('shows redis_unavailable error as alert', () => {
            setupPhase2WithGuardBypass({
                code: 'redis_unavailable',
                message: '서비스 오류',
            });
            const { rerender } = render(<SignupForm />);
            rerender(<SignupForm />);
            expect(screen.getByRole('alert')).toHaveTextContent('서비스 오류');
        });
    });

    describe('Phase 3: details', () => {
        /**
         * SignupForm wraps SignupFormFlow with a resetKey that increments when
         * the cache-restore guard fires (useLayoutEffect sees submitted/verified
         * on mount). To reach phase 3, we render SignupFormFlow indirectly by
         * making the hooks return initial state on first mount (so the guard
         * doesn't fire), then update them to phase-3 state after the component
         * settles. Since we can't easily do that with module-level mocks, we
         * test SignupFormFlow's phase-3 behavior by importing it directly.
         *
         * Instead, we simulate a realistic flow: hooks start at phase-1 defaults,
         * then we switch to phase-3. However SignupForm re-mounts on resetKey
         * change, which resets the flow. The simplest approach is to verify
         * phase-3 UI by ensuring the mock starts at initial state (no guard
         * trigger) and then immediately returns phase-3 state on the second call.
         */
        function setupPhase3WithGuardBypass(
            signupState: SignupFormState = { error: null }
        ) {
            // First call returns initial state (mount → no cache guard).
            // All subsequent calls return phase-3 state.
            let callCount = 0;
            mockUseRequestEmailVerification.mockImplementation(() => {
                callCount++;
                if (callCount <= 1) {
                    return [
                        { submitted: false, error: null },
                        mockEmailFormAction,
                        false,
                    ];
                }
                return [
                    { submitted: true, error: null },
                    mockEmailFormAction,
                    false,
                ];
            });
            mockUseVerifyEmail.mockImplementation(() => {
                if (callCount <= 1) {
                    return [
                        { verified: false, error: null },
                        mockCodeFormAction,
                        false,
                    ];
                }
                return [
                    { verified: true, error: null },
                    mockCodeFormAction,
                    false,
                ];
            });
            mockUseSignupForm.mockReturnValue([
                signupState,
                mockSignupFormAction,
                false,
            ]);
        }

        it('renders step indicator for phase 3', () => {
            setupPhase3WithGuardBypass();
            const { rerender } = render(<SignupForm />);
            // Force re-render so subsequent hook calls return phase-3 state
            rerender(<SignupForm />);
            expect(
                screen.getByText('3단계: 비밀번호 및 표시 이름 설정')
            ).toBeInTheDocument();
        });

        it('renders name, password fields, and submit button', () => {
            setupPhase3WithGuardBypass();
            const { rerender } = render(<SignupForm />);
            rerender(<SignupForm />);
            expect(
                screen.getByLabelText('표시 이름 (선택)')
            ).toBeInTheDocument();
            expect(screen.getByLabelText('비밀번호')).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: '회원가입' })
            ).toBeInTheDocument();
        });

        it('shows form-level error alert', () => {
            setupPhase3WithGuardBypass({
                error: {
                    code: 'service_unavailable',
                    message: '서비스 이용 불가',
                },
            });
            const { rerender } = render(<SignupForm />);
            rerender(<SignupForm />);
            expect(screen.getByRole('alert')).toHaveTextContent(
                '서비스 이용 불가'
            );
        });

        it('renders hidden next input when next prop is provided', () => {
            setupPhase3WithGuardBypass();
            const { rerender } = render(<SignupForm next="/premium" />);
            rerender(<SignupForm next="/premium" />);
            const hidden = document.querySelector(
                'input[type="hidden"][name="next"]'
            ) as HTMLInputElement;
            expect(hidden).not.toBeNull();
            expect(hidden.value).toBe('/premium');
        });

        // Branch coverage: signupEmailError truthy → email error alert shown
        it('shows email field error alert when signup error has field=email', () => {
            setupPhase3WithGuardBypass({
                error: {
                    code: 'email_already_exists',
                    field: 'email',
                    message: '이미 사용 중인 이메일입니다.',
                },
            });
            const { rerender } = render(<SignupForm />);
            rerender(<SignupForm />);
            expect(screen.getByRole('alert')).toHaveTextContent(
                '이미 사용 중인 이메일입니다.'
            );
        });

        // Branch coverage: signupPasswordError truthy
        it('shows password field error in PasswordField when signup error has field=password', () => {
            setupPhase3WithGuardBypass({
                error: {
                    code: 'weak_password',
                    field: 'password',
                    message: '비밀번호가 너무 약합니다.',
                },
            });
            const { rerender } = render(<SignupForm />);
            rerender(<SignupForm />);
            // The error is passed to PasswordField which renders it inline
            expect(
                screen.getByText('비밀번호가 너무 약합니다.')
            ).toBeInTheDocument();
        });

        // Branch coverage: consentErrorMessage truthy → consent error propagated
        it('shows consent error when signup error code is consent_required', () => {
            setupPhase3WithGuardBypass({
                error: {
                    code: 'consent_required',
                    message: '약관에 동의해 주세요.',
                },
            });
            const { rerender } = render(<SignupForm />);
            rerender(<SignupForm />);
            expect(
                screen.getByText('약관에 동의해 주세요.')
            ).toBeInTheDocument();
        });

        // Branch coverage: privacyChecked=true → agreed_privacy hidden input value 'true'
        it('updates agreed_privacy hidden input when privacy checkbox is clicked in phase 3', async () => {
            setupPhase3WithGuardBypass();
            const user = userEvent.setup();
            const { rerender, container } = render(<SignupForm />);
            rerender(<SignupForm />);
            const privacyCheckbox =
                screen.getByLabelText(/개인정보 수집·이용 동의/);
            await user.click(privacyCheckbox);
            const hiddenInput = container.querySelector(
                'input[name="agreed_privacy"]'
            ) as HTMLInputElement;
            expect(hiddenInput.value).toBe('true');
        });

        // Branch coverage: tosChecked=true → agreed_tos hidden input value 'true'
        it('updates agreed_tos hidden input when tos checkbox is clicked in phase 3', async () => {
            setupPhase3WithGuardBypass();
            const user = userEvent.setup();
            const { rerender, container } = render(<SignupForm />);
            rerender(<SignupForm />);
            const tosCheckbox = screen.getByLabelText(/서비스 이용약관 동의/);
            await user.click(tosCheckbox);
            const hiddenInput = container.querySelector(
                'input[name="agreed_tos"]'
            ) as HTMLInputElement;
            expect(hiddenInput.value).toBe('true');
        });

        // Function coverage: fn 14 — onChange handler for the name field
        it('allows typing in the name field in phase 3', async () => {
            setupPhase3WithGuardBypass();
            const user = userEvent.setup();
            const { rerender } = render(<SignupForm />);
            rerender(<SignupForm />);
            const nameInput = screen.getByLabelText('표시 이름 (선택)');
            await user.clear(nameInput);
            await user.type(nameInput, 'Test User');
            expect(nameInput).toHaveValue('Test User');
        });
    });

    // Branch coverage: restoredFromCacheRef.current === true → onRestart() called from useLayoutEffect
    describe('cache-restore guard', () => {
        it('resets to phase 1 (increments resetKey) when component mounts with submitted=true', () => {
            // Mounting with submitted=true triggers the cache-restore guard in
            // SignupFormFlow's useLayoutEffect, which calls onRestart() →
            // handleRestart() → setResetKey(c => c + 1). After remount, the
            // hooks return initial state (submitted=false), so phase 1 is shown.
            let callCount = 0;
            mockUseRequestEmailVerification.mockImplementation(() => {
                callCount++;
                // First mount returns submitted=true → guard fires, increments resetKey
                if (callCount <= 1) {
                    return [
                        { submitted: true, error: null },
                        mockEmailFormAction,
                        false,
                    ];
                }
                // After reset, returns initial state
                return [
                    { submitted: false, error: null },
                    mockEmailFormAction,
                    false,
                ];
            });
            mockUseVerifyEmail.mockReturnValue([
                { verified: false, error: null },
                mockCodeFormAction,
                false,
            ]);
            mockUseSignupForm.mockReturnValue([
                { error: null },
                mockSignupFormAction,
                false,
            ]);

            render(<SignupForm />);
            // After the layout effect fires and resets the key, the component
            // shows phase 1 (email step).
            expect(
                screen.getByText('1단계: 이메일 인증 요청')
            ).toBeInTheDocument();
        });
    });

    // Function coverage: fn 4 (handleRestart), fn 5 (setResetKey updater),
    // fn 7 (handlePageShow), and branch 2 (if event.persisted)
    describe('SignupForm event handlers', () => {
        beforeEach(() => {
            setupPhase(
                { submitted: false, error: null },
                { verified: false, error: null }
            );
        });

        // 가시 phase 전환으로는 검증할 수 없다(훅이 mock이라 remount 후에도 같은 state를
        // 돌려줌). 대신 reset의 실제 메커니즘 — handleRestart → setResetKey → SignupFormFlow
        // remount(key 변경) → 훅 재호출 — 을 호출 횟수 증가로 검증한다. reset이 동작하지
        // 않으면 remount가 없어 호출 횟수가 그대로라 테스트가 실패한다(falsifiable).
        it('popstate 발생 시 SignupFormFlow를 remount해 리셋한다', () => {
            render(<SignupForm />);
            const before = mockUseRequestEmailVerification.mock.calls.length;

            act(() => {
                window.dispatchEvent(new PopStateEvent('popstate'));
            });

            expect(
                mockUseRequestEmailVerification.mock.calls.length
            ).toBeGreaterThan(before);
        });

        it('pageshow persisted=true 발생 시 remount해 리셋한다', () => {
            render(<SignupForm />);
            const before = mockUseRequestEmailVerification.mock.calls.length;

            act(() => {
                window.dispatchEvent(
                    new PageTransitionEvent('pageshow', { persisted: true })
                );
            });

            expect(
                mockUseRequestEmailVerification.mock.calls.length
            ).toBeGreaterThan(before);
        });

        it('pageshow persisted=false 발생 시 리셋하지 않는다 (remount 없음 → 호출 횟수 불변)', () => {
            render(<SignupForm />);
            const before = mockUseRequestEmailVerification.mock.calls.length;

            act(() => {
                window.dispatchEvent(
                    new PageTransitionEvent('pageshow', { persisted: false })
                );
            });

            expect(mockUseRequestEmailVerification.mock.calls.length).toBe(
                before
            );
        });
    });
});
