'use client';

import { useState } from 'react';
import { confirmMailAlertAction } from '@/entities/mail-alert/actions/confirmMailAlertAction';
import type {
    MailAlertConfirmState,
    MailAlertTopic,
} from '@/entities/mail-alert/model';
import { useMailAlertCodeFlow } from '../hooks/useMailAlertCodeFlow';
import { topicFormFields } from '../lib/topicFields';
import { MailAlertCodeStep } from './MailAlertCodeStep';
import { MailAlertEmailStep } from './MailAlertEmailStep';
import { MailAlertSuccess } from './MailAlertSuccess';

const IDLE_CONFIRM: MailAlertConfirmState = { status: 'idle' };

interface MailAlertGuestFormProps {
    readonly topic: MailAlertTopic;
    /** 이메일 인증 전 회원이면 계정 주소 — 입력 칸에 채워 고정한다. */
    readonly accountEmail: string | null;
}

/**
 * 코드로 주소를 확인하는 신청: 주소 입력 → 코드 입력 → 완료. 코드 단계에서 "이메일 바꾸기"를 누르면
 * 주소 입력으로 돌아가고, 새로 제출하면 다시 코드 단계가 된다(결과 상태는 훅이 들고 있고 이 컴포넌트는
 * 어느 단계를 보일지만 정한다).
 */
export function MailAlertGuestForm({
    topic,
    accountEmail,
}: MailAlertGuestFormProps) {
    const flow = useMailAlertCodeFlow(confirmMailAlertAction, IDLE_CONFIRM);
    const [isEditingEmail, setIsEditingEmail] = useState(false);

    if (flow.confirmState.status === 'subscribed') {
        return (
            <MailAlertSuccess
                maskedEmail={flow.confirmState.maskedEmail}
                offerSignup
            />
        );
    }
    if (flow.requestState.status === 'code_sent' && !isEditingEmail) {
        return (
            <MailAlertCodeStep
                hiddenFields={topicFormFields(topic)}
                email={flow.requestState.email}
                confirmAction={flow.confirmAction}
                isConfirming={flow.isConfirming}
                confirmState={flow.confirmState}
                confirmError={
                    flow.confirmState.status === 'idle'
                        ? null
                        : flow.confirmState.status
                }
                resendAction={flow.resendAction}
                resendState={flow.resendState}
                isResending={flow.isResending}
                resendRemainingSeconds={flow.resendRemainingSeconds}
                onChangeEmail={() => setIsEditingEmail(true)}
            />
        );
    }
    return (
        <MailAlertEmailStep
            action={flow.requestAction}
            isPending={flow.isRequesting}
            state={flow.requestState}
            defaultEmail={
                flow.requestState.status === 'code_sent'
                    ? flow.requestState.email
                    : (accountEmail ?? '')
            }
            emailLocked={accountEmail !== null}
            honeypotField={flow.honeypotField}
            onSubmit={() => setIsEditingEmail(false)}
        />
    );
}
