import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/lib/og';
import { buildSymbolOgImage } from '@/infrastructure/og/buildSymbolOgImage';

export const size = { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT };
export const contentType = 'image/png';
// alt는 module-scope const라 ticker 동적 주입 불가 — 페이지 카테고리까지만 명시한다.
export const alt = 'Siglens 미국 주식 AI 종합 분석';

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
