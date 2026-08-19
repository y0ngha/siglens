import { ImageResponse } from 'next/og';
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
// 30d — route segment config는 정적 분석 가능한 리터럴이어야 한다(식/import 상수로 추출하면
// Next가 값을 분석 못 해 config를 조용히 무시 → ISR 무효화). app/CLAUDE.md ISR §·MISTAKES §15
// 예외 규칙에 따라 리터럴 유지(기존 `[symbol]/congress/opengraph-image.tsx`와 동일 패턴).
export const revalidate = 2592000;
export const size = { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT };
export const contentType = 'image/png';
// `/news`는 2026-08부터 미국 허브가 아니라 3지역 허브다. 미국 전용 문구는
// `/news/us`가 가져갔다 — 여기 남으면 공유 카드가 페이지 제목과 정면으로 어긋난다.
export const alt = 'Siglens 시장 뉴스 허브';

export default async function Image() {
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
                시장 뉴스 허브
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
                미국 · 한국 · 암호화폐
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
