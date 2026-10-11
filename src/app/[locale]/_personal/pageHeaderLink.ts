import { cn } from '@/shared/lib/cn';
import { LINK_ACCENT } from '@/shared/lib/linkStyles';

/**
 * `/watchlist` ↔ `/portfolio` 페이지 헤더 오른쪽의 서로 가는 링크. 두 개인화 페이지만 쓰는 값이라
 * `shared`가 아니라 두 라우트 곁(`_personal`, 라우트가 아닌 비공개 폴더)에 둔다. 같은 모양이어야
 * 서로 오가는 짝으로 읽힌다. 터치 목표 44px을 높이로 확보한다.
 */
export const PAGE_HEADER_LINK = cn(
    LINK_ACCENT,
    'inline-flex min-h-11 items-center rounded px-1 text-sm'
);
