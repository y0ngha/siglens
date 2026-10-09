import type {
    DemoBarTone,
    DemoLineRole,
    DemoSeriesTone,
} from '@/views/guide/demos/types';

/**
 * 데모 차트의 색 클래스 표. 모두 디자인 토큰이라 다크/라이트가 자동으로 따라온다.
 * 도형(선·채움)은 그래픽 3:1 토큰(`chart-*`, `ui-*`), 글자는 텍스트 4.5:1 토큰(`ui-*-text`)을 쓴다.
 * Tailwind가 클래스를 찾을 수 있도록 문자열은 전부 리터럴로 적는다.
 */

export const SERIES_STROKE: Record<DemoSeriesTone, string> = {
    a: 'stroke-primary-400',
    b: 'stroke-ui-warning',
    c: 'stroke-secondary-200',
    bull: 'stroke-chart-bullish',
    bear: 'stroke-chart-bearish',
};

export const SERIES_FILL: Record<DemoSeriesTone, string> = {
    a: 'fill-primary-400',
    b: 'fill-ui-warning',
    c: 'fill-secondary-200',
    bull: 'fill-chart-bullish',
    bear: 'fill-chart-bearish',
};

export const SERIES_TEXT: Record<DemoSeriesTone, string> = {
    a: 'fill-primary-300',
    b: 'fill-ui-warning-text',
    c: 'fill-secondary-200',
    bull: 'fill-ui-success-text',
    bear: 'fill-ui-danger-text',
};

export const ROLE_STROKE: Record<DemoLineRole, string> = {
    support: 'stroke-chart-bullish',
    resistance: 'stroke-chart-bearish',
    neckline: 'stroke-ui-warning',
    trend: 'stroke-primary-400',
    neutral: 'stroke-secondary-300',
};

export const ROLE_TEXT: Record<DemoLineRole, string> = {
    support: 'fill-ui-success-text',
    resistance: 'fill-ui-danger-text',
    neckline: 'fill-ui-warning-text',
    trend: 'fill-primary-300',
    neutral: 'fill-secondary-300',
};

export const TONE_FILL: Record<DemoBarTone, string> = {
    bull: 'fill-chart-bullish',
    bear: 'fill-chart-bearish',
    neutral: 'fill-primary-400',
};

export const TONE_STROKE: Record<DemoBarTone, string> = {
    bull: 'stroke-chart-bullish',
    bear: 'stroke-chart-bearish',
    neutral: 'stroke-primary-400',
};

export const TONE_TEXT: Record<DemoBarTone, string> = {
    bull: 'fill-ui-success-text',
    bear: 'fill-ui-danger-text',
    neutral: 'fill-secondary-300',
};

/** 글자 뒤에 카드 배경색 테두리를 둘러 봉과 겹쳐도 읽히게 하는 공통 클래스. */
export const LABEL_HALO = 'stroke-secondary-800';
