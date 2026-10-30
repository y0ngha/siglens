/**
 * `/developers` 섹션들이 함께 쓰는 클래스 묶음. 같은 역할의 단락·링크·표가 섹션 파일마다 갈라지지 않도록 한 곳에 둔다.
 */

/** 산문 단락. 한 줄 길이는 `max-w-2xl`로 줄이고, 표·코드 블록은 열 폭을 쓴다. */
export const BODY_TEXT = 'max-w-2xl text-[15px] leading-7 text-secondary-300';

/** 작은 보조 단락(섹션 끝의 주석·표 아래 설명). */
export const NOTE_TEXT = 'max-w-2xl text-sm leading-6 text-secondary-400';

/** 본문 안의 텍스트 링크. 터치 대상 44px을 지킨다. */
export const TEXT_LINK =
    'inline-flex min-h-11 items-center rounded text-secondary-300 underline underline-offset-2 hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

/**
 * 섹션 목차 링크. 좁은 화면에서는 줄바꿈되는 칩 줄, `lg` 이상에서는 왼쪽 경계선을 낀 세로 목록이다
 * (같은 `<nav>` 하나가 두 배치를 다 맡아 링크가 DOM에 한 벌만 있다). 도구 바로가기 칩도 같은 모양을 쓴다.
 */
export const TOC_LINK =
    'inline-flex min-h-11 items-center rounded px-2 text-sm text-secondary-300 underline-offset-2 hover:text-primary-400 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none lg:min-h-9 lg:w-full';

/** 문장 안의 짧은 코드(`https://…/api/v1`). */
export const INLINE_CODE =
    'rounded bg-secondary-800 px-1 py-0.5 font-mono text-[13px] text-secondary-100';

/** 좁은 화면에서 가로 스크롤되는 표의 바깥 영역 — 키보드로 닿도록 이름 붙은 `region` + `tabIndex={0}`과 함께 쓴다. */
export const TABLE_SCROLL_REGION =
    'overflow-x-auto focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

/** 두 열 레퍼런스 표. 320px 아래로는 줄이지 않고 바깥 영역이 스크롤한다. */
export const TABLE = 'w-full min-w-[20rem] border-collapse text-left text-sm';

/** 표 머리 행. */
export const TABLE_HEAD_ROW =
    'border-b border-secondary-700 text-xs text-secondary-400';

/** 표 본문 행. */
export const TABLE_BODY_ROW =
    'border-b border-secondary-700 align-top last:border-b-0';

/** 행 머리 칸(`th scope="row"`). 스크린리더가 행을 이 칸의 이름으로 읽는다. */
export const TABLE_ROW_HEADER = 'py-2.5 pr-3 text-left font-normal';
