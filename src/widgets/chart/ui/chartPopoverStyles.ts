/**
 * 차트 헤더 띠(`StockChart`의 h-8 줄)의 팝오버 패널 공통 클래스 — "보조지표"(`IndicatorMenu`)·"차트 작도"(`ChartOverlayMenu`)·
 * 톱니바퀴 "차트 설정"(`ChartSettingsMenu`)이 `ChartPopoverPanel`로 같은 표면을 쓴다.
 * 좌표(`top`·`left`·`width`·`maxHeight`)는 `ChartPopoverPanel`이 인라인으로 정한다 — 여기에는 모양만 둔다.
 * `z-60`은 모바일 AI 시트(z-50) 위다. Tailwind가 클래스를 찾도록 리터럴로 둔다.
 */
export const CHART_POPOVER_PANEL =
    'fixed z-60 flex flex-col overflow-y-auto overscroll-contain rounded-lg border border-secondary-700 bg-secondary-900 p-1.5 shadow-2xl outline-none';

/**
 * 헤더 띠 트리거의 공통 모양(`h-7`). 히트 영역은 `::before`로 세로만 44px까지 넓힌다(28 + 2*8). 가로는 띠
 * 간격(모바일 2px·sm 이상 4px)을 넘지 않게 2px만 넓힌다 — 더 넓히면 이웃 트리거의 가장자리 탭이 이쪽
 * 영역에 가로채여 엉뚱한 메뉴가 열린다.
 */
export const CHART_POPOVER_TRIGGER =
    "relative flex h-7 touch-manipulation items-center rounded-lg text-secondary-400 transition-colors before:absolute before:-inset-x-0.5 before:-inset-y-2 before:content-[''] hover:bg-secondary-700/90 hover:text-white focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none";

/** 글자 트리거(보조지표·차트 작도)의 간격 — 모바일(sm 미만)은 좌우 여백을 줄여 세 메뉴가 320px 띠에 들어가게 한다. */
export const CHART_MENU_TRIGGER_LAYOUT = 'gap-1 px-1 text-xs sm:px-2';
