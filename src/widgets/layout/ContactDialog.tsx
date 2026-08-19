'use client';

import { useTranslations } from 'next-intl';
import { ContactForm } from '@/features/contact-form';
import { useDialog } from '@/shared/hooks/useDialog';
import { cn } from '@/shared/lib/cn';

const TRIGGER_BASE_CLASS =
    'rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500';

interface ContactDialogProps {
    triggerLabel?: string;
    triggerClassName?: string;
}

export function ContactDialog({
    triggerLabel = '문의하기',
    triggerClassName,
}: ContactDialogProps) {
    const t = useTranslations('widgets.layout');
    const { isOpen, open, close, dialogRef, triggerRef } = useDialog();

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={open}
                className={cn(TRIGGER_BASE_CLASS, triggerClassName)}
            >
                {triggerLabel}
            </button>

            {/* 네이티브 모달: 포커스 트랩·Esc·비활성 배경이 브라우저 기본 동작이고,
                배경 클릭 닫기는 useDialog가 dialog에 직접 리스너를 붙여 처리한다. */}
            <dialog
                ref={dialogRef}
                aria-labelledby="contact-dialog-title"
                onClose={close}
                className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-xl border border-secondary-700 bg-secondary-800 p-0 text-left shadow-2xl backdrop:bg-secondary-950/80 backdrop:backdrop-blur-sm"
            >
                {isOpen && (
                    <div>
                        <div className="flex items-start justify-between border-b border-secondary-700 px-6 py-5">
                            <div>
                                <h2
                                    id="contact-dialog-title"
                                    className="text-base font-semibold text-secondary-100"
                                >
                                    {t('ContactDialog.531f6a')}
                                </h2>
                                <p className="mt-1 text-sm text-secondary-400">
                                    {t('ContactDialog.79bb9f')}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={close}
                                aria-label={t('ContactDialog.94b7db')}
                                className="-mt-1 -mr-1 rounded p-1 text-secondary-400 transition-colors hover:text-secondary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-6">
                            <ContactForm />
                        </div>
                    </div>
                )}
            </dialog>
        </>
    );
}
