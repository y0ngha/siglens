'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { useDeleteAccountForm } from '../hooks/useDeleteAccountForm';
import { cn } from '@/shared/lib/cn';
import { AuthErrorAlert } from '@/shared/ui/auth/AuthErrorAlert';

const INPUT_HINT_ID = 'delete-account-email-hint';
const HINT_DEFAULT = '이메일이 일치해야 탈퇴 버튼이 활성화됩니다.';
const HINT_MISMATCH = '입력한 이메일이 본인 이메일과 일치하지 않습니다.';
const HINT_MATCH = '입력한 이메일이 일치합니다. 탈퇴 버튼이 활성화되었습니다.';

interface DangerSubmitButtonProps {
    disabled: boolean;
}

function DangerSubmitButton({ disabled }: DangerSubmitButtonProps) {
    const { pending } = useFormStatus();
    const isDisabled = disabled || pending;
    return (
        <button
            type="submit"
            disabled={isDisabled}
            aria-busy={pending}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-ui-danger font-semibold text-white transition-colors hover:bg-ui-danger/90 focus-visible:ring-2 focus-visible:ring-ui-danger focus-visible:outline-none active:bg-ui-danger/80 disabled:opacity-50 motion-reduce:transition-none"
        >
            {pending ? (
                <>
                    <span
                        aria-hidden
                        className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none"
                    />
                    <span>탈퇴 처리 중…</span>
                </>
            ) : (
                '계정 영구 삭제'
            )}
        </button>
    );
}

interface DeleteAccountConfirmProps {
    userEmail: string;
}

export function DeleteAccountConfirm({ userEmail }: DeleteAccountConfirmProps) {
    const [input, setInput] = useState('');
    const [state, formAction] = useDeleteAccountForm();
    const trimmed = input.trim();
    const isMatch = trimmed.toLowerCase() === userEmail.toLowerCase();
    const hintMessage =
        trimmed.length === 0
            ? HINT_DEFAULT
            : isMatch
              ? HINT_MATCH
              : HINT_MISMATCH;
    const isMismatch = trimmed.length > 0 && !isMatch;
    return (
        <form action={formAction} className="space-y-5" noValidate>
            {state.error ? (
                <AuthErrorAlert message={state.error.message} />
            ) : null}
            <ul className="list-disc space-y-1 pl-5 text-sm text-secondary-300">
                <li>이메일·닉네임·프로필 사진이 즉시 영구 삭제됩니다.</li>
                <li>
                    지금 로그인된 모든 기기에서 로그아웃되고, 소셜 로그인(구글
                    등) 연결도 자동으로 해제됩니다.
                </li>
                <li>
                    법령상 보유 사유가 있는 경우 해당 기간 동안만 보유됩니다.
                </li>
            </ul>
            <div className="space-y-2">
                <label
                    htmlFor="delete-account-email"
                    className="block text-sm font-medium text-secondary-200"
                >
                    계속하려면 본인 이메일을 정확히 입력하세요
                </label>
                <p className="rounded-md border border-secondary-800 bg-secondary-950 px-3 py-2 font-mono text-sm break-all text-secondary-100">
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
                    className="h-12 w-full rounded-md border border-secondary-700 bg-secondary-950 px-4 text-sm text-secondary-50 placeholder:text-secondary-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/40 focus:outline-none aria-invalid:border-ui-danger"
                />
                <div
                    id={INPUT_HINT_ID}
                    role="status"
                    aria-live="polite"
                    className={cn(
                        'text-xs',
                        isMismatch ? 'text-ui-danger' : 'text-secondary-400'
                    )}
                >
                    {hintMessage}
                </div>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Link
                    href="/account"
                    className="inline-flex h-12 items-center justify-center rounded-md border border-secondary-700 px-5 text-sm font-medium text-secondary-200 transition-colors hover:bg-secondary-800 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-900 focus-visible:outline-none sm:flex-1"
                >
                    취소
                </Link>
                <span className="sm:flex-1">
                    <DangerSubmitButton disabled={!isMatch} />
                </span>
            </div>
        </form>
    );
}
