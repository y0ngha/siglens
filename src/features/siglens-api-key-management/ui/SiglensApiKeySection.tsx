'use client';

import { useRef, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { SiglensApiKeySummary } from '@/entities/siglens-api-key/model';
import { DEVELOPERS_PATH } from '@/shared/config/publicApi';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { LocaleLink } from '@/shared/ui/LocaleLink';
import { useRevealedKey } from '../hooks/useRevealedKey';
import { useRevokeStatusFocus } from '../hooks/useRevokeStatusFocus';
import { useSiglensApiKeyForms } from '../hooks/useSiglensApiKeyForms';
import { CreateKeyForm } from './CreateKeyForm';
import { KeyRow } from './KeyRow';
import { QuickStart } from './QuickStart';
import { RevealedKey } from './RevealedKey';

interface SiglensApiKeySectionProps {
    /** `null` = 목록을 불러오지 못했다(빈 목록과 다르다). */
    keys: readonly SiglensApiKeySummary[] | null;
    /** 활성 키 상한. 닿으면 발급을 막는다(서버도 같은 값으로 다시 막는다). */
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

interface KeyListProps {
    keys: readonly SiglensApiKeySummary[] | null;
    revokeFormAction: (formData: FormData) => void;
}

/** 키 목록 — 불러오기 실패·빈 목록·키 행 목록 셋 중 하나. */
function KeyList({ keys, revokeFormAction }: KeyListProps) {
    const t = useTranslations('features.siglens-api-key-management');
    if (keys === null)
        return (
            <p role="alert" className="text-sm text-ui-danger-text">
                {t('SiglensApiKeySection.loadFailed')}
            </p>
        );
    if (keys.length === 0)
        return (
            <p className="text-sm text-secondary-400">
                {t('SiglensApiKeySection.empty')}
            </p>
        );
    return (
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
    );
}

/**
 * `/account`의 "시그렌즈 API" 섹션 — 키 발급(원문 1회 노출)·목록·폐기, API 기본 모델 슬롯,
 * 시작 가이드. 목록과 상한 판단의 근거는 서버가 props로 내려 주고, 발급·폐기 결과는
 * `useSiglensApiKeyForms`의 액션 상태로 받는다.
 */
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
    const nameInputRef = useRef<HTMLInputElement>(null);
    const { createState, createFormAction, revokeState, revokeFormAction } =
        useSiglensApiKeyForms();
    const { revealedKey, revealId, dismiss } = useRevealedKey(createState);
    const revokeStatusRef = useRevokeStatusFocus(revokeState);

    const activeCount = keys?.length ?? 0;
    const limitReached = keys !== null && activeCount >= maxKeys;

    // "보관했어요"를 누르면 그 버튼이 패널과 함께 사라진다 — 다음 키 이름을 적을 입력칸으로 보낸다.
    const handleDismiss = () => {
        dismiss();
        nameInputRef.current?.focus();
    };

    return (
        <div className="space-y-4" data-testid="siglens-api-key-section">
            <div>
                <h2 className={HEADING_SECTION}>
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
                    key={revealId}
                    rawKey={revealedKey}
                    onDismiss={handleDismiss}
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
                nameInputRef={nameInputRef}
            />

            <KeyList keys={keys} revokeFormAction={revokeFormAction} />

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
