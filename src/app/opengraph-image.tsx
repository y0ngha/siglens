import { ImageResponse } from 'next/og';
import {
    OG_IMAGE_HEIGHT,
    OG_IMAGE_WIDTH,
    SITE_DESCRIPTION,
    SITE_NAME,
} from '@/lib/seo';

export const runtime = 'edge';
export const alt = '미국 주식 AI 기술적 분석 플랫폼';
export const size = { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT };
export const contentType = 'image/png';

export default async function Image() {
    return new ImageResponse(
        <div
            style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'sans-serif',
            }}
        >
            <div
                style={{
                    fontSize: 72,
                    fontWeight: 700,
                    color: '#e2e8f0',
                    letterSpacing: '-0.02em',
                }}
            >
                {SITE_NAME}
            </div>
            <div
                style={{
                    fontSize: 28,
                    color: '#60a5fa',
                    marginTop: 16,
                }}
            >
                AI 기술적 주가 분석
            </div>
            <div
                style={{
                    fontSize: 18,
                    color: '#94a3b8',
                    marginTop: 12,
                    maxWidth: 800,
                    textAlign: 'center',
                    lineHeight: 1.5,
                }}
            >
                {SITE_DESCRIPTION}
            </div>
        </div>,
        { ...size }
    );
}
