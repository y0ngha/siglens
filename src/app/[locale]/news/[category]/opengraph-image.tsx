import { getTranslations } from 'next-intl/server';
import { DEFAULT_LOCALE, isLocale } from '@/shared/i18n/locales';
import { ImageResponse } from 'next/og';
import { CATEGORY_CONFIG, categoryFromSlug } from '@/entities/market-news';
import { loadKoreanFont } from '@/entities/og-image/lib/loadKoreanFont';
import {
    OG_BG,
    OG_FG,
    OG_ACCENT,
    OG_MUTED,
    OG_IMAGE_WIDTH,
    OG_IMAGE_HEIGHT,
    OG_CONTAINER_PADDING,
    OG_SITE_NAME_FONT_SIZE,
    OG_SITE_NAME_TOP,
    OG_SITE_NAME_RIGHT,
    OG_LABEL_FONT_SIZE,
    OG_LABEL_MARGIN_TOP,
    OG_SUBTITLE_FONT_SIZE,
    OG_IMAGE_CACHE_CONTROL,
} from '@/shared/lib/og';
import { SITE_NAME } from '@/shared/lib/seo';

export const dynamic = 'force-static';
export const revalidate = 2592000; // 30d
export const size = { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT };
export const contentType = 'image/png';
// 이 파일은 `/news/kr`·`/news/crypto`까지 모든 카테고리에 붙는 정적 문자열이라
// 지역을 박으면 한국·암호화폐 페이지가 자기를 미국이라고 말하게 된다.
// 이미지 본문은 `CATEGORY_CONFIG[cat].koLabel`로 카테고리마다 갈린다.
// `alt`는 Next가 **모듈 스코프 상수**로 요구해 로케일별로 낼 수 없다(이미지
// 본문은 아래에서 로케일별로 그린다). 네 로케일이 한 값을 공유해야 하므로
// 한국어 대신 영어로 둔다 — 예전엔 한국어라 `/en/…` 공유 카드의 alt만 한국어였다.
export const alt = 'Siglens — market news';

interface Props {
    params: Promise<{ locale: string; category: string }>;
}

export default async function Image({ params }: Props) {
    // 로케일을 넘기지 않으면 `getTranslations`가 요청 스코프를 못 찾아 기본
    // 로케일로 떨어진다 — `force-static`이라 조용히 전 로케일이 한국어 이미지로
    // 통일된다(실측: /AAPL·/en/AAPL·/ja/AAPL이 바이트 동일).
    const { category: slug, locale } = await params;
    const t = await getTranslations({
        locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
        namespace: 'app.news',
    });
    const cat = categoryFromSlug(slug);
    const label = cat
        ? CATEGORY_CONFIG[cat].koLabel
        : t('opengraph-image.91dd85');

    const fontData = await loadKoreanFont();

    return new ImageResponse(
        <div
            style={{
                width: '100%',
                height: '100%',
                background: OG_BG,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: OG_CONTAINER_PADDING,
                position: 'relative',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    top: OG_SITE_NAME_TOP,
                    right: OG_SITE_NAME_RIGHT,
                    fontSize: OG_SITE_NAME_FONT_SIZE,
                    color: OG_MUTED,
                    letterSpacing: '0.04em',
                    display: 'flex',
                }}
            >
                {SITE_NAME}
            </div>
            <div
                style={{
                    fontSize: OG_LABEL_FONT_SIZE,
                    color: OG_FG,
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    lineHeight: 1.2,
                    display: 'flex',
                    textAlign: 'center',
                }}
            >
                {label}
            </div>
            <div
                style={{
                    marginTop: OG_LABEL_MARGIN_TOP,
                    fontSize: OG_SUBTITLE_FONT_SIZE,
                    color: OG_ACCENT,
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                    display: 'flex',
                }}
            >
                {t('opengraph-image.3a465d')}
            </div>
        </div>,
        {
            width: OG_IMAGE_WIDTH,
            height: OG_IMAGE_HEIGHT,
            // ImageResponse 기본 헤더는 CDN 캐시를 막는다 — og.ts JSDoc 참조.
            headers: { 'cache-control': OG_IMAGE_CACHE_CONTROL },
            fonts: fontData
                ? [
                      {
                          name: 'Pretendard',
                          data: fontData,
                          style: 'normal',
                          weight: 700,
                      },
                  ]
                : undefined,
        }
    );
}
