/**
 * 데모 차트의 색 클래스 표. 모두 디자인 토큰이라 다크/라이트가 자동으로 따라온다.
 * 도형(선·채움)은 그래픽 3:1 토큰(`chart-*`, `ui-*`), 글자는 텍스트 4.5:1 토큰(`ui-*-text`)을 쓴다.
 * Tailwind가 클래스를 찾을 수 있도록 문자열은 전부 리터럴로 적는다.
 */
import type {
    DemoBarTone,
    DemoLineRole,
    DemoSeriesTone,
} from '@/views/guide/demos/types';
import type { OverlayLabelColour } from '@/views/guide/lib/demoChartLayout';

/** 가격 영역 선·띠 테두리와 패널 선의 색. 같은 슬롯의 채움(`SERIES_FILL`)·라벨(`SERIES_TEXT`)과 한 계열이라 선과 라벨이 한눈에 짝지어진다. */
export const SERIES_STROKE: Record<DemoSeriesTone, string> = {
    a: 'stroke-primary-400',
    b: 'stroke-ui-warning',
    c: 'stroke-secondary-200',
    bull: 'stroke-chart-bullish',
    bear: 'stroke-chart-bearish',
};

/** 띠 채움·점 시리즈(파라볼릭 SAR)의 색. 띠는 낮은 불투명도로 칠해 아래 봉이 비친다(`DemoOverlayShape`). */
export const SERIES_FILL: Record<DemoSeriesTone, string> = {
    a: 'fill-primary-400',
    b: 'fill-ui-warning',
    c: 'fill-secondary-200',
    bull: 'fill-chart-bullish',
    bear: 'fill-chart-bearish',
};

/** 선·띠 라벨과 패널 범례의 글자색. 선 색은 그래픽 대비(3:1)만 맞으므로 글자는 4.5:1 텍스트 토큰을 따로 쓴다. */
export const SERIES_TEXT: Record<DemoSeriesTone, string> = {
    a: 'fill-primary-300',
    b: 'fill-ui-warning-text',
    c: 'fill-secondary-200',
    bull: 'fill-ui-success-text',
    bear: 'fill-ui-danger-text',
};

/** 추세선·수평선의 색은 역할이 정한다 — 지지는 상승색, 저항은 하락색이라 범례 없이도 뜻이 읽힌다. */
export const ROLE_STROKE: Record<DemoLineRole, string> = {
    support: 'stroke-chart-bullish',
    resistance: 'stroke-chart-bearish',
    neckline: 'stroke-ui-warning',
    trend: 'stroke-primary-400',
    neutral: 'stroke-secondary-300',
};

/** `ROLE_STROKE`와 짝을 이루는 라벨 글자색(텍스트 대비 4.5:1 토큰). */
export const ROLE_TEXT: Record<DemoLineRole, string> = {
    support: 'fill-ui-success-text',
    resistance: 'fill-ui-danger-text',
    neckline: 'fill-ui-warning-text',
    trend: 'fill-primary-300',
    neutral: 'fill-secondary-300',
};

/** 의미로 덮어쓴 봉 몸통·패널 막대·표식 화살표의 채움 색(엘더 임펄스의 녹/청/적 등). */
export const TONE_FILL: Record<DemoBarTone, string> = {
    bull: 'fill-chart-bullish',
    bear: 'fill-chart-bearish',
    neutral: 'fill-primary-400',
};

/** `TONE_FILL`로 칠한 봉의 꼬리 색 — 몸통과 같은 계열이라 봉 하나가 한 색으로 보인다. */
export const TONE_STROKE: Record<DemoBarTone, string> = {
    bull: 'stroke-chart-bullish',
    bear: 'stroke-chart-bearish',
    neutral: 'stroke-primary-400',
};

/** 표식 라벨의 글자색. 화살표(`TONE_FILL`)와 같은 뜻을 텍스트 대비 토큰으로 낸다. */
export const TONE_TEXT: Record<DemoBarTone, string> = {
    bull: 'fill-ui-success-text',
    bear: 'fill-ui-danger-text',
    neutral: 'fill-secondary-300',
};

/** 글자 뒤에 카드 배경색 테두리를 둘러 봉과 겹쳐도 읽히게 하는 공통 클래스. */
export const LABEL_HALO = 'stroke-secondary-800';

/** 구간(`zone`) 라벨 글자색 — 구간 채움(`primary-500`)과 같은 계열의 텍스트 토큰. */
const ZONE_TEXT = 'fill-primary-300';

/** `layoutOverlayLabels`가 고른 색 근거를 클래스로 바꾼다. 색 클래스는 Tailwind가 찾도록 이 파일의 리터럴 표에서만 나온다. */
export function overlayLabelClass(colour: OverlayLabelColour): string {
    switch (colour.palette) {
        case 'zone':
            return ZONE_TEXT;
        case 'series':
            return SERIES_TEXT[colour.tone];
        case 'role':
            return ROLE_TEXT[colour.role];
        case 'bar':
            return TONE_TEXT[colour.tone];
    }
}
