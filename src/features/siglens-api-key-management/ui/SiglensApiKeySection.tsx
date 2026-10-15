'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import type { SiglensApiKeySummary } from '@/entities/siglens-api-key/model';
import { useCopyToClipboard } from '@/shared/hooks/useCopyToClipboard';
import {
    BUTTON_GHOST,
    BUTTON_OUTLINE,
    BUTTON_OUTLINE_DANGER,
    BUTTON_PRIMARY,
} from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { API_KEY_NAME_MAX_LENGTH } from '@/shared/config/publicApi';
import { useSiglensApiKeyForms } from '../hooks/useSiglensApiKeyForms';

interface SiglensApiKeySectionProps {
    /** `null` = 목록을 불러오지 못했다(빈 목록과 다르다). */
    keys: readonly SiglensApiKeySummary[] | null;
    maxKeys: number;
    /** 이메일 인증 전에는 발급할 수 없다 — 폼을 막고 안내를 먼저 보여 준다. */
    emailVerified: boolean;
    /** 예: `https://siglens.io/api/v1` — 시작 가이드의 curl 예시에 쓴다. */
    apiBaseUrl: string;
    /** Skill 파일 경로(`/api/v1/skill`). */
    skillHref: string;
}

interface SubmitButtonProps {
    label: string;
    pendingLabel: string;
    className: string;
    disabled?: boolean;
    'aria-label'?: string;
    buttonRef?: React.Ref<HTMLButtonElement>;
}

function SubmitButton({
    label,
    pendingLabel,
    className,
    disabled = false,
    'aria-label': ariaLabel,
    buttonRef,
}: SubmitButtonProps) {
    const { pending } = useFormStatus();
    return (
        <button
            ref={buttonRef}
            type="submit"
            // 포커스를 쥔 채 진행 중이 되는 버튼은 disabled가 아니라 aria-disabled다(REACT.md#AX-3) —
            // disabled가 되면 포커스가 body로 떨어진다. 클릭은 직접 막는다.
            aria-disabled={pending || undefined}
            disabled={disabled}
            aria-busy={pending}
            aria-label={ariaLabel}
            className={className}
            onClick={event => {
                if (pending) event.preventDefault();
            }}
        >
            {pending ? pendingLabel : label}
        </button>
    );
}

interface RevealedKeyProps {
    rawKey: string;
    onDismiss: () => void;
}

/** 새 키 원문을 한 번만 보여 준다. 서버에는 해시만 남아 다시 읽을 방법이 없다. */
function RevealedKey({ rawKey, onDismiss }: RevealedKeyProps) {
    const t = useTranslations('features.siglens-api-key-management');
    const { copied, failed, copy } = useCopyToClipboard();
    return (
        <div
            role="status"
            data-testid="siglens-api-key-revealed"
            className="space-y-3 rounded-lg bg-secondary-900/60 p-4 ring-1 ring-primary-500"
        >
            <p className="text-sm font-semibold text-secondary-100">
                {t('SiglensApiKeySection.revealedTitle')}
            </p>
            <code
                data-testid="siglens-api-key-raw"
                className="block rounded-lg border border-border-control bg-secondary-950 px-3 py-2 font-mono text-sm break-all text-secondary-50 select-all"
            >
                {rawKey}
            </code>
            <p className="text-sm text-ui-warning-text">
                {t('SiglensApiKeySection.revealedWarning')}
            </p>
            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={() => void copy(rawKey)}
                    className={cn(BUTTON_OUTLINE, 'h-9 px-3 text-sm')}
                >
                    {copied
                        ? t('SiglensApiKeySection.copied')
                        : t('SiglensApiKeySection.copy')}
                </button>
                <button
                    type="button"
                    onClick={onDismiss}
                    className={cn(BUTTON_GHOST, 'h-9 px-3 text-sm')}
                >
                    {t('SiglensApiKeySection.dismiss')}
                </button>
                {failed && (
                    <span role="alert" className="text-sm text-ui-danger-text">
                        {t('SiglensApiKeySection.copyFailed')}
                    </span>
                )}
            </div>
        </div>
    );
}

interface KeyRowProps {
    apiKey: SiglensApiKeySummary;
    revokeFormAction: (formData: FormData) => void;
}

function formatDay(date: Date, locale: string): string {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
        date
    );
}

