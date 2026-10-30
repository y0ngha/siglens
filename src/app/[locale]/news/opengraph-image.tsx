import { ImageResponse } from 'next/og';
import { getTranslations } from 'next-intl/server';
import { loadOgFont } from '@/entities/og-image/server/loadOgFont';
import { SITE_NAME } from '@/shared/config/brand';
import { resolveLocale } from '@/shared/i18n/locales';
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

/** 정적화 — `cookies()/headers()/searchParams`만 비우고 `params`는 유지해 로케일별로 그린다(src/app/CLAUDE.md#AP-1). */
export const dynamic = 'force-static';
// 30d — route segment config는 정적 분석 가능한 리터럴이어야 한다(식/import 상수로 추출하면
// Next가 값을 분석 못 해 config를 조용히 무시 → ISR 무효화, src/app/CLAUDE.md#AP-1).
export const revalidate = 2592000;
/** 사이트 공용 OG 규격(1200×630) — 소셜 카드가 큰 이미지로 잡히는 크기. */
export const size = { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT };
/** `ImageResponse`가 내는 형식과 같아야 `og:image:type`이 실제 응답과 맞는다. */
export const contentType = 'image/png';
// `/news`는 3지역 허브라 지역을 말하지 않는다 — 미국 전용 문구가 들어가면 공유 카드가
// 페이지 제목과 어긋난다. `alt`는 Next가 **모듈 스코프 상수**로 요구해 로케일별로 낼 수
// 없으므로(이미지 본문은 아래에서 로케일별로 그린다) 네 로케일이 공유할 영어로 둔다.
export const alt = 'SIGLENS market news hub';

interface Props {
    params: Promise<{ locale: string }>;
}

/**
 * `/news` 허브와 `/news/us`(메타데이터가 이 이미지를 명시적으로 가리킨다)의 공유 카드 이미지.
 */
export default async function Image({ params }: Props) {
    // 로케일을 넘기지 않으면 `getTranslations`가 요청 스코프를 못 찾아 기본
    // 로케일로 떨어진다 — `force-static`이라 조용히 전 로케일이 한국어 이미지가 된다.
    const { locale: rawLocale } = await params;
    const locale = resolveLocale(rawLocale);
    const t = await getTranslations({ locale, namespace: 'app.news' });
    const font = await loadOgFont(locale);

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
                {t('opengraph-image.dc06c4')}
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
                {t('opengraph-image.4ad764')}
            </div>
        </div>,
        {
            width: OG_IMAGE_WIDTH,
            height: OG_IMAGE_HEIGHT,
            // ImageResponse 기본 헤더는 CDN 캐시를 막는다 — og.ts JSDoc 참조.
            headers: { 'cache-control': OG_IMAGE_CACHE_CONTROL },
            fonts: font ? [font] : undefined,
        }
    );
}
