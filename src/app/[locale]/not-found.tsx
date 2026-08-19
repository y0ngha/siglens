import { useTranslations } from 'next-intl';
import type { Metadata } from 'next';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { SITE_NAME } from '@/shared/lib/seo';
import { ContactDialog } from '@/widgets/layout/ContactDialog';
import { TickerCategories } from '@/widgets/home';

export const metadata: Metadata = {
    title: '페이지를 찾을 수 없습니다',
    robots: { index: false, follow: true },
};

export default function NotFound() {
    const t = useTranslations('app.home');
    return (
        <>
            <main className="flex flex-1 flex-col">
                <div className="flex flex-col items-center px-6 py-20 text-center">
                    <p className="font-mono text-sm tracking-widest text-primary-400">
                        404
                    </p>
                    <h1 className="mt-4 text-2xl font-bold text-secondary-100 sm:text-3xl">
                        {t('not-found.6cbd6d')}
                    </h1>
                    <p className="mt-3 max-w-md text-sm leading-relaxed text-secondary-400">
                        {t('not-found.03ecab')}
                    </p>

                    <Link
                        href="/"
                        className="mt-8 rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
                    >
                        {t('not-found.ba81f0', { v0: SITE_NAME })}
                    </Link>

                    <div className="mt-10 border-t border-secondary-800 pt-8">
                        <p className="text-sm text-secondary-400">
                            {t('not-found.f4b235')}
                        </p>
                        <p className="mt-1 text-xs text-secondary-600">
                            {t('not-found.f8a2cd')}
                        </p>
                        <ContactDialog
                            triggerLabel={t('not-found.4da438')}
                            triggerClassName="text-primary-400 hover:text-primary-300 mt-3 inline-block text-xs transition-colors"
                        />
                    </div>
                </div>
                <TickerCategories />
            </main>
        </>
    );
}
