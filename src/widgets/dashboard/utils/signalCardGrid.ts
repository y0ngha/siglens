/**
 * 신호 종목 카드 그리드의 열 구성 클래스. 실제 소절과 자리 표시가 같은 값을 써야
 * 조회가 끝나는 순간 카드 행 수가 바뀌어 화면이 밀리지 않는다.
 */

/** 모든 너비에서 소절 카드를 놓는 그리드(1열 → xl 5열). */
export const SIGNAL_CARD_GRID_CLASS =
    'grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';

/** 자리 표시가 소절 하나에 잡아 두는 카드 수 — 한 줄(xl 기준 5열)을 채운다. */
export const PLACEHOLDER_CARD_COUNT = 5;
