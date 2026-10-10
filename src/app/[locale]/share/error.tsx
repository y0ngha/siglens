'use client';

import { useTranslations } from 'next-intl';
import { useCurrentLocale } from '@/shared/i18n/LocaleContext';
import { brandName } from '@/shared/lib/brandName';
import { RouteErrorView } from '@/app/_components/RouteErrorView';

interface ShareErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

/**
 * Error boundary for the `/share/[id]` subtree.
 *
 * Any uncaught render error inside the share page — e.g. an unexpected
 * snapshot shape or a rendering failure in a kind panel — degrades to this
 * branded screen instead of the generic root error.
 */
export default function ShareError({ error, reset }: ShareErrorProps) {
    const t = useTranslations('app.share');
    const locale = useCurrentLocale();
    return (
        <RouteErrorView
            error={error}
            reset={reset}
            logTag="ShareRoute"
            eyebrow={t('error.729779')}
            title={t('error.3cf233')}
            body={t('error.1dedc8', { v0: brandName(locale) })}
            retryLabel={t('error.0c767c')}
            homeLabel={t('error.eb2523', { v0: brandName(locale) })}
        />
    );
}
