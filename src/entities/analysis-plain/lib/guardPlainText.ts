import { plainLanguageRetryHint } from './outputLanguage';
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
 * 자릿수 단위. `71,500원`을 `7만 1500원`으로 풀어 쓰는 것은 이 레이어가
 * 권장하는 평이한 표기인데, 그렇게 쓰면 원본에 없는 `1500`이 생겨 거부됐다.
 * 원본 숫자를 단위로 분해했을 때 나오는 조각을 허용 집합에 함께 넣는다.
 *
 * 한국어·일본어·중국어는 만 단위(10^4)로 끊는 같은 체계라 **분해 결과가 같다** —
 * 万=만=10^4, 億=억=10^8. 이 함수가 돌려주는 것은 문자가 아니라 숫자이므로
 * 세 언어가 같은 배열을 공유한다. 영어만 백만/십억(10^6·10^9)으로 끊는다.
 */
const UNITS = [
    10_000, // 만 / 万
    1_000_000, // million
    100_000_000, // 억 / 億
    1_000_000_000, // billion
    1_000_000_000_000, // 조 / 兆 / trillion
] as const;

/**
 * `n`을 자릿수 단위로 분해했을 때 문장에 등장할 수 있는 조각들.
 *
 * 나머지를 다시 분해한다 — `42조 3000억`에서 `3000`이 나오려면 `3000억`(3e11)을
 * 한 번 더 억으로 쪼개야 하고, 한 겹만 벗기면 그 조각이 빠진다.
 *
 * **로케일을 받지 않고 두 체계를 모두 편다.** 만 단위와 백만 단위를 갈라 놓으면
 * `buildAllowedNumbers`와 그 호출자 전부에 로케일을 실어 날라야 하는데, 얻는 것은
 * 허용 집합에서 값 몇 개를 빼는 것뿐이다. 이 집합의 목적은 **표기 차이를 환각으로
 * 잘못 잡지 않는 것**이고(아래 주석), 좁힐수록 손실이 커지는 방향이다.
 */
function unitParts(n: number, depth = 0): number[] {
    if (!Number.isFinite(n) || depth > UNITS.length) return [];
    const abs = Math.abs(n);
    const parts: number[] = [];
    for (const unit of UNITS) {
        if (abs < unit) break;
        const head = Math.floor(abs / unit);
        const tail = abs % unit;
        parts.push(head, ...unitParts(head, depth + 1));
        if (tail > 0) parts.push(tail, ...unitParts(tail, depth + 1));
    }
    return parts;
}
const decimalPlaces = (token: string): number =>
    (token.split('.')[1] ?? '').length;

/** 허용 숫자 집합 — facts의 숫자 + 입력 산문 안에 등장한 모든 숫자. */
/**
 * `285.5B`처럼 영문 크기 접미사가 붙은 표기의 **실제 값**.
 *
 * 이게 없으면 재무·펀더멘털 탭의 평이화가 **빠져나갈 길이 없다.** 원본에
 * `총부채는 285.5B`가 있을 때, 접미사를 그대로 옮기면 `magnitude_suffix`가
 * 막고(10배 금액 오류 방지), 풀어서 `2,855억`이라 쓰면 그 숫자가 허용 집합에
 * 없어 `unsupported_numbers`가 막는다. 실측: 두 탭 모두 초회·재시도 2번 다
 * 이 두 가드에 번갈아 걸려 평이화가 아예 만들어지지 않았다.
 *
 * 실제 값을 넣어 두면 자릿수 분해(`unitParts`)가 `2855`·`285`를 함께 펴므로
 * 한국어 표기가 통과한다. 접미사 자체는 여전히 금지다 — 뚫는 것은 "풀어 쓰는
 * 길"이지 "그대로 옮기는 길"이 아니다.
 */
