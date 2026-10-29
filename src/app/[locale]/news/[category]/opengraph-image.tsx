import { ImageResponse } from 'next/og';
import { getTranslations } from 'next-intl/server';
import {
    CATEGORY_CONFIG,
    categoryFromSlug,
} from '@/entities/market-news/lib/categoryConfig';
import { loadOgFont } from '@/entities/og-image/lib/loadOgFont';
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
// 30d — route segment config는 리터럴 유지(src/app/CLAUDE.md#AP-1).
export const revalidate = 2592000;
/** 사이트 공용 OG 규격(1200×630) — 소셜 카드가 큰 이미지로 잡히는 크기. */
export const size = { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT };
/** `ImageResponse`가 내는 형식과 같아야 `og:image:type`이 실제 응답과 맞는다. */
export const contentType = 'image/png';
// `alt`는 `/news/kr`·`/news/crypto`까지 모든 카테고리에 붙는 정적 문자열이라 지역을 박으면
// 한국·암호화폐 페이지가 자기를 미국이라고 말하게 된다(이미지 본문은 카테고리마다 갈린다).
// Next가 **모듈 스코프 상수**로 요구해 로케일별로 낼 수 없으므로 네 로케일이 공유할 영어로 둔다.
export const alt = 'SIGLENS market news';

interface Props {
    params: Promise<{ locale: string; category: string }>;
}

/** 카테고리 페이지의 공유 카드 이미지 — 카테고리 라벨을 그리고, 모르는 slug면 일반 라벨로 대신한다. */
export default async function Image({ params }: Props) {
    // 로케일을 넘기지 않으면 `getTranslations`가 요청 스코프를 못 찾아 기본
    // 로케일로 떨어진다 — `force-static`이라 조용히 전 로케일이 한국어 이미지가 된다.
    const { category: slug, locale: rawLocale } = await params;
    const locale = resolveLocale(rawLocale);
    const tRoot = await getTranslations({ locale });
    const cat = categoryFromSlug(slug);
    // `koLabel`은 AI 프롬프트 입력이라 전 로케일 한국어다 — 라벨은 로케일 카탈로그에서
    // 읽는다. ja/zh 폰트(Noto Sans JP/SC)엔 한글이 없어 `koLabel`이면 빈 네모가 된다.
    const label = cat
        ? tRoot(CATEGORY_CONFIG[cat].labelKey)
        : tRoot('app.news.opengraph-image.91dd85');

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
                {tRoot('app.news.opengraph-image.3a465d')}
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
