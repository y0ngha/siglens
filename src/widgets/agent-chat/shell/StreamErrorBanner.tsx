'use client';

/**
 * 스트림 오류 배너 — 문구와 함께 로그인(횟수 소진 비회원) 또는 다시 시도 버튼.
 */
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { AI_RAISED_CONTROL } from '../aiSurfaceStyles';

interface StreamErrorBannerProps {
    readonly message: string;
    readonly offerLogin: boolean;
    readonly retryable: boolean;
    readonly loginHref: string;
    readonly onRetry: () => void;
}

/** 경고 역할의 배너 한 줄을 그린다. 다음 길이 없으면 버튼 없이 문구만. */
export function StreamErrorBanner({
    message,
    offerLogin,
    retryable,
    loginHref,
    onRetry,
}: StreamErrorBannerProps) {
    const t = useTranslations('widgets.agent-chat');
    // 로그인이 다시 시도보다 앞선다 — 횟수를 다 쓴 비회원에게 재시도는 같은 오류를 되풀이할 뿐이다.
    const renderAction = (): ReactNode => {
        if (offerLogin)
            return (
                <a
                    href={loginHref}
                    className="surface-accent inline-flex min-h-9 shrink-0 items-center rounded-lg bg-primary-600 px-3 text-xs font-medium text-white focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    {t('ChatShell.loginCta')}
                </a>
            );
        if (!retryable) return null;
        return (
            <button
                type="button"
                onClick={onRetry}
                className={cn(
                    AI_RAISED_CONTROL,
                    'inline-flex min-h-9 shrink-0 items-center rounded-lg px-3 text-xs font-medium text-secondary-100'
                )}
            >
                {t('ChatShell.548fe0')}
            </button>
        );
    };
    return (
        <div className="px-4 pb-2">
            <p
                role="alert"
                className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 rounded-lg border border-ui-danger bg-secondary-800 px-4 py-3 text-sm text-ui-danger-text"
            >
                <span className="min-w-0 break-words">{message}</span>
                {renderAction()}
            </p>
        </div>
    );
}
