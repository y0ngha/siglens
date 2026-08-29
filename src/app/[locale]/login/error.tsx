'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { reportClientError } from '@/shared/lib/reportClientError';

interface LoginErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

export default function LoginError({ error, reset }: LoginErrorProps) {
    const t = useTranslations('app.login');
    useEffect(() => {
        console.error('[LoginRoute] render error:', error);
        reportClientError(error, 'LoginRoute', error.digest);
    }, [error]);

    return (
        <main className="flex min-h-[calc(100dvh-var(--header-h))] flex-col items-center justify-center gap-4 bg-secondary-950 px-4 py-12 text-center">
            <h1 className="text-2xl font-semibold text-secondary-50">
                {t('error.ff2e32')}
            </h1>
            <p className="text-sm text-secondary-400">{t('error.de45bd')}</p>
            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={reset}
                    className="inline-flex min-h-11 items-center rounded bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    {t('error.0c767c')}
                </button>
                <Link
                    href="/"
                    className="inline-flex min-h-11 items-center rounded px-4 text-sm font-medium text-secondary-200 hover:text-secondary-50 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    {t('error.d8c261')}
                </Link>
            </div>
        </main>
    );
}
