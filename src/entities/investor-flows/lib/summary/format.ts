import { compareIsoDate } from '../investorFlowsDates';

/** 이름(기관·내부자·신고자)·직함 칸의 최대 길이 — 한국 요약(`summarizeKrInvestorFlows`)도 같은 값을 쓴다. */
export const SUMMARY_NAME_MAX_CHARS = 26;

/** 직함·관계 칸의 최대 길이(`SUMMARY_NAME_MAX_CHARS`와 함께 `clipSummaryText`에 넘긴다). */
export const SUMMARY_ROLE_MAX_CHARS = 16;

/**
 * 비율·발행주식 대비 %의 소수 자리 — core가 점수표 비율을 반올림하는 자리(`RATIO_DECIMALS` = 4, core가 export하지 않아 값으로 적는다)와
 * 같다. 2~3자리로 줄이면 대형주의 작은 비율(발행주식 대비 FTD 0.0006% 등)이 0으로 바뀌어 "없음"으로 읽힌다.
 */
export const SUMMARY_RATIO_DIGITS = 4;

/** 직전 결제일 대비 공매도 잔고 변화율(%)의 소수 자리 — 도구 출력에서만 줄인다(화면은 원값을 포맷한다). */
export const SUMMARY_CHANGE_PCT_DIGITS = 2;

/** 소수 `digits`자리 반올림(`Math.round` — 음수 .5는 0 쪽). 요약 출력의 모든 수치가 거친다. */
export function round(value: number, digits: number): number {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

/**
 * 공시 원문 이름·문구를 한 줄로 펴고(연속 공백·줄바꿈을 공백 하나로 — core `sanitizePromptText`와 같은 규칙) `max`자를 넘으면 잘라
 * 말줄임표를 붙인다. 줄바꿈이 그대로 실리면 모델이 한 이름을 여러 항목으로 읽을 수 있다.
 */
export function clipSummaryText(text: string, max: number): string {
    const flat = text.replace(/\s+/g, ' ').trim();
    return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/** 직전 값 대비 변화율(%, 소수 1자리). 직전 값이 없거나 0이면 비교 불가라 `null`이다. */
export function pctChange(now: number, prev: number | null): number | null {
    if (prev === null || prev === 0) return null;
    return round(((now - prev) / prev) * 100, 1);
}

/** `key`(ISO 날짜) 기준 가장 최신 행. 행이 없으면 `null`, 키가 같으면 입력에서 뒤쪽 행이다. */
export function latestBy<T>(
    rows: readonly T[],
    key: (row: T) => string
): T | null {
    return (
        rows.toSorted((a, b) => compareIsoDate(key(a), key(b))).at(-1) ?? null
    );
}
