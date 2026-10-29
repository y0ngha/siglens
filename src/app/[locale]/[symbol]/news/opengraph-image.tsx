import {
    renderSymbolTabOgImage,
    type SymbolTabOgImageProps,
} from '@/app/[locale]/[symbol]/symbolTabOgImage';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';

/**
 * 정적 생성. 동적 세그먼트 하위라 `revalidate`만으로는 캐시되지 않고, 이미지는 (ticker, label)의 순수
 * 함수(동적 요청 API 미사용)라 `force-static`이 맞다 — `params`는 유지돼 종목별로 렌더된다.
 */
export const dynamic = 'force-static';
/** 신선한 데이터가 없는 이미지라 길게 캐시한다. 템플릿 변경은 배포 때 캐시가 무효화된다. */
export const revalidate = 2592000; // 30d

/** 공유 카드 규격 — 동적·정적 OG가 함께 쓰는 `shared/lib/og` 상수. */
export const size = { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT };
/** 이미지 응답 MIME. */
export const contentType = 'image/png';
/**
 * Next가 **모듈 스코프 상수**로 요구해 로케일별로 낼 수 없다(이미지 본문은 로케일별로 그린다). 네
 * 로케일이 한 값을 공유하므로 영어로 둔다.
 */
export const alt = 'SIGLENS news analysis';

/** 이 탭의 OG 이미지 — 탭마다 다른 것은 라벨 한 줄뿐이라 `renderSymbolTabOgImage`에 맡긴다. */
export default function Image({ params }: SymbolTabOgImageProps) {
    return renderSymbolTabOgImage(params, t => t('opengraph-image.2141f2'));
}
