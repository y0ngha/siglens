'use client';

import { useState } from 'react';
import type { PriceAlertConfirmState } from '@/entities/mail-alert/model';
import type { MailAlertErrorStatus } from '../hooks/useMailAlertErrorText';
import type { PriceAlertCodeFlow } from '../hooks/usePriceAlertProposal';
import { MailAlertCodeStep } from './MailAlertCodeStep';
import { MailAlertEmailStep } from './MailAlertEmailStep';

interface PriceAlertGuestFormProps {
    /** 만들려는 제안의 서명된 토큰 — 코드 확인 요청이 숨은 입력으로 싣는다. */
    readonly token: string;
    /** 이메일 인증 전 회원이면 계정 주소 — 입력 칸에 채워 고정한다. */
    readonly accountEmail: string | null;
    /** 카드가 들고 있는 코드 확인 흐름(`usePriceAlertCodeFlow`). 결과는 카드가 읽어 그린다. */
    readonly flow: PriceAlertCodeFlow;
    /** 방침 페이지의 절대 주소. 알림 카드는 방침 페이지가 없는 ai 호스트에 있어 메인 사이트의 것을 가리킨다. */
    readonly privacyHref: string;
}

/**
 * 코드 단계에 머물며 칸 아래에 알리는 오류. 제안이 틀렸거나(`invalid`) 만들 수 없는(`unavailable`) 결과는 카드가 끝난
 * 상태로 옮겨 문장으로 끝내므로 여기에 오지 않는다.
 */
function codeStepError(
    state: PriceAlertConfirmState
): MailAlertErrorStatus | null {
    switch (state.status) {
        case 'wrong_code':
        case 'expired':
        case 'too_many':
        case 'rate_limited':
        case 'invalid_email':
            return state.status;
        default:
            return null;
    }
}

/**
 * 비회원(또는 이메일 인증 전 회원)이 알림을 만들 때의 두 단계: 주소 입력 → 코드 입력. 코드를 확인하면 서버가 같은
 * 요청으로 알림까지 만든다. 단계 전환은 `MailAlertGuestForm`과 같고, 확정하는 것만 알림 항목이 아니라 제안이다.
 */
export function PriceAlertGuestForm({
    token,
    accountEmail,
    flow,
    privacyHref,
}: PriceAlertGuestFormProps) {
    const [isEditingEmail, setIsEditingEmail] = useState(false);

    if (flow.requestState.status === 'code_sent' && !isEditingEmail) {
        return (
            <MailAlertCodeStep
                hiddenFields={[['token', token]]}
                email={flow.requestState.email}
                confirmAction={flow.confirmAction}
                isConfirming={flow.isConfirming}
                confirmState={flow.confirmState}
                confirmError={codeStepError(flow.confirmState)}
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
            privacyHref={privacyHref}
        />
    );
}
