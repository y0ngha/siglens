import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import {
    renderSymbolTabOgImage,
    type SymbolTabOgImageProps,
} from '@/app/[locale]/[symbol]/symbolTabOgImage';

// 동적 세그먼트([symbol]) 하위라 revalidate만으로는 캐시되지 않는다. 이미지가
// (ticker, label) 순수 함수(동적 요청 API 미사용)이므로 force-static으로 정적 생성·캐시.
export const dynamic = 'force-static';
// OG 이미지는 (ticker, label) 순수 함수라 fresh 데이터가 없음 → 길게 캐시.
// 템플릿 변경은 배포 시 캐시가 무효화된다.
export const revalidate = 2592000; // 30d

export const size = { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT };
export const contentType = 'image/png';
// `alt`는 Next가 **모듈 스코프 상수**로 요구해 로케일별로 낼 수 없다(이미지
// 본문은 아래에서 로케일별로 그린다). 네 로케일이 한 값을 공유해야 하므로
// 한국어 대신 영어로 둔다 — 예전엔 한국어라 `/en/…` 공유 카드의 alt만 한국어였다.
export const alt = 'SIGLENS — technical analysis';

export default function Image({ params }: SymbolTabOgImageProps) {
    return renderSymbolTabOgImage(params, t => t('opengraph-image.a74840'));
}
