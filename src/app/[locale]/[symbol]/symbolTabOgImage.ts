import { getTranslations } from 'next-intl/server';
import { buildSymbolOgImage } from '@/entities/og-image/lib/buildSymbolOgImage';
import { resolveLocale } from '@/shared/i18n/locales';
import type { SeoTranslator } from '@/shared/lib/seo';

/** 종목 탭 `opengraph-image.tsx`가 받는 라우트 파라미터. */
export interface SymbolTabOgImageProps {
    params: Promise<{ locale: string; symbol: string }>;
}

/**
 * 종목 탭 OG 이미지 본체 — 탭마다 다른 것은 라벨 한 줄뿐이다.
 *
 * 라벨은 라우트 파일이 `app.symbol` 번역자로 직접 고른다(`t => t('…')`). 키
 * 리터럴이 각 라우트 파일에 남아 있어야 어느 탭이 어느 문구를 쓰는지 한눈에
 * 보인다.
 *
 * 로케일을 넘기지 않으면 `getTranslations`가 요청 스코프를 못 찾아 기본
 * 로케일로 떨어진다 — `force-static`이라 조용히 전 로케일이 한국어 이미지로
 * 통일된다(실측: /AAPL·/en/AAPL·/ja/AAPL이 바이트 동일).
 */
export async function renderSymbolTabOgImage(
    params: SymbolTabOgImageProps['params'],
    label: (t: SeoTranslator) => string
) {
    const { locale: rawLocale, symbol } = await params;
    const locale = resolveLocale(rawLocale);
    const t = await getTranslations({ locale, namespace: 'app.symbol' });
    return buildSymbolOgImage({
        ticker: symbol.toUpperCase(),
        label: label(t),
        locale,
    });
}