const MAGNITUDE_VALUE = /(\d[\d,]*(?:\.\d+)?)([BMK])(?![A-Za-z])/g;
const MAGNITUDE_SCALE: Record<string, number> = {
    K: 1e3,
    M: 1e6,
    B: 1e9,
};

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
        for (const match of text.matchAll(MAGNITUDE_VALUE)) {
            const scaled =
                toNumber(match[1]) * (MAGNITUDE_SCALE[match[2]] ?? 1);
            if (Number.isFinite(scaled)) seed.push(scaled);
        }
    }

    // 부호와 자릿수 단위 분해까지 허용 집합에 편다. 검사기가 **표기 차이**를
    // 환각으로 잘못 잡으면 그 결과는 재작성 폐기(`plain: null`)이므로,
    // 관대함의 비용(우연히 일치하는 환각 통과)보다 손실이 크다.
    const allowed = new Set<number>();
    for (const n of seed) {
        if (!Number.isFinite(n)) continue;
        allowed.add(n);
        allowed.add(Math.abs(n));
        for (const part of unitParts(n)) allowed.add(part);
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

/**
 * 숫자에 **바로 붙은** 영문 크기 접미사(`1,573.1B`). 원본에서 넘어오는 표기이고,
 * 그대로 옮기면 자릿수 오류로 이어진다.
 *
 * 공백을 허용하지 않는다 — `3 M&A 건` 같은 정상 문장을 접미사로 오인해 재작성을
 * 통째로 버리게 된다(실측). 원본 표기가 항상 붙여 쓰는 형태라 이걸로 충분하다.
 */
const MAGNITUDE_SUFFIX = /\d[BMK](?![A-Za-z])/g;

/**
 * 한국어 산문에 섞여 들어온 한자.
 *
 * 실측: `"이是国内 상장사 역사상 가장 큰 규모라"` — 모델이 한국어를 쓰다 중국어로
 * 새어 나갔다. 숫자도 용어도 멀쩡해 다른 가드는 전부 통과했고, 블라인드 평가자는
 * "글이 고장 난 거라 신뢰도가 확 떨어졌다"고 답했다.
 *
 * 산출물이 대상 언어의 문자만 쓰는지 본다.
 *
 * 예전에는 한자만 막았다 — 산출물이 한국어라고 못 박고 있었기 때문이다. 로케일
 * 지원이 들어오면서 그 전제가 깨졌다: 일본어 출력은 한자를, 중국어 출력은 한자만
 * 쓴다. 반대로 **한글이 섞이는 쪽**이 이제 진짜 결함이다 — 실측에서 ja·zh 요청이
 * 3/3 모두 한국어로 돌아왔고, 한자를 한 글자도 안 써서 옛 가드는 조용히 통과시켰다.
 *
 * 그래서 "한자 금지"가 아니라 **로케일별 금지 문자 계열**로 뒤집는다. 잘못된
 * 언어로 나온 산출물은 여기서 걸려 재시도로 넘어가고, 끝내 실패하면 평이화가
 * 없는 원본 뷰만 노출된다 — 일본어 사용자에게 한국어 문단을 보여주는 것보다 낫다.
 */
const SCRIPT = {
    han: /[\u3400-\u4DBF\u4E00-\u9FFF]+/g,
    kana: /[\u3040-\u30FF]+/g,
    hangul: /[\uAC00-\uD7AF]+/g,
} as const;

type ScriptName = keyof typeof SCRIPT;

/**
 * 로케일별로 **나오면 안 되는** 문자 계열.
 *
 * 알 수 없는 로케일은 `ko` 규칙으로 떨어진다 — 프롬프트도 같은 값에서 한국어로
 * 떨어지므로 둘이 어긋나지 않는다.
 */
const DISALLOWED_SCRIPTS: Record<string, readonly ScriptName[]> = {
    ko: ['han', 'kana'],
    ja: ['hangul'],
    zh: ['hangul', 'kana'],
    en: ['han', 'kana', 'hangul'],
};

function findForeignScript(text: string, locale: string): string[] {
    const banned = DISALLOWED_SCRIPTS[locale] ?? DISALLOWED_SCRIPTS.ko;
    return banned.flatMap(name =>
        [...text.matchAll(SCRIPT[name])].map(m => m[0])
    );
}

/** 산출물이 통과하지 못한 이유. 재시도 프롬프트에 그대로 실린다. */
export type PlainGuardFailure =
    | { readonly kind: 'empty' }
    | { readonly kind: 'foreign_script'; readonly tokens: readonly string[] }
    | { readonly kind: 'magnitude_suffix'; readonly tokens: readonly string[] }
    | {
          readonly kind: 'too_short';
          readonly chars: number;
          readonly min: number;
      }
    | {
          readonly kind: 'unsupported_numbers';
          readonly tokens: readonly string[];
      };

export interface GuardInput {
    readonly text: string;
    readonly inputChars: number;
    readonly allowed: readonly number[];
    /** 출력 언어. 어느 문자 계열이 금지인지 결정한다. 생략하면 `'ko'`. */
    readonly locale?: string;
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
    locale = 'ko',
}: GuardInput): PlainGuardFailure | null {
    const trimmed = text.trim();
    if (trimmed.length === 0) return { kind: 'empty' };

    const min = Math.max(MIN_CHARS, Math.floor(inputChars * MIN_RATIO));
    if (trimmed.length < min) {
        return { kind: 'too_short', chars: trimmed.length, min };
    }

    const foreign = findForeignScript(trimmed, locale);
    if (foreign.length > 0) return { kind: 'foreign_script', tokens: foreign };

    // 크기 접미사를 그대로 옮기면 **10배 금액 오류**가 난다. 실측: 원본 `3,475.2B`
    // (3.48조원)를 `3,475.2억 원`(0.35조)으로 쓴 사례가 있었고, 숫자 자체는 허용
    // 집합에 있어 숫자 가드를 그대로 통과했다 — 단위는 아무도 보지 않았다.
    // 평이한 한국어 산문에 `123B` 같은 표기가 정당하게 등장할 일은 없다.
    const magnitudes = [...trimmed.matchAll(MAGNITUDE_SUFFIX)].map(m => m[0]);
    if (magnitudes.length > 0) {
        return { kind: 'magnitude_suffix', tokens: magnitudes };
    }

    const tokens = findUnsupportedNumbers(trimmed, allowed);
    if (tokens.length > 0) return { kind: 'unsupported_numbers', tokens };

    return null;
}

