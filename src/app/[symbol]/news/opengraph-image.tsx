import { ImageResponse } from 'next/og';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, SITE_NAME } from '@/lib/seo';
import { OG_ACCENT, OG_BG, OG_FG, OG_MUTED } from '@/lib/og';
import { loadKoreanFont } from '@/infrastructure/og/loadKoreanFont';

export const size = { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT };
export const contentType = 'image/png';
export const alt = 'Siglens 뉴스 분석';

interface Props {
    params: Promise<{ symbol: string }>;
}

export default async function Image({ params }: Props) {
    const { symbol } = await params;
    const ticker = symbol.toUpperCase();
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
                padding: '80px',
                position: 'relative',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    top: 56,
                    right: 72,
                    fontSize: 32,
                    color: OG_MUTED,
                    letterSpacing: '0.04em',
                    display: 'flex',
                }}
            >
                {SITE_NAME}
            </div>
            <div
                style={{
                    fontSize: 240,
                    color: OG_FG,
                    fontWeight: 700,
                    letterSpacing: '-0.04em',
                    lineHeight: 1,
                    display: 'flex',
                }}
            >
                {ticker}
            </div>
            <div
                style={{
                    marginTop: 32,
                    fontSize: 64,
                    color: OG_ACCENT,
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    display: 'flex',
                }}
            >
                뉴스 분석
            </div>
        </div>,
        {
            ...size,
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
