'use client';

import { useTranslations } from 'next-intl';
import { SITE_NAME } from '@/shared/lib/seo';
import { RouteErrorView } from '@/app/_components/RouteErrorView';

interface RootErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

/**
 * Root error boundary — covers `/`, `/backtesting`, `/privacy`, `/terms`,
 * `/account*`, `/signup*`, `/forgot-password`, `/reset-password`.
 *
 * Sits one level above route-specific boundaries (market/error.tsx,
 * economy/error.tsx). Catches interactive client-side throws that escape
 * those nested boundaries and presents a branded, retryable UI instead of
 * a blank page. `reset()` re-renders the failed segment in place.
 */
export default function RootError({ error, reset }: RootErrorProps) {
    const t = useTranslations('app.home');
    return (
        <RouteErrorView
            error={error}
            reset={reset}
            logTag="RootRoute"
            eyebrow={t('error.729779')}
            title={t('error.80dac7')}
            body={t('error.32c8a0')}
            retryLabel={t('error.0c767c')}
            homeLabel={t('error.eb2523', { v0: SITE_NAME })}
        />
    );
}
