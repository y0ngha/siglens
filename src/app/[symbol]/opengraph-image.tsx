import { ImageResponse } from 'next/og';
import { getAssetInfoAction } from '@/infrastructure/ticker/getAssetInfoAction';
import { SITE_NAME } from '@/lib/seo';

export const runtime = 'edge';
export const alt = 'AI 기술적 분석';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface Props {
    params: Promise<{ symbol: string }>;
}

export default async function Image({ params }: Props) {
    const { symbol } = await params;
    const ticker = symbol.toUpperCase();
    const assetInfo = await getAssetInfoAction(ticker);

    const companyName = assetInfo?.name ?? ticker;
    const koreanName = assetInfo?.koreanName;

    return new ImageResponse(
        <div
            style={{
                background:
                    'linear-gradient(135deg, #0f172a 0%, #0f2a4a 50%, #1e293b 100%)',
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
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
                    marginBottom: 24,
                    fontWeight: 600,
                }}
            >
                {SITE_NAME} · AI 기술적 분석
            </div>
            <div
                style={{
                    fontSize: 96,
                    fontWeight: 800,
                    color: '#f1f5f9',
                    letterSpacing: '-0.03em',
                    lineHeight: 1,
                    marginBottom: 16,
                }}
            >
                {ticker}
            </div>
            {koreanName && (
                <div
                    style={{
                        fontSize: 36,
                        fontWeight: 600,
                        color: '#93c5fd',
                        marginBottom: 8,
                    }}
                >
                    {koreanName}
                </div>
            )}
            <div
                style={{
                    fontSize: 24,
                    color: '#94a3b8',
                    marginBottom: 0,
                }}
            >
                {companyName}
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
                {['RSI', 'MACD', '볼린저밴드', '이동평균'].map(label => (
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
                ))}
            </div>
        </div>,
        { ...size }
    );
}
