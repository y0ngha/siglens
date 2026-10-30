/**
 * 벤치마크 본문이 여러 파일에서 같이 쓰는 클래스 조합. 같은 역할의 표 머리·링크가 파일마다
 * 갈라지지 않게 한 곳에 둔다.
 */

/** 본문 안의 텍스트 링크. 문장 사이에 있어도 터치 영역(44px)을 지킨다. */
export const BENCHMARK_TEXT_LINK =
    'inline-flex min-h-11 items-center rounded text-secondary-300 underline underline-offset-2 hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

/** 표 머리 칸(열 제목). */
export const BENCHMARK_TH =
    'px-3 py-2 text-xs font-semibold text-secondary-400 whitespace-nowrap';

/** 표 본문 행 사이 구분선. */
export const BENCHMARK_ROW = 'border-t border-secondary-700';
