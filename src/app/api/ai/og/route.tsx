import { getTranslations } from 'next-intl/server';
import { buildSymbolOgImage } from '@/entities/og-image';
import { DEFAULT_LOCALE, isLocale } from '@/shared/i18n/locales';

/**
 * Share card for the SiglensAI landing. A route handler rather than an
 * `opengraph-image` file: file-convention image URLs are built from the
 * internal `/ai/[locale]` path, which the ai host's rewrite would double
 * (`/ai/ko/ai/ko/...`) and the main host 301s away. `/api` is outside the
 * proxy matcher, so this path is identical on both hosts.
 */
export async function GET(request: Request): Promise<Response> {
    const raw = new URL(request.url).searchParams.get('locale') ?? '';
    const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
    const t = await getTranslations({ locale, namespace: 'app.ai' });
    return buildSymbolOgImage({
        ticker: 'SIGLENS AI',
        label: t('seo.ogLabel'),
    });
}
