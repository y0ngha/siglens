'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { SiglensApiKeySummary } from '@/entities/siglens-api-key/model';
import { DEVELOPERS_PATH } from '@/shared/config/publicApi';
import { LocaleLink } from '@/shared/ui/LocaleLink';
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
    /** 키 목록과 시작 가이드 사이에 들어갈 영역(API 기본 모델 선택). 서버 컴포넌트가 데이터를 채워 넘긴다. */
    defaultModelSlot?: ReactNode;
    /** 등록한 BYOK LLM 키가 하나라도 있는가 — 없으면 발급 전에 안내 모달을 연다. */
    hasByokKey: boolean;
    /** "키 등록하러 가기"가 스크롤·포커스할 BYOK 섹션의 DOM id(`#` 없이). */
    byokSectionId: string;
}

export function SiglensApiKeySection({
    keys,
    maxKeys,
    emailVerified,
    apiBaseUrl,
    skillHref,
    defaultModelSlot,
    hasByokKey,
    byokSectionId,
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
                {/* 개발자 포털로 가는 계정 쪽 입구 — 키를 만든 사람이 엔드포인트·도구 레퍼런스를 찾는 곳. */}
                <LocaleLink
                    href={DEVELOPERS_PATH}
                    prefetch={false}
                    className="mt-2 inline-flex min-h-11 items-center rounded text-sm text-secondary-300 underline underline-offset-2 hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    {t('SiglensApiKeySection.docsLink')}
                </LocaleLink>
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
                hasByokKey={hasByokKey}
                byokSectionId={byokSectionId}
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

            {defaultModelSlot}

            <QuickStart apiBaseUrl={apiBaseUrl} skillHref={skillHref} />
        </div>
    );
}
