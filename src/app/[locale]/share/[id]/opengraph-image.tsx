import { getTranslations } from 'next-intl/server';
import { DEFAULT_LOCALE, isLocale } from '@/shared/i18n/locales';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import { buildSymbolOgImage } from '@/entities/og-image';
import { getCachedSharedAnalysis } from '@/entities/shared-analysis/actions/getCachedSharedAnalysis';
import { kindLabel } from '@/widgets/share';

// 공유 스냅샷은 id마다 달라 정적 생성 불가 → force-dynamic
export const dynamic = 'force-dynamic';

/**
 * 심볼 OG 이미지와 달리 **CDN에 장기 보관하지 않는다**.
 *
 * 이 이미지는 공유 스냅샷의 존재 여부에 따라 내용이 바뀐다(유효 → 만료 시 "만료된 공유"로
 * 전환). 엣지에 며칠씩 남으면 이미 만료된 공유가 계속 정상 카드로 노출된다.
 * `ImageResponse`의 원래 기본값을 그대로 유지해 매 요청 재검증시킨다.
 */
const SHARE_OG_CACHE_CONTROL = 'public, max-age=0, must-revalidate';

export const size = { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT };
export const contentType = 'image/png';
export const alt = 'Siglens AI 분석 공유';

interface Props {
    params: Promise<{ locale: string; id: string }>;
}

export default async function Image({ params }: Props) {
    // 로케일을 넘기지 않으면 `getTranslations`가 요청 스코프를 못 찾아 기본
    // 로케일로 떨어진다 — `force-static`이라 조용히 전 로케일이 한국어 이미지로
    // 통일된다(실측: /AAPL·/en/AAPL·/ja/AAPL이 바이트 동일).
    const { id, locale } = await params;
    const t = await getTranslations({
        locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
        namespace: 'app.share',
    });
    const lookup = await getCachedSharedAnalysis(id);

    if (lookup.status === 'found') {
        const { snapshot } = lookup;
        return buildSymbolOgImage({
            ticker: snapshot.symbol.toUpperCase(),
            label: kindLabel(snapshot.kind),
            cacheControl: SHARE_OG_CACHE_CONTROL,
        });
    }

    return buildSymbolOgImage({
        ticker: 'SIGLENS',
        label: t('opengraph-image.ce34e2'),
        cacheControl: SHARE_OG_CACHE_CONTROL,
    });
}
