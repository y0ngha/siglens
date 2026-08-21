import { useTranslations } from 'next-intl';
export function ContactSubmittedNotice() {
    const t = useTranslations('features.contact-form');
    return (
        <div
            role="status"
            aria-live="polite"
            className="space-y-2 rounded-md border border-secondary-800 bg-secondary-900/60 p-4 text-sm"
        >
            <p className="font-semibold text-secondary-100">
                {t('ContactSubmittedNotice.820d69')}
            </p>
            <p className="text-secondary-300">
                {t('ContactSubmittedNotice.5483d6')}
            </p>
            <p className="text-secondary-300">
                {t('ContactSubmittedNotice.679be7')}
            </p>
        </div>
    );
}
