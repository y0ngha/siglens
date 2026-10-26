'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { SiglensApiKeySummary } from '@/entities/siglens-api-key/model';
import { BUTTON_GHOST, BUTTON_OUTLINE_DANGER } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { SubmitButton } from './SubmitButton';

interface KeyRowProps {
    apiKey: SiglensApiKeySummary;
    revokeFormAction: (formData: FormData) => void;
}

function formatDay(date: Date, locale: string): string {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
        date
    );
}

export function KeyRow({ apiKey, revokeFormAction }: KeyRowProps) {
    const t = useTranslations('features.siglens-api-key-management');
    const locale = useLocale();
    const [confirming, setConfirming] = useState(false);
    const revokeButtonRef = useRef<HTMLButtonElement>(null);
    const confirmButtonRef = useRef<HTMLButtonElement>(null);
    const restoreFocusRef = useRef(false);
    // 확인 단계가 열리면 확인 버튼으로, 취소로 닫히면 폐기 버튼으로 포커스를 옮긴다.
    // 누른 버튼이 사라지므로 옮기지 않으면 포커스가 body로 떨어진다.
    useEffect(() => {
        if (confirming) {
            confirmButtonRef.current?.focus();
        } else if (restoreFocusRef.current) {
            restoreFocusRef.current = false;
            revokeButtonRef.current?.focus();
        }
    }, [confirming]);
    return (
        <li
            data-testid={`siglens-api-key-row-${apiKey.id}`}
            className="space-y-2 rounded-lg bg-secondary-900/60 p-4 ring-1 ring-secondary-700"
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-secondary-100">
                        {apiKey.name}
                    </p>
                    <p className="font-mono text-xs text-secondary-400">
                        {apiKey.keyPrefix}…
                    </p>
                </div>
                {!confirming && (
                    <button
                        ref={revokeButtonRef}
                        type="button"
                        onClick={() => setConfirming(true)}
                        aria-label={t('SiglensApiKeySection.revokeAria', {
                            v0: apiKey.name,
                        })}
                        className={cn(
                            BUTTON_OUTLINE_DANGER,
                            'h-7 px-3 text-xs'
                        )}
                    >
                        {t('SiglensApiKeySection.revoke')}
                    </button>
                )}
            </div>
            {/* suppressHydrationWarning: 날짜는 방문자 시간대로 그려야 해서 서버와 어긋날 수 있다. */}
            <p className="text-xs text-secondary-400" suppressHydrationWarning>
                {t('SiglensApiKeySection.createdAt', {
                    v0: formatDay(apiKey.createdAt, locale),
                })}
                {' | '}
                {apiKey.lastUsedAt === null
                    ? t('SiglensApiKeySection.neverUsed')
                    : t('SiglensApiKeySection.lastUsedAt', {
                          v0: formatDay(apiKey.lastUsedAt, locale),
                      })}
            </p>
            {confirming && (
                <form
                    action={revokeFormAction}
                    className="flex flex-wrap items-center gap-2"
                >
                    <input type="hidden" name="keyId" value={apiKey.id} />
                    <p className="w-full text-sm text-secondary-200">
                        {t('SiglensApiKeySection.revokePrompt')}
                    </p>
                    <SubmitButton
                        buttonRef={confirmButtonRef}
                        label={t('SiglensApiKeySection.revokeConfirm')}
                        pendingLabel={t('SiglensApiKeySection.revoking')}
                        className={cn(
                            BUTTON_OUTLINE_DANGER,
                            'h-8 px-3 text-xs'
                        )}
                    />
                    <button
                        type="button"
                        onClick={() => {
                            restoreFocusRef.current = true;
                            setConfirming(false);
                        }}
                        className={cn(BUTTON_GHOST, 'h-8 px-2 text-xs')}
                    >
                        {t('SiglensApiKeySection.revokeCancel')}
                    </button>
                </form>
            )}
        </li>
    );
}
