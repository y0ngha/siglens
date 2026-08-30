/**
 * 평이화 산출물 검증. 프롬프트 준수에 기대지 않고 결과 문자열을 직접 검사한다.
 *
 * 실패는 전부 재작성 실패로 처리되고, 호출자는 `null`을 돌려 원본 뷰만 노출한다.
 * 부분 통과 같은 중간 상태를 두지 않는다 — 숫자 하나가 틀린 매매 안내는 원본을
 * 보여주는 것보다 나쁘다.
 */

/**
 * 검사 대상이 되는 "가격형 토큰".
 *
 * 천 단위 콤마가 있거나, 소수점이 있거나, 3자리 이상인 수만 본다. `몇 주간`,
 * `한 단계`, `두 번` 같은 자연어 수량은 2자리 이하라 애초에 걸리지 않는다.
 *
 * ⚠️ 후행 단언이 `(?![\w])`가 **아니라** `(?![\d])`인 이유: `219,522.5B`처럼 단위
 * 접미사가 붙으면 `(?![\w])`가 `B`에 걸려 정규식이 백트래킹해 `219,522`만 잡는다.
 * 원본에 정확히 존재하는 값이 위반으로 찍혔다(실측). 숫자 런의 중간을 끊지 않는
 * 것만이 목적이므로 숫자만 배제하면 된다.
 */
const PRICE_TOKEN =
    /(?<![\w.])(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+\.\d+|\d{3,})(?![\d])/g;

/** 산문 문자열에서 허용 숫자를 긁을 때 쓰는 느슨한 패턴. */
const ANY_NUMBER = /\d[\d,]*(?:\.\d+)?/g;

const toNumber = (token: string): number => Number(token.replace(/,/g, ''));
const decimalPlaces = (token: string): number =>
    (token.split('.')[1] ?? '').length;

/** 허용 숫자 집합 — facts의 숫자 + 입력 산문 안에 등장한 모든 숫자. */
export function buildAllowedNumbers(
    factNumbers: readonly number[],
    proseTexts: readonly string[]
): number[] {
    const allowed = [...factNumbers];
    for (const text of proseTexts) {
        for (const match of text.matchAll(ANY_NUMBER)) {
            const value = toNumber(match[0]);
            if (Number.isFinite(value)) allowed.push(value);
        }
    }
    return allowed;
}

/**
 * 출력에 등장한 가격형 토큰 중 허용 집합으로 설명되지 않는 것을 돌려준다.
 *
 * 판정은 **정확 일치가 아니라 반올림 일치**다: 출력 토큰이 소수 `d`자리면 허용값을
 * `d`자리로 반올림해 비교한다. 엄격 일치로 시작했다가 실측에서 오탐이 났다 —
 * `"431달러에서 434달러 사이"`는 원본 `431.29`·`433.68`의 반올림인데 환각으로
 * 잡혔다. 초보자용 글에서는 `431.29달러`보다 `431달러`가 나은 표현이므로 반올림은
 * 막을 대상이 아니다.
 *
 * ⚠️ 이건 의미 검사가 아니라 집합 소속 검사다. 모델이 계산해 낸 값이 우연히 다른
 * 필드의 값과 같으면 통과한다. 그래서 프롬프트가 "퍼센트를 직접 계산하지 마세요"를
 * 함께 요구한다. 이 함수가 확실히 막는 것은 **날조된 가격**이다.
 */
export function findUnsupportedNumbers(
    text: string,
    allowed: readonly number[]
): string[] {
    const unsupported: string[] = [];
    for (const match of text.matchAll(PRICE_TOKEN)) {
        const token = match[1];
        const value = toNumber(token);
        const factor = 10 ** decimalPlaces(token);
        const explained = allowed.some(
            candidate => Math.round(candidate * factor) / factor === value
        );
        if (!explained) unsupported.push(token);
    }
    return unsupported;
}

/** 산출물이 통과하지 못한 이유. 재시도 프롬프트에 그대로 실린다. */
export type PlainGuardFailure =
    | { readonly kind: 'empty' }
    | {
          readonly kind: 'too_short';
          readonly chars: number;
          readonly min: number;
      }
    | {
          readonly kind: 'unsupported_numbers';
          readonly tokens: readonly string[];
      };

/** 입력 산문 대비 최소 비율. 이보다 짧으면 내용이 소실된 것으로 본다. */
const MIN_RATIO = 0.2;
/** 절대 하한. 입력이 아주 짧아도 이보다 짧으면 글이 아니다. */
const MIN_CHARS = 200;

export interface GuardInput {
    readonly text: string;
    readonly inputChars: number;
    readonly allowed: readonly number[];
}

/**
 * 상한은 두지 않는다. 분석 타입마다 적정 분량이 다르고(실측: 압축률 37~105%),
 * 고정 상한은 특정 타입에 맞춘 상수일 뿐이다. 긴 출력이 무엇을 깨뜨렸는지
 * 관측된 적도 없다.
 */
export function guardPlainText({
    text,
    inputChars,
    allowed,
}: GuardInput): PlainGuardFailure | null {
    const trimmed = text.trim();
    if (trimmed.length === 0) return { kind: 'empty' };

    const min = Math.max(MIN_CHARS, Math.floor(inputChars * MIN_RATIO));
    if (trimmed.length < min) {
        return { kind: 'too_short', chars: trimmed.length, min };
    }

    const tokens = findUnsupportedNumbers(trimmed, allowed);
    if (tokens.length > 0) return { kind: 'unsupported_numbers', tokens };

    return null;
}

/** 재시도 프롬프트에 덧붙일 지적 문구. 같은 입력을 그대로 재전송하지 않기 위함이다. */
export function describeFailure(failure: PlainGuardFailure): string {
    switch (failure.kind) {
        case 'empty':
            return '이전 응답이 비어 있었습니다. 완성된 글을 출력하세요.';
        case 'too_short':
            return `이전 응답이 ${failure.chars}자로 너무 짧아 원본의 내용을 담지 못했습니다. ${failure.min}자 이상으로, 원본의 핵심 판단을 빠뜨리지 말고 다시 쓰세요.`;
        case 'unsupported_numbers':
            return `이전 응답이 입력에 없는 숫자 ${failure.tokens.join(', ')}을(를) 포함했습니다. prose와 facts에 있는 숫자만 사용하고, 퍼센트나 비율을 직접 계산하지 마세요.`;
    }
}
