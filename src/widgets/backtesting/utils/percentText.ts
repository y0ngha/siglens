import { formatSignedPercent, signColorClass } from '@/shared/lib/priceFormat';

/** 부호 없는 퍼센트("62.5%"). 낙폭은 값이 음수라 `-`가 그대로 붙는다. */
export const percentText = (value: number): string => `${value.toFixed(1)}%`;

/** 0..1 비율을 퍼센트 문구로("0.509" → "50.9%"). 생성기가 비율로 내보내는 값에 쓴다. */
export const shareText = (share: number): string => percentText(share * 100);

/** 부호 있는 수익률("+44.3%") — 반올림해서 0이 되면 `+0.0%`다. */
export const returnText = (value: number, fractionDigits?: number): string =>
    formatSignedPercent(value, fractionDigits);

/** 반올림하면 0인 값의 색 — 이익도 손실도 아닌 중립 텍스트(DESIGN.md의 neutral 텍스트 토큰). */
const NEUTRAL_RETURN_CLASS = 'text-secondary-300';

/**
 * 수익률 색. 화면에 찍히는 반올림 값으로 정한다 — 원값으로 정하면 `-0.04`가 `+0.0%`로 찍히면서
 * 손실 색으로 칠해진다. 반올림하면 0인 값은 이익·손실 색 대신 중립 색이다(CONVENTIONS.md#CS-23).
 * 공용 `signColorClass`는 0을 이익 색으로 칠하는 기존 동작 그대로 두고 여기서 쓰지 않는다.
 */
export const returnColorClass = (value: number, fractionDigits = 1): string => {
    const rounded = Number(value.toFixed(fractionDigits));
    return rounded === 0 ? NEUTRAL_RETURN_CLASS : signColorClass(rounded);
};
