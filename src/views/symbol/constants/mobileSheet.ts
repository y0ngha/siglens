export type SnapPoint = number | string | null;

// 20% — 기본(초기) 접힘. 실제로 보이는 띠는 `snap − PEEK_VISIBLE_OFFSET` = 0.17로, 차트를
// 가리지 않는 실측 임계값(0.194~0.215) 아래에 머문다. 산식과 여유 근거는 useMobileSheet 참고.
export const SNAP_PEEK = 0.2;
export const SNAP_HALF = 0.55; // 55% — 드래그 중간 스냅
export const SNAP_FULL = 0.97; // 97% — 전체 열림

export const MOBILE_SNAP_POINTS = [SNAP_PEEK, SNAP_HALF, SNAP_FULL] as const;

// vaul이 PEEK 스냅에서 실제로 보여주는 띠는 스냅 값보다 이만큼 작다. 산식 유도는
// useMobileSheet의 주석 참고. 이 값이 여러 곳에 리터럴로 흩어지면 한쪽만 갱신되는
// drift가 생기므로 여기 한 곳에서만 정의한다.
export const PEEK_VISIBLE_OFFSET = 0.03;

// PEEK에서 실제로 보이는 띠의 뷰포트 높이 비율(%). 위 SNAP_PEEK 주석의
// `snap − PEEK_VISIBLE_OFFSET`을 그대로 옮긴 값이며, SSR 껍데기(MobileSheetPlaceholder)가
// 실제 시트와 같은 높이를 갖도록 하는 단일 소스다. SNAP_PEEK를 바꾸면 이 값도 같이
// 바뀌어야 한다.
/**
 * 시트 자체의 높이(svh). `MobileAnalysisSheet`의 `h-[97svh]`와 **같은 값**이어야 한다.
 * Tailwind는 정적 클래스만 스캔하므로 그쪽은 리터럴로 남고, 이 상수와의 일치는
 * `__tests__/mobileSheetReserve.test.ts`가 지킨다.
 */
export const SHEET_HEIGHT_SVH = 97;

/**
 * PEEK 상태에서 시트가 덮는 만큼 차트가 비워 둘 높이. **CSS 식 그대로**다.
 *
 * 고정 비율(`SNAP_PEEK * 100svh`)을 쓰면 안 된다. 세 단위가 서로 다르기 때문이다 —
 * jail 높이는 `dvh`, 시트 높이는 `svh`, vaul의 오프셋은 `window.innerHeight`(= dvh).
 * 그래서 실제 띠는
 *
 *     띠 = SHEET_HEIGHT_SVH·svh − (1 − SNAP_PEEK)·dvh
 *
 * 이고, iOS Safari처럼 툴바가 접혀 `dvh > svh`가 되면 띠가 줄어드는데 고정 예약은
 * 그대로 남아 그 차이가 **검은 빈 공간**으로 보인다(2026-08-27 사용자 제보).
 * 위 식을 그대로 CSS로 옮기면 두 값이 어떤 툴바 상태에서도 함께 움직인다.
 *
 * `max(0px, ...)`는 띠가 0으로 수렴하는 구간(`useMobileSheet` 주석의 0.21·svh 근처)에서
 * 음수 패딩이 되는 것을 막는다.
 */
export const PEEK_RESERVE_CSS = `max(0px, calc(${SHEET_HEIGHT_SVH}svh - ${(1 - SNAP_PEEK) * 100}dvh))`;

export const MOBILE_SHEET_PEEK_BAND_SVH =
    (SNAP_PEEK - PEEK_VISIBLE_OFFSET) * 100;

// Vaul의 snapPoints prop은 readonly 배열을 허용하지 않아 mutable 사본을 사용한다.
export const SNAP_POINTS_MUTABLE = [...MOBILE_SNAP_POINTS] as number[];

// vaul 드로어 애니메이션과 동일한 easing 곡선.
export const VAUL_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';

// 드래그 시 손가락 속도 대비 시트 이동 비율 (러버밴드 효과).
export const DRAG_RESISTANCE = 0.6;

// 드래그로 간주하기 위한 최소 이동량(px).
export const DRAG_THRESHOLD_PX = 8;

// 드래그로 PEEK 스냅 발동 임계치 (뷰포트 높이 비율).
export const DRAG_TO_PEEK_THRESHOLD = 0.45;

// 드래그로 HALF 스냅 발동 임계치 (뷰포트 높이 비율).
export const DRAG_TO_HALF_THRESHOLD = 0.12;

// snapBack 애니메이션 지속 시간.
export const SNAP_BACK_DURATION = '0.5s';
