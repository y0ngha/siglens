import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { resolveLocale } from '@/shared/i18n/locales';
import { SYMBOLS_PATH } from '@/shared/lib/seo';
import {
    localeAlternatesFrom,
    localePageRobots,
    localePageSocial,
} from '@/shared/lib/seoAlternates';
import {
    symbolsDescription,
    symbolsFullTitle,
    symbolsTitle,
} from './symbolsSeo';

/** `/symbols` 라우트의 `generateMetadata` 본체. */
export async function buildSymbolsMetadata(
    params: Promise<{ locale: string }>
): Promise<Metadata> {
    const locale = resolveLocale((await params).locale);
    const tSeo = await getTranslations({
        locale,
        namespace: 'shared.seo',
    });
    return {
        title: symbolsTitle(tSeo),
        description: symbolsDescription(tSeo),
        // canonical은 넘기지 않는다 — `localeAlternatesFrom`이 로케일별 자기참조
        // URL을 만든다(ko 절대 URL을 넘기면 `/en/…`이 ko를 가리켜 hreflang 상호참조가
        // 깨진다).
        alternates: await localeAlternatesFrom(params, SYMBOLS_PATH),
        robots: localePageRobots(locale),
        // 소셜 카드는 `localePageSocial`로 통째로 선언한다 — `og:url`이 canonical과
        // 같은 로케일별 URL이 되고(`/en/symbols`가 ko URL을 가리키지 않게), 정적
        // `/og-image.png`도 함께 실린다. 실측으로 이 라우트만 `og:image`가 없었다 — 이미지를
        // 아예 안 주면 공유 카드가 텅 빈 채로 나간다.
        ...localePageSocial(locale, SYMBOLS_PATH, {
            title: symbolsFullTitle(tSeo, locale),
            description: symbolsDescription(tSeo),
        }),
    };
}
