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
} from '@/shared/lib/og';
import { SITE_NAME } from '@/shared/lib/seo';

export const dynamic = 'force-static';
export const revalidate = 2592000; // 30d
export const size = { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT };
export const contentType = 'image/png';
export const alt = 'Siglens 마켓 뉴스 허브';

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
                마켓 뉴스 허브
            </div>
            <div
                style={{
                    marginTop: OG_LABEL_MARGIN_TOP,
                    fontSize: 40,
                    color: OG_ACCENT,
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                    display: 'flex',
                }}
            >
                미국 일반·주식·암호화폐·외환·아티클
            </div>
        </div>,
        {
            width: OG_IMAGE_WIDTH,
            height: OG_IMAGE_HEIGHT,
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
