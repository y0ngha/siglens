import type {
    RequestEmailVerificationFormState,
    SignupFormState,
    VerifyEmailFormState,
} from '@/shared/lib/auth/formTypes';
import {
    codeStepErrorSlot,
    detailsStepErrorSlot,
    emailStepErrorSlot,
} from './signupErrorSlot';
import { SIGNUP_FIELD_ID, type SignupPhase } from './signupPhase';

type EmailStepError = NonNullable<RequestEmailVerificationFormState['error']>;
type CodeStepError = NonNullable<VerifyEmailFormState['error']>;
type DetailsStepError = NonNullable<SignupFormState['error']>;

/** 회원가입 세 Server Action 중 하나가 돌려준 오류. */
export type SignupStepError = EmailStepError | CodeStepError | DetailsStepError;

/** 단계별 Server Action의 현재 오류. */
export interface SignupStepErrors {
    email: EmailStepError | null;
    code: CodeStepError | null;
    details: DetailsStepError | null;
}

/** 현재 단계에서 오류가 났을 때 포커스를 옮길 대상. */
export interface FocusTarget {
    /**
     * 현재 단계의 액션 오류. 마운트 뒤 새 오류 객체가 올 때마다 `fieldId`로
     * 포커스를 옮긴다. 마운트 시점에 이미 있던 오류에는 포커스를 옮기지 않는다.
     */
    error: SignupStepError | null;
    /** 오류가 붙은 입력의 id. 배너 오류처럼 고칠 입력이 없으면 `null`. */
    fieldId: string | null;
}

/**
 * 현재 단계의 오류와, 그 오류가 입력 자리(`field`·`password`)에 붙을 때의 입력 id.
 * 배너·동의 자리의 오류는 `fieldId`가 `null`이라 포커스를 옮기지 않는다.
 */
export function signupFocusTarget(
    phase: SignupPhase,
    errors: SignupStepErrors
): FocusTarget {
    switch (phase) {
        case 'email': {
            const error = errors.email;
            const onField =
                error !== null && emailStepErrorSlot(error.code) === 'field';
            return {
                error,
                fieldId: onField ? SIGNUP_FIELD_ID.email : null,
            };
        }
        case 'code': {
            const error = errors.code;
            const onField =
                error !== null && codeStepErrorSlot(error.code) === 'field';
            return { error, fieldId: onField ? SIGNUP_FIELD_ID.code : null };
        }
        case 'details': {
            const error = errors.details;
            const onField =
                error !== null && detailsStepErrorSlot(error) === 'password';
            return {
                error,
                fieldId: onField ? SIGNUP_FIELD_ID.password : null,
            };
        }
    }
}
