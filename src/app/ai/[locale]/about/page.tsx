import type { Metadata } from 'next';
import { getPublishedBenchmarkRelease } from '@/entities/benchmark/release';
import { resolveLocale } from '@/shared/i18n/locales';
import { enterLocale } from '@/shared/lib/enterLocale';
import { buildFaqJsonLd, SITE_URL } from '@/shared/lib/seo';
import { JsonLd } from '@/shared/ui/JsonLd';
import { AiAboutPage } from '@/views/ai-about/AiAboutPage';
import {
    getAboutFaq,
    getAboutSeoCopy,
} from '@/views/ai-about/lib/aboutContent';
import { buildAiAboutMetadata } from '../_lib/aiSeo';
import { localePrefixOf } from '../_lib/localePrefix';

export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const locale = resolveLocale((await params).locale);
    return buildAiAboutMetadata(locale, await getAboutSeoCopy(locale));
}

/**
 * `ai.siglens.io/about`. `/`·`/c/[id]`와 달리 SSO 핸드오프를 하지 않는다: 계정별로 달라지는
 * 내용이 없고, 채팅으로 들어가는 길은 `/`로 이어져 거기서 핸드오프가 돈다.
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
                localePrefix={localePrefixOf(locale)}
                faq={faq}
                benchmark={getPublishedBenchmarkRelease()}
            />
        </>
    );
}
