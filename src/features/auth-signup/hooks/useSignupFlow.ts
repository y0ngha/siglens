'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
    useRequestEmailVerification,
    useVerifyEmail,
} from '@/features/auth-email-verification/hooks/useEmailVerificationForms';
import { useDescribeAuthError } from '@/shared/hooks/useDescribeAuthError';
import {
    codeStepErrorSlot,
    detailsStepErrorSlot,
    emailStepErrorSlot,
} from '../lib/signupErrorSlot';
import {
    derivePhase,
    SIGNUP_FIELD_ID,
    type SignupPhase,
} from '../lib/signupPhase';
import { useSignupFocus } from './useSignupFocus';
import { useSignupForm } from './useSignupForm';

type FormAction = (formData: FormData) => void;

interface UseSignupFlowParams {
    /** 흐름 전체를 1단계로 되돌린다(부모가 key를 바꿔 다시 마운트). */
    onRestart: () => void;
    /** 「이메일 수정」으로 다시 시작해 마운트됐는지. 그때만 첫 렌더에 이메일 입력으로 포커스한다. */
    focusEmailOnMount: boolean;
}

/** 1단계(이메일 인증 요청) 폼에 필요한 값. */
export interface EmailStepModel {
    action: FormAction;
    /** 입력의 `defaultValue`. 실패한 제출 뒤 React가 폼을 리셋해도 입력값이 남게 한다. */
    draftEmail: string;
    onDraftEmailChange: (value: string) => void;
    fieldError: string | undefined;
    bannerError: string | undefined;
}

/** 2단계(인증 코드 확인) 폼에 필요한 값. */
export interface CodeStepModel {
    action: FormAction;
    fieldError: string | undefined;
    bannerError: string | undefined;
}

/** 3단계(가입) 폼에 필요한 값. */
export interface DetailsStepModel {
    action: FormAction;
    bannerError: string | undefined;
    passwordError: string | undefined;
    consentError: string | undefined;
}

/** `SignupFormFlow`가 렌더하는 회원가입 흐름의 상태. */
export interface UseSignupFlowReturn {
    phase: SignupPhase;
    /** 인증 코드를 요청한 이메일. 2·3단계가 화면 표시와 hidden 입력에 쓴다. */
    email: string;
    emailStep: EmailStepModel;
    codeStep: CodeStepModel;
    detailsStep: DetailsStepModel;
}

/**
 * 회원가입 3단계 흐름의 로직: 세 Server Action 상태에서 단계를 정하고, 오류를
 * 입력·배너·동의 자리로 나누고, 포커스를 옮긴다.
 *
 * 2·3단계가 쓰는 이메일은 입력 중인 값이 아니라 **요청을 보낸 값**이다. 요청이
 * 진행되는 동안에도 입력은 편집할 수 있어, 입력값을 그대로 쓰면 코드가 발송된
 * 주소와 다른 주소로 인증·가입을 시도하게 된다.
 */
export function useSignupFlow({
    onRestart,
    focusEmailOnMount,
}: UseSignupFlowParams): UseSignupFlowReturn {
    const [draftEmail, setDraftEmail] = useState('');
    const [email, setEmail] = useState('');

    const describe = useDescribeAuthError();
    const [emailState, emailFormAction] = useRequestEmailVerification();
    const [codeState, codeFormAction] = useVerifyEmail();
    const [signupState, signupFormAction] = useSignupForm();

    // Next.js router cache가 useActionState를 이전 세션 값으로 hydrate한 채
    // 컴포넌트를 리마운트할 수 있다. 마운트 시점에 이미 non-initial 상태라면
    // 뒤로가기로 복원된 것이므로 paint 전에 1단계로 리셋한다.
    const restoredFromCacheRef = useRef(
        emailState.submitted || codeState.verified
    );

    const submitEmail = useCallback(
        (formData: FormData): void => {
            setEmail(String(formData.get('email') ?? '').trim());
            emailFormAction(formData);
        },
        [emailFormAction]
    );

    const changeDraftEmail = useCallback((value: string): void => {
        setDraftEmail(value.trim());
    }, []);

    // useActionState 결과에서 직접 derive — set-state-in-effect 회피.
    const phase = derivePhase(emailState.submitted, codeState.verified);

    const emailSlot = emailState.error
        ? emailStepErrorSlot(emailState.error.code)
        : null;
    const codeSlot = codeState.error
        ? codeStepErrorSlot(codeState.error.code)
        : null;
    const detailsSlot = signupState.error
        ? detailsStepErrorSlot(signupState.error)
        : null;

    const focusTargetByPhase: Record<
        SignupPhase,
        { error: object | null; fieldId: string | null }
    > = {
        email: {
            error: emailState.error,
            fieldId: emailSlot === 'field' ? SIGNUP_FIELD_ID.email : null,
        },
        code: {
            error: codeState.error,
            fieldId: codeSlot === 'field' ? SIGNUP_FIELD_ID.code : null,
        },
        details: {
            error: signupState.error,
            fieldId:
                detailsSlot === 'password' ? SIGNUP_FIELD_ID.password : null,
        },
    };
    const focusTarget = focusTargetByPhase[phase];

    // 입력이 위에서 계산한 `phase`·오류 자리라 그 계산 바로 뒤에 둔다.
    useSignupFocus({
        phase,
        focusFirstFieldOnMount: focusEmailOnMount,
        error: focusTarget.error,
        errorFieldId: focusTarget.fieldId,
    });

    useLayoutEffect(() => {
        if (restoredFromCacheRef.current) {
            onRestart();
        }
    }, [onRestart]);

    return {
        phase,
        email,
        emailStep: {
            action: submitEmail,
            draftEmail,
            onDraftEmailChange: changeDraftEmail,
            fieldError:
                emailSlot === 'field' ? describe(emailState.error) : undefined,
            bannerError:
                emailSlot === 'banner' ? describe(emailState.error) : undefined,
        },
        codeStep: {
            action: codeFormAction,
            fieldError:
                codeSlot === 'field' ? describe(codeState.error) : undefined,
            bannerError:
                codeSlot === 'banner' ? describe(codeState.error) : undefined,
        },
        detailsStep: {
            action: signupFormAction,
            bannerError:
                detailsSlot === 'banner'
                    ? describe(signupState.error)
                    : undefined,
            passwordError:
                detailsSlot === 'password'
                    ? describe(signupState.error)
                    : undefined,
            consentError:
                detailsSlot === 'consent'
                    ? describe(signupState.error)
                    : undefined,
        },
    };
}
