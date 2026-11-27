'use client';

import { useActionState, useEffect, useState } from 'react';
import { requestMailAlertCodeAction } from '@/entities/mail-alert/actions/requestMailAlertCodeAction';
import {
    MAIL_ALERT_HONEYPOT_FIELD,
    MAIL_ALERT_RESEND_COOLDOWN_SECONDS,
} from '@/entities/mail-alert/lib/mailAlertConstants';
import type { MailAlertRequestCodeState } from '@/entities/mail-alert/model';
import { MS_PER_SECOND } from '@/shared/config/time';

const IDLE_REQUEST: MailAlertRequestCodeState = { status: 'idle' };

/**
 * 코드를 보낸 뒤 "다시 받기"를 잠그는 쿨다운. 서버 한도(주소당 시간당 3회)와는 별개로 연타를 막는 화면
 * 장치라, 끝나는 시각만 상태로 두고 1초마다 현재 시각을 갱신해 남은 초를 구한다. 타이머는 쿨다운이 도는
 * 동안만 켠다.
 */
function useResendCooldown(): {
    readonly remainingSeconds: number;
    readonly start: () => void;
} {
    const [endsAt, setEndsAt] = useState<number | null>(null);
    const [now, setNow] = useState(0);
    const running = endsAt !== null && now < endsAt;

    useEffect(() => {
        if (!running) return;
        const timer = setInterval(() => setNow(Date.now()), MS_PER_SECOND);
        return () => clearInterval(timer);
    }, [running]);

    const start = (): void => {
        const startedAt = Date.now();
        setNow(startedAt);
        setEndsAt(
            startedAt + MAIL_ALERT_RESEND_COOLDOWN_SECONDS * MS_PER_SECOND
        );
    };
    const remainingSeconds =
        endsAt === null
            ? 0
            : Math.max(0, Math.ceil((endsAt - now) / MS_PER_SECOND));
    return { remainingSeconds, start };
}

/**
 * 비회원 신청의 두 단계(코드 받기 → 코드 확인)와 "다시 받기" 쿨다운. 두 단계의 상태는 각자의
 * `useActionState`가 들고, 코드를 보내는 데 성공하면 쿨다운이 시작된다. 코드 확인이 확정하는 것은 호출자가
 * 정한다 — 알림 항목(`confirmMailAlertAction`) 또는 가격대 알림 제안(`confirmPriceAlertAction`) — 이라 확인 액션과
 * 그 처음 상태(`idle`)를 받는다.
 */
export function useMailAlertCodeFlow<S extends { readonly status: string }>(
    confirm: (previous: Awaited<S>, formData: FormData) => Promise<S>,
    idleConfirm: Awaited<S>
) {
    const cooldown = useResendCooldown();
    const requestAndCool = async (
        previous: MailAlertRequestCodeState,
        formData: FormData
    ): Promise<MailAlertRequestCodeState> => {
        const next = await requestMailAlertCodeAction(previous, formData);
        if (next.status === 'code_sent') cooldown.start();
        return next;
    };
    const [requestState, requestAction, isRequesting] = useActionState(
        requestAndCool,
        IDLE_REQUEST
    );
    // 코드 단계의 "다시 받기"는 자기 상태를 따로 가진다 — 실패해도 코드 단계에 머물고 그 자리에서 알린다.
    const [resendState, resendAction, isResending] = useActionState(
        requestAndCool,
        IDLE_REQUEST
    );
    const [confirmState, confirmAction, isConfirming] = useActionState(
        confirm,
        idleConfirm
    );
    return {
        requestState,
        requestAction,
        isRequesting,
        resendState,
        resendAction,
        isResending,
        confirmState,
        confirmAction,
        isConfirming,
        resendRemainingSeconds: cooldown.remainingSeconds,
        honeypotField: MAIL_ALERT_HONEYPOT_FIELD,
    };
}
