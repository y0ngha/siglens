'use client';

import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { useTranslations } from 'next-intl';
import type { CreateSiglensApiKeyState } from '@/entities/siglens-api-key/model';
import { API_KEY_NAME_MAX_LENGTH } from '@/shared/config/publicApi';
import { BUTTON_PRIMARY } from '@/shared/lib/buttonStyles';
import { cn } from '@/shared/lib/cn';
import { ByokRequiredModal } from './ByokRequiredModal';
import { SubmitButton } from './SubmitButton';

interface CreateKeyFormProps {
    createState: CreateSiglensApiKeyState;
    createFormAction: (formData: FormData) => void;
    emailVerified: boolean;
    limitReached: boolean;
    maxKeys: number;
    /** 등록한 BYOK LLM 키가 하나라도 있는가. 없으면 발급 전에 확인 모달을 연다. */
    hasByokKey: boolean;
    /** 이동할 BYOK 섹션의 DOM id(`#` 없이). */
    byokSectionId: string;
}

/**
 * 확인 모달을 통과한 제출. 제출 버튼을 submitter로 넘겨 실제 클릭 제출과 같은 경로(폼 액션)를 탄다.
 * 제출 이벤트는 동기로 돌아 `handleSubmit`이 우회 플래그를 소비한다 — 제출이 일어나지 못해도
 * 우회가 무장된 채 남지 않도록 항상 해제한다.
 */
function submitConfirmed(
    form: HTMLFormElement,
    submitter: HTMLButtonElement,
    confirmedRef: { current: boolean }
): void {
    confirmedRef.current = true;
    try {
        form.requestSubmit(submitter);
    } finally {
        confirmedRef.current = false;
    }
}

/** 이름 입력 + 발급 버튼 + 상태 영역(오류·이메일 인증 안내·상한 안내). */
export function CreateKeyForm({
    createState,
    createFormAction,
    emailVerified,
    limitReached,
    maxKeys,
    hasByokKey,
    byokSectionId,
}: CreateKeyFormProps) {
    const t = useTranslations('features.siglens-api-key-management');
    const createBlocked = !emailVerified || limitReached;
    const formRef = useRef<HTMLFormElement>(null);
    const submitRef = useRef<HTMLButtonElement>(null);
    // 모달에서 "데이터 도구만 쓸게요, 키 만들기"를 고른 제출은 확인을 다시 묻지 않고 통과시킨다.
    const confirmedRef = useRef(false);
    const [modalOpen, setModalOpen] = useState(false);
    const afterCloseRef = useRef<'submit' | 'jump' | null>(null);

    const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
        if (hasByokKey) return;
        if (confirmedRef.current) {
            confirmedRef.current = false;
            return;
        }
        event.preventDefault();
        setModalOpen(true);
    };

    const createAnyway = () => {
        afterCloseRef.current = 'submit';
        setModalOpen(false);
    };

    const goToByok = () => {
        afterCloseRef.current = 'jump';
        setModalOpen(false);
    };

    // 모달이 닫힌 다음에 실행한다 — 포커스 트랩이 닫히면서 트리거(발급 버튼)로 포커스를 되돌리는데,
    // 클릭 핸들러 안에서 먼저 옮기면 그 복원이 덮어쓴다. effect는 그 정리 뒤에 돈다. 제출도 같은
    // 시점에 해서 클릭 핸들러 안에 중첩 제출 이벤트를 만들지 않는다. 취소(Escape·닫기)는 `null`.
    useEffect(() => {
        if (modalOpen) return;
        const next = afterCloseRef.current;
        afterCloseRef.current = null;
        if (next === 'submit') {
            const form = formRef.current;
            const submitter = submitRef.current;
            if (form === null || submitter === null) return;
            submitConfirmed(form, submitter, confirmedRef);
        } else if (next === 'jump') {
            const section = document.getElementById(byokSectionId);
            if (section === null) return;
            section.scrollIntoView({ block: 'start' });
            section.focus({ preventScroll: true });
        }
    }, [modalOpen, byokSectionId]);

    return (
        <>
            <form
                ref={formRef}
                action={createFormAction}
                onSubmit={handleSubmit}
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
                    buttonRef={submitRef}
                    label={t('SiglensApiKeySection.createButton')}
                    pendingLabel={t('SiglensApiKeySection.creating')}
                    disabled={createBlocked}
                    className={cn(BUTTON_PRIMARY, 'h-10 shrink-0 px-4 text-sm')}
                />
            </form>
            {modalOpen && (
                <ByokRequiredModal
                    onClose={() => setModalOpen(false)}
                    onGoToByok={goToByok}
                    onCreateAnyway={createAnyway}
                />
            )}
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
                {emailVerified && !limitReached && !hasByokKey && (
                    <span className="text-ui-warning-text">
                        {t('SiglensApiKeySection.byokNotice')}
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
        </>
    );
}
