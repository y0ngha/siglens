import { getTranslations } from 'next-intl/server';
import { buildManifest } from '@/shared/lib/buildManifest';
import { DEFAULT_LOCALE, isLocale, LOCALES } from '@/shared/i18n/locales';

/** 로케일별 매니페스트는 정적으로 굽는다 — 요청마다 만들 이유가 없다. */
export function generateStaticParams() {
    return LOCALES.map(locale => ({ locale }));
}

export const dynamic = 'force-static';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ locale: string }> }
) {
    const { locale: raw } = await params;
    const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
    const t = await getTranslations({
        locale,
        namespace: 'shared.seo.manifest',
    });
    return Response.json(buildManifest(locale, t), {
        headers: { 'content-type': 'application/manifest+json' },
    });
}
