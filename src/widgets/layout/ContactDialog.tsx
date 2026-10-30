'use client';

import { useTranslations } from 'next-intl';
import { useDialog } from '@/shared/hooks/useDialog';
import { cn } from '@/shared/lib/cn';
import { SURFACE_FLOATING } from '@/shared/lib/surfaceStyles';
import { useApplyStoredTheme } from './hooks/useApplyStoredTheme';
import {
    CONTACT_DIALOG_TITLE_ID,
    ContactDialogContent,
} from './ui/contact/ContactDialogContent';

const TRIGGER_BASE_CLASS =
    'rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500';

interface ContactDialogProps {
    triggerLabel?: string;
    triggerClassName?: string;
}

/**
 * 문의 폼을 여는 트리거 버튼 + 네이티브 모달 `<dialog>`.
 *
 * 네이티브 모달이라 포커스 트랩·Esc·비활성 배경이 브라우저 기본 동작이고, 배경 클릭 닫기는
 * `useDialog`가 dialog에 직접 리스너를 붙여 처리한다. 내용은 열려 있는 동안에만 마운트한다.
 */
export function ContactDialog({
    triggerLabel,
    triggerClassName,
}: ContactDialogProps) {
    const tMisc = useTranslations('shared.ui.misc');
    // 에러 셸 테마 보정을 얹어 둔 자리 — 이유와 제거 조건은 `useApplyStoredTheme` 참고.
    useApplyStoredTheme();
    const { isOpen, open, close, dialogRef, triggerRef } = useDialog();

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={open}
                className={cn(TRIGGER_BASE_CLASS, triggerClassName)}
            >
                {triggerLabel ?? tMisc('contact')}
            </button>

            <dialog
                ref={dialogRef}
                aria-labelledby={CONTACT_DIALOG_TITLE_ID}
                onClose={close}
                className={cn(
                    SURFACE_FLOATING,
                    'max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto p-0 text-left shadow-2xl backdrop:bg-secondary-950/80 backdrop:backdrop-blur-sm'
                )}
            >
                {isOpen && <ContactDialogContent onClose={close} />}
            </dialog>
        </>
    );
}
