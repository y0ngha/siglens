'use client';

import { ContactForm } from '@/components/contact/ContactForm';
import { useDialog } from '@/shared/hooks/useDialog';
import { cn } from '@/shared/lib/cn';

const TRIGGER_BASE_CLASS =
    'rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500';

interface ContactDialogProps {
    triggerLabel?: string;
    triggerClassName?: string;
}

export function ContactDialog({
    triggerLabel = '문의하기',
    triggerClassName,
}: ContactDialogProps) {
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

            {isOpen && (
                <div
                    className="bg-secondary-950/80 fixed inset-0 z-50 flex items-center justify-center overscroll-contain p-4 backdrop-blur-sm"
                    role="presentation"
                >
                    <div
                        ref={dialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="contact-dialog-title"
                        tabIndex={-1}
                        className="border-secondary-700 bg-secondary-800 max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-xl border text-left shadow-2xl outline-none"
                    >
                        <div className="border-secondary-700 flex items-start justify-between border-b px-6 py-5">
                            <div>
                                <h2
                                    id="contact-dialog-title"
                                    className="text-secondary-100 text-base font-semibold"
                                >
                                    문의하기
                                </h2>
                                <p className="text-secondary-400 mt-1 text-sm">
                                    의견이나 오류 제보를 남겨 주세요.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={close}
                                aria-label="닫기"
                                className="text-secondary-500 hover:text-secondary-300 focus-visible:ring-primary-500 -mt-1 -mr-1 rounded p-1 transition-colors focus-visible:ring-1 focus-visible:outline-none"
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
                </div>
            )}
        </>
    );
}
