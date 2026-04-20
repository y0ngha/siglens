import { ImageResponse } from 'next/og';
import { SITE_NAME } from '@/lib/seo';

export const runtime = 'edge';
export const alt = '섹터별 미국 주식 기술적 신호';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image(): Promise<ImageResponse> {
    return new ImageResponse(
        <div
            style={{
                // ImageResponse는 Tailwind 미지원 — inline style 필수
                // #0f2a4a: secondary-900(#0f172a)과 secondary-800(#1e293b) 사이 커스텀 그라디언트 중간 색상
                background:
                    'linear-gradient(135deg, #0f172a 0%, #0f2a4a 50%, #1e293b 100%)',
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '64px 80px',
                fontFamily: 'sans-serif',
                position: 'relative',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background:
                        'radial-gradient(ellipse at 80% 50%, rgba(96, 165, 250, 0.08) 0%, transparent 60%)',
                }}
            />
            <div
                style={{
                    fontSize: 20,
                    color: '#60a5fa',
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    marginBottom: 32,
                    fontWeight: 600,
                }}
            >
                {SITE_NAME} · /market
            </div>
            <div
                style={{
                    fontSize: 84,
                    fontWeight: 700,
                    color: '#f1f5f9',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.1,
                    textAlign: 'center',
                    marginBottom: 24,
                }}
            >
                섹터별 미국 주식 기술적 신호
            </div>
            <div
                style={{
                    fontSize: 28,
                    color: '#cbd5e1',
                    textAlign: 'center',
                    maxWidth: 960,
                    lineHeight: 1.4,
                }}
            >
                골든크로스 · RSI 다이버전스 · 볼린저 스퀴즈 실시간 스캔
            </div>
            <div
                style={{
                    position: 'absolute',
                    bottom: 48,
                    right: 80,
                    fontSize: 18,
                    color: '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                }}
            >
                siglens.io
            </div>
            <div
                style={{
                    position: 'absolute',
                    bottom: 48,
                    left: 80,
                    display: 'flex',
                    gap: 8,
                }}
            >
                {['골든크로스', 'RSI 다이버전스', '볼린저 스퀴즈', 'MACD'].map(
                    label => (
                        <div
                            key={label}
                            style={{
                                fontSize: 14,
                                color: '#475569',
                                background: 'rgba(255,255,255,0.05)',
                                borderRadius: 6,
                                padding: '4px 10px',
                                border: '1px solid rgba(255,255,255,0.08)',
                            }}
                        >
                            {label}
                        </div>
                    )
                )}
            </div>
        </div>,
        { ...size }
    );
}
