/**
 * 차트 헤더 띠(`StockChart`의 h-8 줄)의 팝오버 패널 공통 클래스 — "차트 작도"(`ChartOverlayMenu`)와
 * 톱니바퀴 "보조지표 설정"(`IndicatorSettingsPopover`)이 `ChartPopoverPanel`로 같은 표면을 쓴다.
 * 좌표(`top`·`left`·`width`·`maxHeight`)는 `ChartPopoverPanel`이 인라인으로 정한다 — 여기에는 모양만 둔다.
 * `z-60`은 모바일 AI 시트(z-50) 위다. Tailwind가 클래스를 찾도록 리터럴로 둔다.
 */
export const CHART_POPOVER_PANEL =
    'fixed z-60 flex flex-col overflow-y-auto overscroll-contain rounded-lg border border-secondary-700 bg-secondary-900 p-1.5 shadow-2xl outline-none';

/** 헤더 띠 트리거의 공통 모양(`h-7`, 히트 영역은 `::before`로 44px까지 확장). */
export const CHART_POPOVER_TRIGGER =
    "relative flex h-7 touch-manipulation items-center rounded-lg text-secondary-400 transition-colors before:absolute before:-inset-2 before:content-[''] hover:bg-secondary-700/90 hover:text-white focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none";
