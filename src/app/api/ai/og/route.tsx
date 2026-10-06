import { getTranslations } from 'next-intl/server';
import { buildSymbolOgImage } from '@/entities/og-image/lib/buildSymbolOgImage';
import { resolveLocale } from '@/shared/i18n/locales';

/**
 * Share card for the SiglensAI landing. A route handler rather than an
 * `opengraph-image` file: file-convention image URLs are built from the
 * internal `/ai/[locale]` path, which the ai host's rewrite would double
 * (`/ai/ko/ai/ko/...`) and the main host 301s away. `/api` is outside the
 * proxy matcher, so this path is identical on both hosts.
 *
 * 메타데이터는 이제 정적·엣지 캐시되는 `/api/ai/og/<locale>.png`(`[file]/route.tsx`)를
 * 가리킨다. 이 쿼리스트링 경로는 이미 공유된 카드·미리보기 봇 캐시가 아직 들고 있어
 * 남겨 둔다(지우면 그 카드들이 깨진다).
 */
export async function GET(request: Request): Promise<Response> {
    const raw = new URL(request.url).searchParams.get('locale') ?? '';
    const locale = resolveLocale(raw);
    const t = await getTranslations({ locale, namespace: 'app.ai' });
    return buildSymbolOgImage({
        ticker: 'SIGLENS AI',
        label: t('seo.ogLabel'),
        locale,
    });
}