function KeyRow({ apiKey, revokeFormAction }: KeyRowProps) {
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
                {' · '}
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

interface QuickStartProps {
    apiBaseUrl: string;
    skillHref: string;
}

function QuickStart({ apiBaseUrl, skillHref }: QuickStartProps) {
    const t = useTranslations('features.siglens-api-key-management');
    const curlExample = [
        `curl -s -X POST ${apiBaseUrl}/tools/search_ticker \\`,
        '  -H "Authorization: Bearer $SIGLENS_API_KEY" \\',
        '  -H "Content-Type: application/json" \\',
        `  -d '{"query":"apple"}'`,
    ].join('\n');
    return (
        <div className="space-y-3 border-t border-secondary-700 pt-4">
            <h3 className="text-sm font-semibold text-secondary-100">
                {t('SiglensApiKeySection.quickStartTitle')}
            </h3>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-secondary-300">
                <li>
                    {t('SiglensApiKeySection.step1')}
                    <code className="mt-1 block rounded-lg bg-secondary-950 px-3 py-2 font-mono text-xs break-all text-secondary-100">
                        export SIGLENS_API_KEY=slk_…
                    </code>
                </li>
                <li>
                    {t('SiglensApiKeySection.step2')}
                    <div className="mt-2">
                        {/* 같은 오리진 파일 다운로드라 next/link가 아니라 일반 앵커다. */}
                        <a
                            href={skillHref}
                            download="SKILL.md"
                            className={cn(BUTTON_OUTLINE, 'h-9 px-4 text-sm')}
                        >
                            {t('SiglensApiKeySection.downloadSkill')}
                        </a>
                    </div>
                </li>
                <li>
                    {t('SiglensApiKeySection.step3')}
                    <pre className="mt-1 overflow-x-auto rounded-lg bg-secondary-950 px-3 py-2 font-mono text-xs text-secondary-100">
                        {curlExample}
                    </pre>
                </li>
            </ol>
        </div>
    );
}

export function SiglensApiKeySection({
    keys,
    maxKeys,
    emailVerified,
    apiBaseUrl,
    skillHref,
}: SiglensApiKeySectionProps) {
    const t = useTranslations('features.siglens-api-key-management');
    const { createState, createFormAction, revokeState, revokeFormAction } =
        useSiglensApiKeyForms();
    const [dismissedRawKey, setDismissedRawKey] = useState<string | null>(null);
    const activeCount = keys?.length ?? 0;
    const limitReached = keys !== null && activeCount >= maxKeys;
    const createBlocked = !emailVerified || limitReached;
    const revokeStatusRef = useRef<HTMLDivElement>(null);
    // 폐기에 성공하면 누른 행이 사라진다 — 항상 남아 있는 상태 영역으로 포커스를 옮긴다.
    useEffect(() => {
        if (revokeState.status === 'revoked') revokeStatusRef.current?.focus();
    }, [revokeState]);
    const revealedKey =
        createState.status === 'created' &&
        createState.rawKey !== dismissedRawKey
            ? createState.rawKey
            : null;

    return (
        <div className="space-y-4" data-testid="siglens-api-key-section">
            <div>
                <h2 className="text-lg font-semibold text-secondary-100">
                    {t('SiglensApiKeySection.title')}
                </h2>
                <p className="mt-1 text-sm text-secondary-400">
                    {t('SiglensApiKeySection.description')}
                </p>
            </div>

            {revealedKey !== null && (
                <RevealedKey
                    rawKey={revealedKey}
                    onDismiss={() => setDismissedRawKey(revealedKey)}
                />
            )}

            <form
                action={createFormAction}
                className="flex flex-col gap-2 sm:flex-row sm:items-end"
                noValidate
            >
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-secondary-300">
                    {t('SiglensApiKeySection.nameLabel')}
                    <input
                        type="text"
                        name="name"
                        required
                        disabled={!emailVerified}
                        maxLength={API_KEY_NAME_MAX_LENGTH}
                        autoComplete="off"
                        placeholder={t('SiglensApiKeySection.namePlaceholder')}
                        aria-describedby="siglens-api-key-create-status"
                        className="h-10 w-full rounded-lg border border-border-control bg-secondary-950 px-3 text-sm text-secondary-50 placeholder:text-secondary-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/40 focus:outline-none"
                    />
                </label>
                <SubmitButton
                    label={t('SiglensApiKeySection.createButton')}
                    pendingLabel={t('SiglensApiKeySection.creating')}
                    disabled={createBlocked}
                    className={cn(BUTTON_PRIMARY, 'h-10 shrink-0 px-4 text-sm')}
                />
            </form>
            <div
                id="siglens-api-key-create-status"
                role="status"
                aria-live="polite"
                className="min-h-5 text-sm"
            >
                {createState.status === 'error' && (
                    <span className="text-ui-danger-text">
                        {createState.message}
                    </span>
                )}
                {!emailVerified && (
                    <span className="text-ui-warning-text">
                        {t('SiglensApiKeySection.emailNotVerified')}
                    </span>
                )}
                {emailVerified &&
                    limitReached &&
                    createState.status !== 'error' && (
                        <span className="text-secondary-400">
                            {t('SiglensApiKeySection.limitHint', {
                                v0: maxKeys,
                            })}
                        </span>
                    )}
            </div>

            {keys === null ? (
                <p role="alert" className="text-sm text-ui-danger-text">
                    {t('SiglensApiKeySection.loadFailed')}
                </p>
            ) : keys.length === 0 ? (
                <p className="text-sm text-secondary-400">
                    {t('SiglensApiKeySection.empty')}
                </p>
            ) : (
                <ul
                    className="space-y-2"
                    aria-label={t('SiglensApiKeySection.listLabel')}
                >
                    {keys.map(apiKey => (
                        <KeyRow
                            key={apiKey.id}
                            apiKey={apiKey}
                            revokeFormAction={revokeFormAction}
                        />
                    ))}
                </ul>
            )}

            <div
                ref={revokeStatusRef}
                tabIndex={-1}
                role="status"
                aria-live="polite"
                className="min-h-5 text-sm focus:outline-none"
            >
                {revokeState.status === 'revoked' && (
                    <span className="text-ui-success-text">
                        {t('SiglensApiKeySection.revoked')}
                    </span>
                )}
                {revokeState.status === 'error' && (
                    <span className="text-ui-danger-text">
                        {revokeState.message}
                    </span>
                )}
            </div>

            <QuickStart apiBaseUrl={apiBaseUrl} skillHref={skillHref} />
        </div>
    );
}
