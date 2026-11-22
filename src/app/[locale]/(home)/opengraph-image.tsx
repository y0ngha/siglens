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
// `alt`는 Next가 모듈 스코프 상수로 요구해 로케일별로 낼 수 없다(이미지 본문은 아래에서
// 로케일별로 그린다) — 네 로케일이 공유할 영어로 둔다.
export const alt = 'SIGLENS price-level map for stocks and crypto';

interface Props {
    params: Promise<{ locale: string }>;
}

/**
 * 홈(`/`)의 공유 카드 이미지. 사이트 공용 `public/og-image.png`는 지금 제품이 하지 않는
 * 문구가 박혀 있어 홈만 코드로 그린 카드를 쓴다. 문구는 이미 카탈로그에 있는 두 줄이다.
 * 큰 제목은 `app.home` `page.headline`(홈 히어로 H1과 같은 가격대 지도 문구), 부제는
 * `shared.seo` `root.headline`(검색 결과와 구조화 데이터가 쓰는 "무엇을 하는 서비스인가"
 * 한 줄 정의, 홈 제목과 구분되는 headline)이다. 카드·페이지·검색 결과가 같은 말을 하게 한다.
 */
export default async function Image({ params }: Props) {
    // 로케일을 넘기지 않으면 `getTranslations`가 요청 스코프를 못 찾아 기본
    // 로케일로 떨어진다 — `force-static`이라 조용히 전 로케일이 한국어 이미지가 된다.
    const { locale: rawLocale } = await params;
    const locale = resolveLocale(rawLocale);
    const [tHome, tSeo] = await Promise.all([
        getTranslations({ locale, namespace: 'app.home' }),
        getTranslations({ locale, namespace: 'shared.seo' }),
    ]);
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
                {tHome('page.headline')}
            </div>
            <div
                style={{
                    marginTop: OG_LABEL_MARGIN_TOP,
                    fontSize: OG_SUBTITLE_FONT_SIZE,
                    color: OG_ACCENT,
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                    lineHeight: 1.3,
                    display: 'flex',
                    textAlign: 'center',
                }}
            >
                {tSeo('root.headline')}
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
