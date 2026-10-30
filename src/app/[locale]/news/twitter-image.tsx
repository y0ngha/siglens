import Image from './opengraph-image';

/** `twitter:image`도 `/news` 허브의 OG 이미지를 그대로 쓴다 — 크기·형식·alt까지 한 벌. */
export { size, contentType, alt } from './opengraph-image';

/** 정적화 — `cookies()/headers()/searchParams`만 비우고 `params`는 유지해 로케일별로 그린다(src/app/CLAUDE.md#AP-1). */
export const dynamic = 'force-static';
// 30d — route segment config는 리터럴 유지(식/import 상수 추출 시 Next가 ISR config를
// 무시, src/app/CLAUDE.md#AP-1). opengraph-image.tsx와 동일 값.
export const revalidate = 2592000;

/** OG 이미지 렌더러를 그대로 쓴다 — 두 카드가 같은 그림을 낸다. */
export default Image;
