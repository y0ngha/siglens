import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/lib/og';
import { buildSymbolOgImage } from '@/infrastructure/og/buildSymbolOgImage';

export const size = { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT };
export const contentType = 'image/png';
export const alt = 'Siglens AI 종합 분석';

interface Props {
    params: Promise<{ symbol: string }>;
}

export default async function Image({ params }: Props) {
    const { symbol } = await params;
    return buildSymbolOgImage({
        ticker: symbol.toUpperCase(),
        label: 'AI 종합 분석',
    });
}
