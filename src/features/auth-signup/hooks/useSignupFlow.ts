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
import { signupFocusTarget } from '../lib/signupFocusTarget';
import { derivePhase, type SignupPhase } from '../lib/signupPhase';
import { useSignupFocus } from './useSignupFocus';
import { useSignupForm } from './useSignupForm';

type FormAction = (formData: FormData) => void;

/** 오류 자리가 `target`일 때만 문구를 넘긴다 — 한 오류는 한 자리에만 뜬다. */
function messageAt<Slot extends string>(
    slot: Slot | null,
    target: Slot,
    message: string | undefined
): string | undefined {
    return slot === target ? message : undefined;
}

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

    // HK-1 예외: 초기값이 위 custom hook의 emailState·codeState에 의존해 그 뒤에 둔다.
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
    const emailMessage = describe(emailState.error);
    const codeMessage = describe(codeState.error);
    const signupMessage = describe(signupState.error);

    const focusTarget = signupFocusTarget(phase, {
        email: emailState.error,
        code: codeState.error,
        details: signupState.error,
    });

    // 입력이 위에서 계산한 `phase`·`focusTarget`이라 그 계산 바로 뒤에 둔다.
    useSignupFocus({
        phase,
        focusFirstFieldOnMount: focusEmailOnMount,
        ...focusTarget,
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
            fieldError: messageAt(emailSlot, 'field', emailMessage),
            bannerError: messageAt(emailSlot, 'banner', emailMessage),
        },
        codeStep: {
            action: codeFormAction,
            fieldError: messageAt(codeSlot, 'field', codeMessage),
            bannerError: messageAt(codeSlot, 'banner', codeMessage),
        },
        detailsStep: {
            action: signupFormAction,
            bannerError: messageAt(detailsSlot, 'banner', signupMessage),
            passwordError: messageAt(detailsSlot, 'password', signupMessage),
            consentError: messageAt(detailsSlot, 'consent', signupMessage),
        },
    };
}
