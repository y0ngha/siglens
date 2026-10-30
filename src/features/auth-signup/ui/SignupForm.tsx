'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { useRestartOnHistoryRestore } from '../hooks/useRestartOnHistoryRestore';
import { useSignupFlow } from '../hooks/useSignupFlow';
import type { SignupPhase } from '../lib/signupPhase';
import { CodeStepForm } from './CodeStepForm';
import { DetailsStepForm } from './DetailsStepForm';
import { EmailStepForm } from './EmailStepForm';

interface SignupFormProps {
    /** 가입 후 돌아갈 경로(검증 전 원문). */
    next?: string;
}

interface StepIndicatorProps {
    phase: SignupPhase;
}

function StepIndicator({ phase }: StepIndicatorProps) {
    const t = useTranslations('features.auth-signup');
    const label: Record<SignupPhase, string> = {
        email: t('SignupForm.stepEmail'),
        code: t('SignupForm.stepCode'),
        details: t('SignupForm.stepDetails'),
    };
    return (
        <p
            aria-live="polite"
            className="mb-4 text-xs font-medium text-secondary-400"
        >
            {label[phase]}
        </p>
    );
}

/**
 * 회원가입 흐름의 뼈대. 다시 시작은 `SignupFormFlow`의 key를 바꿔 세 액션
 * 상태와 입력을 한꺼번에 버리는 방식이다 — 액션 상태는 되돌릴 API가 없다.
 * 「이메일 수정」으로 다시 시작할 때만 이메일 입력에 포커스를 준다(뒤로가기
 * 복원은 사용자가 누른 컨트롤이 없어 포커스를 옮기지 않는다).
 */
export function SignupForm({ next }: SignupFormProps) {
    const [flow, setFlow] = useState({ key: 0, focusEmail: false });

    const restart = useCallback((): void => {
        setFlow(current => ({ key: current.key + 1, focusEmail: false }));
    }, []);

    const editEmail = useCallback((): void => {
        setFlow(current => ({ key: current.key + 1, focusEmail: true }));
    }, []);

    useRestartOnHistoryRestore(restart);

    return (
        <SignupFormFlow
            key={flow.key}
            next={next}
            focusEmailOnMount={flow.focusEmail}
            onRestart={restart}
            onEditEmail={editEmail}
        />
    );
}

interface SignupFormFlowProps extends SignupFormProps {
    focusEmailOnMount: boolean;
    onRestart: () => void;
    onEditEmail: () => void;
}

function SignupFormFlow({
    next,
    focusEmailOnMount,
    onRestart,
    onEditEmail,
}: SignupFormFlowProps) {
    const { phase, email, emailStep, codeStep, detailsStep } = useSignupFlow({
        onRestart,
        focusEmailOnMount,
    });

    return (
        <div className="space-y-4">
            <StepIndicator phase={phase} />
            {phase === 'email' && <EmailStepForm step={emailStep} />}
            {phase === 'code' && (
                <CodeStepForm
                    step={codeStep}
                    email={email}
                    onEditEmail={onEditEmail}
                />
            )}
            {phase === 'details' && (
                <DetailsStepForm
                    step={detailsStep}
                    email={email}
                    next={next}
                    onEditEmail={onEditEmail}
                />
            )}
        </div>
    );
}
