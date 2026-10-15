'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { SiglensApiKeySummary } from '@/entities/siglens-api-key/model';
import { useSiglensApiKeyForms } from '../hooks/useSiglensApiKeyForms';
import { CreateKeyForm } from './CreateKeyForm';
import { KeyRow } from './KeyRow';
import { QuickStart } from './QuickStart';
import { RevealedKey } from './RevealedKey';

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

            <CreateKeyForm
                createState={createState}
                createFormAction={createFormAction}
                emailVerified={emailVerified}
                limitReached={limitReached}
                maxKeys={maxKeys}
            />

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
