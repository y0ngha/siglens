import { localePath, type Locale } from '@/shared/i18n/locales';
import { SITE_URL } from '@/shared/lib/seo';

/**
 * Public URL of a share snapshot. The sharer's locale is kept in the path so
 * the recipient opens the link in the language it was shared from.
 */
export function buildShareUrl(locale: Locale, shareId: string): string {
    return `${SITE_URL}${localePath(locale, `/share/${shareId}`)}`;
}
