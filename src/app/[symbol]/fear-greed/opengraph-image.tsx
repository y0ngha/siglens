import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import { buildSymbolOgImage } from '@/entities/og-image';

// 동적 세그먼트([symbol]) 하위라 revalidate만으로는 캐시되지 않는다. 이미지가
// (ticker, label) 순수 함수(동적 요청 API 미사용)이므로 force-static으로 정적 생성·캐시.
export const dynamic = 'force-static';
// OG 이미지는 (ticker, label) 순수 함수라 fresh 데이터가 없음 → 길게 캐시.
// 템플릿 변경은 배포 시 캐시가 무효화된다.
export const revalidate = 2592000; // 30d

export const size = { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT };
export const contentType = 'image/png';
// alt는 module-scope const라 ticker/asset 동적 주입 불가 — 자산군 중립 문구로 둔다.
export const alt = 'Siglens 공포 탐욕 지수';

interface Props {
    params: Promise<{ symbol: string }>;
}

export default async function Image({ params }: Props) {
    const { symbol } = await params;
    return buildSymbolOgImage({
        ticker: symbol.toUpperCase(),
        label: '공포 탐욕 지수',
    });
}
