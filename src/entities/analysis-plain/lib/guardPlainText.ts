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

/**
 * 산문 문자열에서 허용 숫자를 긁을 때 쓰는 느슨한 패턴.
 *
 * 선행 부호를 포함한다 — 없으면 `-3.5%`에서 `3.5`만 주워 담는데, 정작
 * `collectNumbers`는 구조화 필드의 `-3.5`를 부호째 넣는다. 두 표기가 어긋나면
 * "전분기 대비 3.5% 하락"처럼 **정상적인 문장이 거부된다**(실측).
 */
const ANY_NUMBER = /-?\d[\d,]*(?:\.\d+)?/g;

const toNumber = (token: string): number => Number(token.replace(/,/g, ''));

/**
 * 한국어 자릿수 단위. `71,500원`을 `7만 1500원`으로 풀어 쓰는 것은 이 레이어가
 * 권장하는 평이한 표기인데, 그렇게 쓰면 원본에 없는 `1500`이 생겨 거부됐다.
 * 원본 숫자를 만/억/조로 분해했을 때 나오는 조각을 허용 집합에 함께 넣는다.
 */
const KOREAN_UNITS = [10_000, 100_000_000, 1_000_000_000_000] as const;

/**
 * `n`을 한국어 단위로 분해했을 때 문장에 등장할 수 있는 조각들.
 *
 * 나머지를 다시 분해한다 — `42조 3000억`에서 `3000`이 나오려면 `3000억`(3e11)을
 * 한 번 더 억으로 쪼개야 하고, 한 겹만 벗기면 그 조각이 빠진다.
 */
function koreanUnitParts(n: number, depth = 0): number[] {
    if (!Number.isFinite(n) || depth > KOREAN_UNITS.length) return [];
    const abs = Math.abs(n);
    const parts: number[] = [];
    for (const unit of KOREAN_UNITS) {
        if (abs < unit) break;
        const head = Math.floor(abs / unit);
        const tail = abs % unit;
        parts.push(head, ...koreanUnitParts(head, depth + 1));
        if (tail > 0) parts.push(tail, ...koreanUnitParts(tail, depth + 1));
    }
    return parts;
}
const decimalPlaces = (token: string): number =>
    (token.split('.')[1] ?? '').length;

/** 허용 숫자 집합 — facts의 숫자 + 입력 산문 안에 등장한 모든 숫자. */
export function buildAllowedNumbers(
    factNumbers: readonly number[],
    proseTexts: readonly string[]
): number[] {
    const seed = [...factNumbers];
    for (const text of proseTexts) {
        for (const match of text.matchAll(ANY_NUMBER)) {
            const value = toNumber(match[0]);
            if (Number.isFinite(value)) seed.push(value);
        }
    }

    // 부호와 한국어 단위 분해까지 허용 집합에 편다. 검사기가 **표기 차이**를
    // 환각으로 잘못 잡으면 그 결과는 재작성 폐기(`plain: null`)이므로,
    // 관대함의 비용(우연히 일치하는 환각 통과)보다 손실이 크다.
    const allowed = new Set<number>();
    for (const n of seed) {
        if (!Number.isFinite(n)) continue;
        allowed.add(n);
        allowed.add(Math.abs(n));
        for (const part of koreanUnitParts(n)) allowed.add(part);
    }
    return [...allowed];
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
/**
 * 연도는 가격이 아니다.
 *
 * `2027년까지 지켜봐야` 같은 문장의 `2027`은 원본 숫자 집합에 없을 수 있는데,
 * 4자리 정수라 `PRICE_TOKEN`이 가격으로 잡아 재작성을 통째로 폐기했다.
 * 뒤에 `년`이 붙은 4자리 정수만 면제한다 — 접미사를 요구하므로 `2027달러`처럼
 * 진짜 가격 자리에 쓰인 같은 숫자는 그대로 검사 대상이다.
 */
function isYearToken(token: string, text: string, end: number): boolean {
    if (!/^\d{4}$/.test(token)) return false;
    const value = Number(token);
    if (value < 1900 || value > 2200) return false;
    return text.slice(end, end + 1) === '년';
}

export function findUnsupportedNumbers(
    text: string,
    allowed: readonly number[]
): string[] {
    const unsupported: string[] = [];
    for (const match of text.matchAll(PRICE_TOKEN)) {
        const token = match[1];
        if (isYearToken(token, text, match.index + match[0].length)) continue;
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
