import {
    salvageByRemovingSentences,
    type GuardInput,
    type PlainGuardFailure,
} from './guardPlainText';

/**
 * 첫 시도가 "근거 없는 숫자"로 거부됐을 때 **재시도 전에** 그 문장만 도려내도 되는 상한.
 *
 * 2026-10 실측(14일): 첫 시도 거부 2,038건(호출의 ~9%)이 전부 재생성으로 이어졌고, 거부
 * 전체(재시도 포함 2,696건)의 73%가 `unsupported_numbers`였다(첫 시도만의 비율은 따로 안 쟀다). 위반은 대개 문장 한두 개라(재시도 실패 뒤 살린 사례 전부
 * 문장 1~3개 제거) 짧게 도려내면 끝나는 것을 LLM 한 번을 더 불러 고쳤다. 원문의 25%
 * 이하만 잃으면 도려낸 결과를 그대로 쓰고, 그보다 많이 잃으면 재생성이 낫다고 본다.
 * 크기 접미사(`magnitude_suffix`)·문자 혼입 등 다른 거부는 도려내서 고쳐지지 않으므로
 * 그대로 재시도한다.
 *
 * 조언 문구(`advice`, 2026-10-04 도입)도 같은 경로로 도려낸다. 다만 25% 상한은 숫자 위반
 * 실측에서 나온 값이고 조언 쪽은 측정이 없다 — 로그의 `kind`로 두 분포를 갈라 다시 본다.
 *
 * ## 위 수치를 다시 세는 법
 *
 * 거부는 `attempt()`가 `console.warn('[analysisPlain] guard rejected', { symbol, locale,
 * kind, retry, tokens })`로 매번 한 번씩 남긴다. CloudWatch Logs Insights, 로그 그룹
 * `/siglens/app`, 14일 범위:
 *
 *     fields @timestamp, @message
 *     | filter @message like "[analysisPlain] guard rejected"
 *     | stats count() as rejections
 *
 * - 거부 전체(2,696건)는 위 마커 줄 수, 그중 첫 시도만(2,038건)은 `retry: false`인 건이다.
 * - 종류별 비율(`unsupported_numbers` 73%)은 같은 필드의 `kind`로 가른다. Node는 객체를
 *   여러 줄로 찍으므로 awslogs가 필드마다 별개 이벤트로 쪼갤 수 있다 — 그러면
 *   `filter @message like "kind: 'unsupported_numbers'"` 줄 수를 마커 줄 수로 나눈다.
 *   쪼개졌는지는 먼저 `limit 20`으로 원문을 보고 정할 것.
 * - 이 상한을 도입한 뒤의 실제 손실 분포는 `[analysisPlain] salvaged without retry`의
 *   `lossRatio`로 본다(`server/plainGeneration.ts`의 `console.info`). 이 로그는 도입 전
 *   기간에는 없어 위 14일 수치를 과거로 재현하는 데는 못 쓴다.
 */
export const SALVAGE_BEFORE_RETRY_MAX_LOSS = 0.25;

/**
 * 문장을 도려내 고칠 수 있는 거부 종류인지. 재시도 전(`salvageBeforeRetry`)과 재시도 뒤
 * 도려내기가 같은 종류만 살린다 — 크기 접미사(`1,573.1B`)는 자릿수가 틀린 금액이라 문장을
 * 빼도 고쳐지지 않고 남기면 10배 오류가 그대로 나간다.
 */
export function isSalvageableFailure(failure: PlainGuardFailure): boolean {
    return failure.kind === 'unsupported_numbers' || failure.kind === 'advice';
}

export interface SalvagedBeforeRetry {
    text: string;
    /** 잃은 글자 비율(0~1). 상한 판정과 로그가 같은 값을 쓰도록 한 번만 계산한다. */
    lossRatio: number;
}

/**
 * 첫 시도 거부를 재시도 없이 문장 도려내기로 고친다. 도려낼 수 없거나(`isSalvageableFailure`
 * 아님, 도려낸 뒤에도 가드 위반) 손실이 `SALVAGE_BEFORE_RETRY_MAX_LOSS`를 넘으면 `null` —
 * 호출자가 LLM 재시도로 넘어간다.
 */
export function salvageBeforeRetry(
    text: string,
    failure: PlainGuardFailure,
    allowed: GuardInput['allowed']
): SalvagedBeforeRetry | null {
    if (!isSalvageableFailure(failure)) return null;
    const salvaged = salvageByRemovingSentences(text, allowed);
    if (salvaged === null) return null;
    // `text`가 빈 문자열일 수 없다 — 두 종류 모두 `guardPlainText`가 `trim()` 뒤
    // 비어 있지 않음을 확인한 다음에야 나오는 종류다(빈 입력은 `empty`로 먼저 끝난다).
    // 설령 0이 되어도 `0 / 0`은 NaN이고 `NaN <= 상한`은 거짓이라 null로 떨어져 안전하다.
    const lossRatio = (text.length - salvaged.length) / text.length;
    return lossRatio <= SALVAGE_BEFORE_RETRY_MAX_LOSS
        ? { text: salvaged, lossRatio }
        : null;
}
