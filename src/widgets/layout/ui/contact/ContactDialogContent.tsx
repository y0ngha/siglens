'use client';

import { useTranslations } from 'next-intl';
import { ContactForm } from '@/features/contact-form/ui/ContactForm';
import { CloseIcon } from '@/shared/ui/StrokeIcons';

/** 다이얼로그 제목 요소 id. `<dialog>`의 `aria-labelledby`가 가리킨다. */
export const CONTACT_DIALOG_TITLE_ID = 'contact-dialog-title';

interface ContactDialogContentProps {
    readonly onClose: () => void;
}

/** 문의 다이얼로그의 내용 — 제목·설명·닫기 버튼과 문의 폼. 열려 있는 동안에만 마운트된다. */
export function ContactDialogContent({ onClose }: ContactDialogContentProps) {
    const t = useTranslations('widgets.layout');
    return (
        <div>
            <div className="flex items-start justify-between border-b border-secondary-700 px-6 py-5">
                <div>
                    <h2
                        id={CONTACT_DIALOG_TITLE_ID}
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
                    onClick={onClose}
                    aria-label={t('ContactDialog.94b7db')}
                    className="-mt-1 -mr-1 rounded p-1 text-secondary-400 transition-colors hover:text-secondary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    <CloseIcon />
                </button>
            </div>

            <div className="p-6">
                <ContactForm />
            </div>
        </div>
    );
}
