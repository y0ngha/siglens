// Next.js의 file-based metadata convention은 opengraph-image와 twitter-image를
// 분리해서 처리한다. opengraph-image만 있으면 Twitter는 root layout의 정적
// og-image.png로 fallback되므로, sibling 라우트의 동적 OG 이미지를 그대로
// twitter:image에도 노출하기 위해 re-export한다.
export {
    default,
    size,
    contentType,
    alt,
} from '@/app/[symbol]/opengraph-image';
