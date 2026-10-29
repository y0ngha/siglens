import type {
    RequestEmailVerificationFormState,
    SignupFormState,
    VerifyEmailFormState,
} from '@/shared/lib/auth/formTypes';

type EmailStepErrorCode = NonNullable<
    RequestEmailVerificationFormState['error']
>['code'];
type CodeStepErrorCode = NonNullable<VerifyEmailFormState['error']>['code'];
type DetailsStepError = NonNullable<SignupFormState['error']>;

/**
 * 오류를 띄울 자리. `field`는 해당 입력 아래(`aria-invalid` + `aria-describedby`),
 * `banner`는 폼 상단 `ErrorAlert` — 입력값 탓이 아닌 실패(서비스 장애, 이미 가입된
 * 이메일)를 입력 오류로 표시하면 맞는 값을 고치라고 안내하게 된다.
 */
type StepErrorSlot = 'field' | 'banner';

const EMAIL_STEP_SLOT: Record<EmailStepErrorCode, StepErrorSlot> = {
    invalid_email: 'field',
    redis_unavailable: 'banner',
    unexpected: 'banner',
};

const CODE_STEP_SLOT: Record<CodeStepErrorCode, StepErrorSlot> = {
    invalid_verification_code: 'field',
    expired_verification_code: 'field',
    email_already_exists: 'banner',
    redis_unavailable: 'banner',
    unexpected: 'banner',
};

/** 1단계(이메일 인증 요청) 오류의 자리. 형식 오류만 이메일 입력에 붙는다. */
export function emailStepErrorSlot(code: EmailStepErrorCode): StepErrorSlot {
    return EMAIL_STEP_SLOT[code];
}

/** 2단계(인증 코드 확인) 오류의 자리. 코드가 틀렸거나 만료된 경우만 코드 입력에 붙는다. */
export function codeStepErrorSlot(code: CodeStepErrorCode): StepErrorSlot {
    return CODE_STEP_SLOT[code];
}

/**
 * 3단계(가입) 오류의 자리. 이 단계에는 이메일 입력이 없으므로 `field: 'email'`
 * 오류도 배너로 간다.
 */
export function detailsStepErrorSlot(
    error: DetailsStepError
): 'password' | 'consent' | 'banner' {
    if (error.code === 'consent_required') return 'consent';
    if (error.field === 'password') return 'password';
    return 'banner';
}
