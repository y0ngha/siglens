// Next.js의 file-based metadata convention은 opengraph-image와 twitter-image를
// 분리해서 처리한다. opengraph-image만 있으면 Twitter는 root layout의 정적
// og-image.png로 fallback되므로, sibling 라우트의 동적 OG 이미지를 그대로
// twitter:image에도 노출하기 위해 re-export한다.

// 동적 세그먼트([symbol]) 하위라 revalidate만으로는 캐시되지 않는다. 이미지가
// (ticker, label) 순수 함수(동적 요청 API 미사용)이므로 force-static으로 정적 생성·캐시.
export const dynamic = 'force-static';
// OG 이미지는 (ticker, label) 순수 함수라 fresh 데이터가 없음 → 길게 캐시.
// 템플릿 변경은 배포 시 캐시가 무효화된다.
export const revalidate = 2592000; // 30d

export {
    default,
    size,
    contentType,
    alt,
} from '@/app/[symbol]/opengraph-image';
