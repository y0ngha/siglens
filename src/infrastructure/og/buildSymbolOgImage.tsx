import { ImageResponse } from 'next/og';
import { SITE_NAME } from '@/shared/lib/seo';
import {
    OG_ACCENT,
    OG_BG,
    OG_CONTAINER_PADDING,
    OG_FG,
    OG_IMAGE_HEIGHT,
    OG_IMAGE_WIDTH,
    OG_LABEL_FONT_SIZE,
    OG_LABEL_MARGIN_TOP,
    OG_MUTED,
    OG_SITE_NAME_FONT_SIZE,
    OG_SITE_NAME_RIGHT,
    OG_SITE_NAME_TOP,
    OG_TICKER_FONT_SIZE,
} from '@/shared/lib/og';
import { loadKoreanFont } from '@/infrastructure/og/loadKoreanFont';

export interface SymbolOgImageOptions {
    ticker: string;
    label: string;
}

export async function buildSymbolOgImage({
    ticker,
    label,
}: SymbolOgImageOptions): Promise<ImageResponse> {
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
                    fontSize: OG_TICKER_FONT_SIZE,
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
                    marginTop: OG_LABEL_MARGIN_TOP,
                    fontSize: OG_LABEL_FONT_SIZE,
                    color: OG_ACCENT,
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    display: 'flex',
                }}
            >
                {label}
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
