'use client';

import { useId } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { SiglensApiKeySummary } from '@/entities/siglens-api-key/model';
import { BUTTON_GHOST, BUTTON_OUTLINE_DANGER } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { useRevokeConfirm } from '../hooks/useRevokeConfirm';
import { SubmitButton } from './SubmitButton';

interface KeyRowProps {
    /** 표시할 키. 원문은 없고 표시용 접두만 있다. */
    apiKey: SiglensApiKeySummary;
    /** 섹션이 공유하는 폐기 액션. 결과 문구는 섹션의 상태 영역에 뜬다. */
    revokeFormAction: (formData: FormData) => void;
}

function formatDay(date: Date, locale: string): string {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
        date
    );
}

/**
 * 발급한 키 한 줄 — 이름·접두·만든 날·마지막 사용일과 폐기 버튼. 폐기는 되돌릴 수 없어
 * 행 안에서 한 번 더 묻고, 확인 버튼이 그 경고 문구를 설명으로 함께 읽힌다.
 */
export function KeyRow({ apiKey, revokeFormAction }: KeyRowProps) {
    const t = useTranslations('features.siglens-api-key-management');
    const locale = useLocale();
    const promptId = useId();
    const {
        confirming,
        startConfirm,
        cancelConfirm,
        revokeButtonRef,
        confirmButtonRef,
    } = useRevokeConfirm();

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
                        onClick={startConfirm}
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
                })}{' '}
                <span aria-hidden="true">|</span>{' '}
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
                    <p
                        id={promptId}
                        className="w-full text-sm text-secondary-200"
                    >
                        {t('SiglensApiKeySection.revokePrompt')}
                    </p>
                    {/* 포커스가 경고 문구를 건너뛰고 이 버튼으로 바로 오므로 문구를 설명으로 잇는다. */}
                    <SubmitButton
                        buttonRef={confirmButtonRef}
                        label={t('SiglensApiKeySection.revokeConfirm')}
                        pendingLabel={t('SiglensApiKeySection.revoking')}
                        aria-describedby={promptId}
                        className={cn(
                            BUTTON_OUTLINE_DANGER,
                            'h-8 px-3 text-xs'
                        )}
                    />
                    <button
                        type="button"
                        onClick={cancelConfirm}
                        className={cn(BUTTON_GHOST, 'h-8 px-2 text-xs')}
                    >
                        {t('SiglensApiKeySection.revokeCancel')}
                    </button>
                </form>
            )}
        </li>
    );
}
