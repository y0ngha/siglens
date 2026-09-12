import { useTranslations } from 'next-intl';
import Link from 'next/link';

export default function AiNotFound() {
    const t = useTranslations('app.ai');
    return (
        <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center justify-center gap-3 px-4 text-center">
            <h1 className="text-xl font-semibold text-secondary-100">
                {t('not-found.047c35')}
            </h1>
            <Link
                href="/"
                className="text-primary-400 underline focus-visible:ring-2 focus-visible:ring-primary-500"
            >
                {t('not-found.04598e')}
            </Link>
        </main>
    );
}
