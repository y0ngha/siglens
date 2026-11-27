/**
 * 차트 위젯 공용 상수(선 두께, pane 인덱스, localStorage 키 등).
 */

export const DEFAULT_LINE_WIDTH = 1;
/** 알파 0 — 시간외 캔들의 속 빈 몸통과 지표 선의 숨긴 선분이 같은 값을 쓴다(테마 팔레트 색이 아니다). */
export const TRANSPARENT_COLOR = 'rgba(0, 0, 0, 0)';
export const DEFAULT_POINT_MARKERS_RADIUS = 2;
export const INACTIVE_PANE_INDEX = -1;
export const FIRST_INDICATOR_PANE_INDEX = 1;

/**
 * 차트 MA 메뉴에 띄우는 기간. core `MA_DEFAULT_PERIODS`(5·20·60·120·200)에 50일선을 더했다.
 *
 * 골든크로스가 50일선/200일선 교차라 가이드·허브 문구가 50일선을 가리키는데, core 기본
 * 기간은 분석 프롬프트에도 쓰여 거기에 50을 넣지 않는다. 그래서 50은 차트에서만 봉으로
 * 계산한다(`withChartOnlyMaPeriods`).
 *
 * core 상수를 모듈 최상위에서 펼치지 않고 리터럴로 둔다 — 널리 import되는 이 파일이 로드
 * 시점에 core 값을 읽으면 core를 부분 목하는 테스트가 import만으로 깨진다. core 기본
 * 기간과 어긋나지 않는지는 `chartMaPeriods.test.ts`가 고정한다.
 */
export const CHART_MA_PERIODS = [5, 20, 50, 60, 120, 200] as const;

/** `CHART_MA_PERIODS` 중 core가 내지 않아 차트가 봉으로 직접 계산하는 기간. */
export const CHART_ONLY_MA_PERIODS = [50] as const;

// 차트 보조지표 선택을 새로고침 후에도 복원하기 위한 localStorage 키.
// 'siglens.chart.*' 단일 네임스페이스로 모아 오타·충돌을 막고 영속 대상을 한눈에 보이게 한다.
// 영속 자체는 usePersistentState가 담당하고, 여기서는 키 목록만 단일 소스로 관리한다.
export const STORAGE_PREFIX = 'siglens.chart';

// overlay 토글 영속 키를 가진 훅들. 유니온으로 제약해 오타('bolingger' 등)를 컴파일 타임에 잡고,
// 향후 overlay 추가/삭제 시 누락된 호출을 타입 에러로 드러낸다.
export type OverlayStorageKey =
    | 'bollinger'
    | 'keltner'
    | 'donchian'
    | 'supertrend'
    | 'parabolicSar'
    | 'chandelier'
    | 'ichimoku'
    | 'volumeProfile';

export const STORAGE_KEYS = {
    visible: `${STORAGE_PREFIX}.visible`,
    maPeriods: `${STORAGE_PREFIX}.ma.periods`,
    emaPeriods: `${STORAGE_PREFIX}.ema.periods`,
    /** 작도 수평 레벨을 가격축 앞까지 연장할지(기본 켜짐). */
    levelRightExtend: `${STORAGE_PREFIX}.levelRightExtend`,
    /** 미국 주식 인트라데이에서 프리·애프터마켓 봉·음영을 보일지(기본 켜짐). */
    extendedHours: `${STORAGE_PREFIX}.extendedHours`,
    overlay: (key: OverlayStorageKey): string =>
        `${STORAGE_PREFIX}.overlay.${key}`,
} as const;