/** 입력 산문 대비 최소 비율. 이보다 짧으면 내용이 소실된 것으로 본다. */
const MIN_RATIO = 0.2;
/** 절대 하한. 입력이 아주 짧아도 이보다 짧으면 글이 아니다. */
const MIN_CHARS = 200;

/**
 * 문장 분해. 한국어 종결(`…다.`)과 서양식 종결부호를 함께 본다.
 *
 * 완벽한 분해가 목표가 아니다 — 어긋난 숫자가 든 **덩어리**를 도려내는 것이
 * 목적이므로, 경계를 조금 넓게 잡아도 결과가 안전한 쪽으로 기운다.
 */
/**
 * 일본어·중국어는 문장 끝 `。` 뒤에 공백을 두지 않는다. 공백을 요구하는 분기만
 * 두면 그 두 언어에서는 문단 전체가 문장 하나로 잡혀, 도려내기가 문장 하나가
 * 아니라 **문단 전체**를 버린다 — 살리기가 목적인 함수가 정반대로 동작한다.
 * 그래서 CJK 종결부호는 공백 없이도 끊는다.
 */
function splitSentences(paragraph: string): string[] {
    return paragraph
        .split(/(?<=[.!?]|다\.)\s+|(?<=[。！？])/)
        .filter(s => s.trim().length > 0);
}

