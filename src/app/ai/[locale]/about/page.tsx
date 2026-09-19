import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { localePath, resolveLocale } from '@/shared/i18n/locales';
import { buildFaqJsonLd, SITE_URL } from '@/shared/lib/seo';
import { JsonLd } from '@/shared/ui/JsonLd';
import { AiAboutPage, getAboutFaq, getAboutSeoCopy } from '@/views/ai-about';
import { buildAiAboutMetadata } from '../aiSeo';

export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const locale = resolveLocale((await params).locale);
    return buildAiAboutMetadata(locale, await getAboutSeoCopy(locale));
}

/**
 * `ai.siglens.io/about`. No SSO handoff here (unlike `/` and `/c/[id]`): the
 * page shows nothing account-specific, and every way out of it leads to `/`,
 * which runs the handoff itself.
 */
export default async function AiAboutRoute({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const locale = resolveLocale((await params).locale);
    setRequestLocale(locale);
    const faq = await getAboutFaq(locale);
    return (
        <>
            <JsonLd data={buildFaqJsonLd(faq)} />
            <AiAboutPage
                locale={locale}
                siteUrl={SITE_URL}
                localePrefix={localePath(locale, '').replace(/\/$/, '')}
                faq={faq}
            />
        </>
    );
}
