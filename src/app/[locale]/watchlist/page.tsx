import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { resolveLocale } from '@/shared/i18n/locales';
import { enterLocale } from '@/shared/lib/enterLocale';
import { localeCanonical, localePageSocial } from '@/shared/lib/seoAlternates';
import { WatchlistShell } from '@/app/[locale]/watchlist/_components/WatchlistShell';

/**
 * `generateMetadata`인 이유는 `/portfolio`와 같다 — 정적 객체는 로케일을 못 봐서 `/en/watchlist`의
 * canonical이 한국어 경로로 나간다. noindex 페이지라도 canonical·og:url을 자기 자신으로 둔다.
 */
export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale: rawLocale } = await params;
    const locale = resolveLocale(rawLocale);
    const tSeo = await getTranslations({ locale, namespace: 'shared.seo' });
    const title = tSeo('watchlist.title');
    const description = tSeo('watchlist.description');
    return {
        title,
        description,
        alternates: { canonical: localeCanonical(locale, '/watchlist') },
        ...localePageSocial(locale, '/watchlist', { title, description }),
        // 개인화 서페이스라 색인 대상이 아니다 — 목록이 방문자(계정·기기)마다 다르다.
        robots: { index: false, follow: false },
    };
}

/** 관심종목 페이지. 비회원에게도 열린다. 보유종목은 `/portfolio`가 따로 맡는다. */
export default async function WatchlistPage({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;
    enterLocale(rawLocale);
    return <WatchlistShell />;
}
