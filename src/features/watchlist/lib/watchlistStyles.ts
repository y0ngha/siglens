/** `/watchlist`·헤더 미리보기·홈 카드가 공유하는 Tailwind 클래스 — 화면마다 복제하면 모양이 어긋난다. */

/** `/watchlist`의 관심 탭 행과 최근 본 탭 행이 함께 쓰는 행 표면 — 두 탭을 오가도 행 모양이 같다. */
export const WATCHLIST_ROW_CHROME =
    'ring-secondary-700 bg-secondary-900/60 rounded-lg p-4 ring-1';

/** 목록 머리의 보조 링크("편집") — 헤더 미리보기와 홈 카드가 같은 모양을 쓴다. */
export const WATCHLIST_SUBTLE_LINK =
    'inline-flex min-h-10 items-center rounded px-2 text-sm text-secondary-400 transition-colors hover:text-secondary-200 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

/**
 * 홈 카드가 비어 있을 때와 하이드레이션 전 자리표시자가 함께 쓰는 높이 — 첫 방문자(대부분의 검색
 * 유입)는 하이드레이션 순간 아무것도 밀리지 않는다. 이미 담아 둔 재방문자는 카드가 한 번 늘어난다.
 */
export const HOME_WATCHLIST_EMPTY_HEIGHT = 'min-h-[13.5rem] sm:min-h-[9rem]';
