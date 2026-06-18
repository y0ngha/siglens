import Image from './opengraph-image';
export { size, contentType, alt } from './opengraph-image';

export const dynamic = 'force-static';
// 30d — route segment config는 리터럴 유지(식/import 상수 추출 시 Next가 ISR config를
// 무시). app/CLAUDE.md ISR §·MISTAKES §15 예외. opengraph-image.tsx와 동일 값.
export const revalidate = 2592000;

export default Image;
