'use client';

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useCurrentUser } from '@/entities/auth/hooks/useCurrentUser';
import type {
    RadarRequestError,
    RadarRequestField,
} from '@/entities/inquiry/lib/types';
import { ContactEmailField } from '@/features/contact-form/ui/ContactEmailField';
import { resolveEmailDefault } from '@/features/contact-form/lib/contactFormUtils';
import { HoneypotField } from '@/features/contact-form/ui/HoneypotField';
import { useFocusInvalidFieldOnError } from '@/shared/hooks/useFocusInvalidFieldOnError';
import { RADAR_REQUEST_SYMBOL_MAX_LENGTH } from '@/shared/config/radar';
import { SubmitButton } from '@/shared/ui/auth/SubmitButton';
import { ErrorAlert } from '@/shared/ui/ErrorAlert';
import { SuccessNotice } from '@/shared/ui/SuccessNotice';
import { TextField } from '@/shared/ui/TextField';
import { useRadarRequestForm } from '../hooks/useRadarRequestForm';

/**
 * 종목 요청 다이얼로그의 본문. 성공 시 폼이 통째로 사라진다 — 포커스·알림 처리는
 * `SuccessNotice` 참고(라이브 영역은 제출 전부터 렌더해 둔다). 이메일은 선택이라 성공 문구가 입력 여부에 따라 갈린다.
 */
export function RadarRequestForm() {
    const formRef = useRef<HTMLFormElement>(null);
    const t = useTranslations('features.radar-request');
    const tError = useTranslations('shared.lib.contactError');
    const [state, formAction] = useRadarRequestForm();
    const currentUser = useCurrentUser();
    useFocusInvalidFieldOnError(formRef, state.error);

    // 번역 키는 정적 분석이 읽어야 해서 리터럴로 푼다(I18N.md#I18-16).
    const messageOf = (error: RadarRequestError): string => {
        switch (error.code) {
            case 'symbol_required':
                return t('errorSymbolRequired');
            case 'symbol_too_long':
                return t('errorSymbolTooLong', {
                    v0: RADAR_REQUEST_SYMBOL_MAX_LENGTH,
                });
            case 'email_invalid':
                return tError('emailInvalid');
            case 'rate_limited':
                return tError('rateLimited');
            case 'submission_failed':
                return tError('submissionFailed');
        }
    };
    const fieldError = (field: RadarRequestField): string | undefined =>
        state.error?.field === field ? messageOf(state.error) : undefined;
    const submissionError =
        state.error && state.error.field === undefined
            ? messageOf(state.error)
            : undefined;

    return (
        <>
            <SuccessNotice
                show={state.submitted}
                title={t('successTitle')}
                messages={[
                    state.values.email.length > 0
                        ? t('successWithEmail')
                        : t('successWithoutEmail'),
                ]}
            />
            {state.submitted ? null : (
                <form
                    ref={formRef}
                    action={formAction}
                    className="space-y-4"
                    noValidate
                >
                    {submissionError ? (
                        <ErrorAlert message={submissionError} />
                    ) : null}

                    <TextField
                        id="radar-request-symbol"
                        name="symbol"
                        label={t('symbolLabel')}
                        type="text"
                        required
                        maxLength={RADAR_REQUEST_SYMBOL_MAX_LENGTH}
                        placeholder={t('symbolPlaceholder')}
                        defaultValue={state.values.symbol}
                        error={fieldError('symbol')}
                    />

                    <ContactEmailField
                        id="radar-request-email"
                        label={t('emailLabel')}
                        required={false}
                        hint={t('emailHint')}
                        isPending={currentUser.isPending}
                        defaultValue={resolveEmailDefault(
                            state,
                            currentUser.data?.email
                        )}
                        error={fieldError('email')}
                    />

                    {/* 로그인 조회가 끝나기 전에는 이메일 입력이 아직 없다 — 지금 제출하면 이메일이
                        조용히 빠지므로 입력이 마운트될 때까지 막는다. */}
                    <SubmitButton
                        disabled={currentUser.isPending}
                        label={t('submit')}
                        pendingLabel={t('pending')}
                    />
                    <HoneypotField />
                </form>
            )}
        </>
    );
}