/**
 * 어긋난 숫자가 든 문장만 도려낸 텍스트. 살릴 수 없으면 `null`.
 *
 * ## 왜 전체를 버리지 않는가
 *
 * 이 가드는 원래 all-or-nothing이었다. 숫자 하나가 어긋나면 글 전체를 폐기했고,
 * 그 설계가 **프롬프트 개선을 막고 있었다** — 어휘를 풀어 쓰라고 지시할수록 글이
 * 길어지고, 길어질수록 숫자를 더 많이 언급하고, 그만큼 폐기 확률이 올랐다.
 * 실측: 어휘 규칙을 강화한 4개 판본에서 최종 실패가 3건 → 17·24·22건으로 늘었다.
 * 비전문가 이해도(블라인드 평가 2.57·1.86/5점)를 올리려면 이 결합을 먼저 끊어야 한다.
 *
 * 실패 사례를 재현해 보면 위반은 대개 **문장 한두 개에 몰려 있다** — 5건을 다시
 * 돌린 결과 전부 문장 1~3개(전체의 5~16%)를 빼는 것만으로 잔여 위반 0이 됐다.
 * 문단 몇 문장을 잃는 것이 쉽게보기가 통째로 사라지는 것보다 낫다.
 *
 * 도려낸 뒤에도 길이 하한을 다시 검사한다 — 남은 글이 요약도 못 되는 조각이면
 * 그때는 정말로 버린다.
 */
export function salvageByRemovingSentences(
    text: string,
    allowed: readonly number[],
    inputChars: number
): string | null {
    const unsupported = findUnsupportedNumbers(text, allowed);
    if (unsupported.length === 0) return text;

    const cleaned = text
        .split(/\n\s*\n/)
        .map(paragraph =>
            splitSentences(paragraph)
                .filter(
                    sentence =>
                        !unsupported.some(token => sentence.includes(token))
                )
                .join(' ')
        )
        .filter(paragraph => paragraph.trim().length > 0)
        .join('\n\n')
        .trim();

    // 도려낸 결과가 스스로 가드를 통과해야 한다. 잔여 위반이 남거나(문장 경계를
    // 잘못 잡은 경우) 너무 짧아지면 살리지 않는다.
    if (findUnsupportedNumbers(cleaned, allowed).length > 0) return null;
    if (
        cleaned.length < Math.max(MIN_CHARS, Math.floor(inputChars * MIN_RATIO))
    ) {
        return null;
    }
    return cleaned;
}

/** 재시도 프롬프트에 덧붙일 지적 문구. 같은 입력을 그대로 재전송하지 않기 위함이다. */
export function describeFailure(
    failure: PlainGuardFailure,
    /** 출력 언어. `foreign_script` 지적이 어느 언어를 요구할지 정한다. */
    locale = 'ko'
): string {
    switch (failure.kind) {
        case 'empty':
            return '이전 응답이 비어 있었습니다. 완성된 글을 출력하세요.';
        case 'too_short':
            return `이전 응답이 ${failure.chars}자로 너무 짧아 원본의 내용을 담지 못했습니다. ${failure.min}자 이상으로, 원본의 핵심 판단을 빠뜨리지 말고 다시 쓰세요.`;
        case 'foreign_script': {
            // 지적문을 한국어로 쓰면 그것이 또 하나의 한국어 본보기가 되어,
            // 정정하려는 실패(한국어로 나온 출력)를 오히려 강화한다.
            const inTarget = plainLanguageRetryHint(locale);
            if (inTarget !== null) return inTarget;
            return `이전 응답에 한국어가 아닌 글자 ${failure.tokens.join(', ')}가 섞여 있었습니다. 전체를 한국어로만 쓰세요.`;
        }
        case 'magnitude_suffix':
            return `이전 응답이 ${failure.tokens.join(', ')}처럼 영문 크기 표시가 붙은 숫자를 그대로 옮겼습니다. 그 표기는 쓰지 말고, 해당 항목이 많은지 적은지 또는 늘었는지 줄었는지를 말로 쓰세요.`;
        case 'unsupported_numbers':
            return `이전 응답이 입력에 없는 숫자 ${failure.tokens.join(', ')}을(를) 포함했습니다. prose와 facts에 있는 숫자만 사용하고, 퍼센트나 비율을 직접 계산하지 마세요.`;
    }
}
