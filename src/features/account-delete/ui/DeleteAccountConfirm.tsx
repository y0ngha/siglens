'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { useDeleteAccountForm } from '../hooks/useDeleteAccountForm';
import { cn } from '@/shared/lib/cn';
import { ErrorAlert } from '@/shared/ui/ErrorAlert';
import { SubmitButton } from '@/shared/ui/auth/SubmitButton';
import { BUTTON_OUTLINE } from '@/shared/lib/buttonStyles';
import { AUTH_ERROR_KEY } from '@/shared/lib/authErrorKey';

const INPUT_HINT_ID = 'delete-account-email-hint';
// 힌트 문구는 `entities.auth.error`에 있다 — 삭제 흐름의 다른 문구와 같은
// 자리에 두어야 번역이 갈리지 않는다.
const HINT_DEFAULT = 'error.deleteHintDefault';
const HINT_MISMATCH = 'error.deleteHintMismatch';
const HINT_MATCH = 'error.deleteHintMatch';
/**
 * 표에 없는 코드(`unexpected` 등)의 표시 문구. 액션의 `message`를 폴백으로 쓰지 않는다 —
 * `deleteAccount`가 그대로 넘기는 코드(`user_not_found`)의 `message`는 로그용 한국어
 * 원문이라 모든 로케일에 한국어가 나갔다.
 */
const ERROR_FALLBACK = 'error.accountDeleteFailed';

interface DeleteAccountConfirmProps {
    userEmail: string;
}

export function DeleteAccountConfirm({ userEmail }: DeleteAccountConfirmProps) {
    const t = useTranslations('features.account-delete');
    const tAuth = useTranslations('entities.auth');
    const [input, setInput] = useState('');
    const [state, formAction] = useDeleteAccountForm();
    const trimmed = input.trim();
    const isMatch = trimmed.toLowerCase() === userEmail.toLowerCase();
    const hintMessage =
        trimmed.length === 0
            ? tAuth(HINT_DEFAULT)
            : isMatch
              ? tAuth(HINT_MATCH)
              : tAuth(HINT_MISMATCH);
    const isMismatch = trimmed.length > 0 && !isMatch;
    const errorMessage = state.error
        ? tAuth(AUTH_ERROR_KEY[state.error.code] ?? ERROR_FALLBACK)
        : null;
    return (
        <form action={formAction} className="space-y-5" noValidate>
            {errorMessage ? <ErrorAlert message={errorMessage} /> : null}
            <ul className="list-disc space-y-1 pl-5 text-sm text-secondary-300">
                <li>{t('DeleteAccountConfirm.a060ae')}</li>
                <li>{t('DeleteAccountConfirm.5c7233')}</li>
                <li>{t('DeleteAccountConfirm.6f8404')}</li>
            </ul>
            <div className="space-y-2">
                <label
                    htmlFor="delete-account-email"
                    className="block text-sm font-medium text-secondary-200"
                >
                    {t('DeleteAccountConfirm.56dd08')}
                </label>
                <p className="rounded-lg border border-secondary-700 bg-secondary-950 px-3 py-2 font-mono text-sm break-all text-secondary-100">
                    {userEmail}
                </p>
                <input
                    id="delete-account-email"
                    name="email"
                    type="email"
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    required
                    value={input}
                    onChange={event => setInput(event.target.value)}
                    aria-invalid={isMismatch}
                    aria-describedby={INPUT_HINT_ID}
                    className="h-12 w-full rounded-lg border border-border-control bg-secondary-950 px-4 text-sm text-secondary-50 placeholder:text-secondary-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/40 focus:outline-none aria-invalid:border-ui-danger"
                />
                <div
                    id={INPUT_HINT_ID}
                    role="status"
                    aria-live="polite"
                    className={cn(
                        'text-xs',
                        isMismatch
                            ? 'text-ui-danger-text'
                            : 'text-secondary-400'
                    )}
                >
                    {hintMessage}
                </div>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Link
                    href="/account"
                    className={cn(
                        BUTTON_OUTLINE,
                        'h-12 px-5 text-sm focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-900 sm:flex-1'
                    )}
                >
                    {t('DeleteAccountConfirm.19b2d1')}
                </Link>
                <span className="sm:flex-1">
                    <SubmitButton
                        tone="danger"
                        disabled={!isMatch}
                        label={t('DeleteAccountConfirm.009e27')}
                        pendingLabel={t('DeleteAccountConfirm.b5b216')}
                    />
                </span>
            </div>
        </form>
    );
}
