import type { Metadata } from 'next';
import { localePath, resolveLocale } from '@/shared/i18n/locales';
import { buildFaqJsonLd, SITE_URL } from '@/shared/lib/seo';
import { JsonLd } from '@/shared/ui/JsonLd';
import { AiAboutPage } from '@/views/ai-about/AiAboutPage';
import {
    getAboutFaq,
    getAboutSeoCopy,
} from '@/views/ai-about/lib/aboutContent';
import { buildAiAboutMetadata } from '../aiSeo';
import { enterLocale } from '@/shared/lib/enterLocale';

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
 * page shows nothing account-specific. The ways into the chat lead to `/`,
 * which runs the handoff itself.
 */
export default async function AiAboutRoute({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const locale = enterLocale((await params).locale);
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
