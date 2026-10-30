import { DEFAULT_LOCALE, type Locale } from '@/shared/i18n/locales';
import { SEO_SNAPSHOT_DESCRIPTION_MAX_LENGTH } from '@/shared/lib/seoClamp';
import { stripSnapshotMarkdown } from '@/shared/lib/stripSnapshotMarkdown';

/**
 * SEO 프리웜 스냅샷의 탭별로, `content`가 싣는 주 한국어 산문 필드를 가리킨다
 * (`src/views/symbol/snapshot/renderers/*`와 대조): technical→`summary`,
 * overall→`headlineKo`, fundamental/financials→`overallConclusionKo`,
 * congress→`summaryKo`, options→`summary`, news→`currentDriverKo`.
 *
 * 키 타입을 `SeoSnapshotTab`이 아니라 `string`으로 둔다 — `shared`는
 * `entities/seo-snapshot`을 import할 수 없다(FSD 방향: entities→shared). 호출부
 * (`entities`/`app`)가 `SeoSnapshotTab` 값을 넘기면 구조적으로 `string`을 만족한다.
 */
const SNAPSHOT_META_DESCRIPTION_FIELD: Record<string, string> = {
    technical: 'summary',
    overall: 'headlineKo',
    fundamental: 'overallConclusionKo',
    financials: 'overallConclusionKo',
    congress: 'summaryKo',
    options: 'summary',
    news: 'currentDriverKo',
};

/**
 * `\n`으로 나뉜 주제 줄들을 공백으로 이은 한 줄로 합친다(렌더러의 문단 분리 규약을
 * 따르되, 한 줄짜리 `<meta description>` 발췌용).
 *
 * 마크다운 기호를 먼저 뗀다 — 스냅샷 필드는 화면에서 `MarkdownText`로 그리는 마크다운이라,
 * 그대로 두면 SERP 스니펫에 `**종합 진단**:`이 글자로 나간다(v0.79.2 배포 후 운영 크롤).
 * 줄 머리 기호(`- `·`#`)를 줄 단위로 인식해야 하므로 줄을 합치기 **전에** 적용한다.
 */
export function collapseToSingleLine(text: string): string {
    return stripSnapshotMarkdown(text)
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join(' ');
}

/**
 * 원문 필드 경로 전용 — 맨 앞 라벨·소제목 줄 제거 규칙 (2026-10-04 운영 크롤).
 *
 * 평이화 경로(`plain`)는 이 규칙을 타지 않는다. 원문은 LLM이 쓴 마크다운 필드라
 * 두 가지 머리말이 SERP 첫머리로 새어 나왔다:
 *  - 소제목 줄: `/AAPL`의 `"애플(AAPL) 일봉 종합 분석\n추세 방향과 강도\n분석 시점…"`이
 *    줄바꿈 제거로 `…종합 분석 추세 방향과 강도 분석 시점…`처럼 문장에 이어 붙었다.
 *  - 라벨: 차트 348개 중 55개가 `현재 상황:`·`요약:`으로 시작했다.
 */
const SENTENCE_TERMINATOR_PATTERN = /[!?。]|\.(?!\d)/;
// 소제목은 짧아야 한다 — 긴 줄은 종결부호가 없어도 본문 문장이다.
const HEADING_LINE_MAX_CODE_POINTS = 30;
// 단어 ≤ 2개(각 ≤ 12자) + 콜론 + **공백**. 콜론 뒤 공백을 요구해 `09:30`·`1:2`
// 같은 시각·비율 표기는 라벨로 보지 않는다. `.`은 단어에서 빼서 문장 중간의
// 콜론이 라벨로 오인되지 않게 한다(첫 종결부호 앞까지만 훑는다).
const LEADING_LABEL_PATTERN =
    /^[^\s.:：!?]{1,12}(?:\s[^\s.:：!?]{1,12})?\s*[:：]\s+/;

/**
 * 뒤에 줄이 더 있는, 종결부호 없는 짧은 줄을 소제목으로 보고 **앞에서부터** 떼어
 * 낸다. 첫 본문 줄에서 멈추며, 마지막 줄은 뒤따르는 줄이 없으므로 항상 남는다.
 * 소수점(`333.69`)은 종결부호가 아니다.
 */
function dropLeadingHeadingLines(lines: readonly string[]): string[] {
    const firstBodyIndex = lines.findIndex(
        (line, index) =>
            index === lines.length - 1 ||
            SENTENCE_TERMINATOR_PATTERN.test(line) ||
            [...line].length > HEADING_LINE_MAX_CODE_POINTS
    );
    return lines.slice(firstBodyIndex);
}

// 라벨 뒤가 숫자·통화 기호로 시작하면 콜론 앞은 라벨이 아니라 그 값의 주어다
// ("삼성전자 주가: 70,000원에", "RSI: 70이며") — 떼면 무엇의 값인지가 사라진다.
const VALUE_START_PATTERN = /^[\d$₩€¥£+\-−.]/;

/**
 * 맨 앞 라벨(`현재 상황: `, `요약: `)을 한 번 뗀다. 남은 문장이 값으로 시작하면
 * 콜론 앞이 주어라 떼지 않는다(2026-10-04 리뷰).
 */
function stripLeadingLabel(text: string): string {
    const match = LEADING_LABEL_PATTERN.exec(text);
    if (match === null) return text;
    const rest = text.slice(match[0].length);
    return VALUE_START_PATTERN.test(rest) ? text : rest.trim();
}

/**
 * 원문 필드를 한 줄로 합치되 머리말(소제목 줄, 맨 앞 라벨)을 뗀다. 떼고 나서
 * 비면 떼기 전 텍스트로 돌아간다.
 */
function collapseRawToSingleLine(text: string): string {
    const lines = stripSnapshotMarkdown(text)
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
    const unstripped = lines.join(' ');
    const body = dropLeadingHeadingLines(lines).join(' ');
    const stripped = stripLeadingLabel(body);
    return stripped.length > 0 ? stripped : unstripped;
}

// 문장 종결부호를 자르는 지점으로 인정하는 범위 — 하드 컷에서 이 코드포인트 수
// 이내여야 한다. 초과 문자열의 앞쪽 종결부호에서 자르면 필요 이상으로 짧아져
// SERP 스니펫 예산 대부분을 버리게 된다.
const SENTENCE_BOUNDARY_SEARCH_WINDOW = 40;

/**
 * 평이화 설명이 이보다 짧으면(주어 접두 제외, 코드포인트) 원문 필드로 폴백한다.
 *
 * 2026-09-17 운영 크롤: 차트 탭 420개 중 118개, 종합 탭 382개 중 104개의 설명이
 * 70자 미만이었다. 평이화 첫 문장이 "애플 주가는 지금 332.41달러입니다."(22자) 같은
 * 가격 한 줄이고 둘째 문장이 예산을 넘어 거기서 멈춘 것이다. 가격은 SERP에서 곧
 * 낡고, 두 탭의 평이화가 같은 문장으로 시작해 차트·종합 설명이 23쌍 중복됐다.
 * 원문 필드는 탭마다 다르고 내용이 있다.
 */
const PLAIN_DESCRIPTION_MIN_LENGTH = 40;
const SENTENCE_TERMINATORS = new Set(['.', '!', '?']);

/** `codePoints[index]`가 두 숫자 사이의 `.`(소수점, 예: "3.5%")인지 — 문장 끝 마침표와 구분한다. */
function isDecimalPoint(codePoints: readonly string[], index: number): boolean {
    if (codePoints[index] !== '.') return false;
    const prev = codePoints[index - 1];
    const next = codePoints[index + 1];
    return (
        prev !== undefined &&
        next !== undefined &&
        /\d/.test(prev) &&
        /\d/.test(next)
    );
}

/**
 * 예산 안에 들어가는 **온전한 문장들**만 이어 붙인다. 하나도 못 넣으면 `null`.
 *
 * `clampAtSentenceBoundary`와 다르다. 그쪽은 하드 컷 지점에서 뒤로 40자만
 * 훑어 종결부호를 찾고, 못 찾으면 `…`로 자른다 — 첫 문장이 예산보다 길면
 * 무조건 잘린다. 이 함수는 자르지 않고 **넣을 수 있는 만큼만** 넣는다.
 *
 * 평이화 산문에 이 규칙이 필요한 이유: 평이화는 헤드라인 전용 필드가 없어
 * 본문 첫 문장부터 쓰게 되는데, 그게 원문의 `headlineKo`보다 길다(실측 40건,
 * overall 평균 94자 → 104자). 그대로 클램프하면 잘림이 2/40에서 11/40으로
 * 늘었다. 문장 단위로만 담으면 잘림이 구조적으로 0이 되고, 한 문장도 못 담는
 * 경우에만 호출자가 원문으로 폴백한다.
 */
export function takeWholeSentences(
    text: string,
    maxLength: number
): string | null {
    // 한국어 종결(`다.`)과 일반 종결부호를 모두 끊는다. CJK 종결부호는 공백을
    // 두지 않으므로 공백을 요구하지 않는다.
    const sentences = text
        .split(/(?<=다\.)\s*|(?<=[.!?。])\s+/)
        .map(part => part.trim())
        .filter(part => part.length > 0);

    let out = '';
    for (const sentence of sentences) {
        const next = out === '' ? sentence : `${out} ${sentence}`;
        if ([...next].length > maxLength) break;
        out = next;
    }
    return out === '' ? null : out;
}

/**
 * `text`를 `maxLength` 코드포인트로 자르되, 하드 컷에서 {@link SENTENCE_BOUNDARY_SEARCH_WINDOW}
 * 코드포인트 이내의 마지막 문장 종결부호(`.`/`!`/`?`)에서 끊는 쪽을 택한다 — SERP
 * 스니펫에서는 문장 중간에서 잘린 것보다 온전한 마지막 문장이 낫다. 그 범위에 종결부호가
 * 없으면 하드 컷 + `…`로 떨어진다(`clampSeoDescription`과 같은 동작). 서로게이트 쌍을
 * 쪼개지 않도록 전 과정을 코드포인트 기준으로 센다.
 */
export function clampAtSentenceBoundary(
    text: string,
    maxLength: number
): string {
    const codePoints = [...text];
    if (codePoints.length <= maxLength) return text;

    const truncated = codePoints.slice(0, maxLength - 1);
    const windowStart = Math.max(
        0,
        truncated.length - SENTENCE_BOUNDARY_SEARCH_WINDOW
    );
    for (let i = truncated.length - 1; i >= windowStart; i--) {
        const char = truncated[i];
        if (
            char !== undefined &&
            SENTENCE_TERMINATORS.has(char) &&
            !isDecimalPoint(codePoints, i)
        ) {
            return truncated
                .slice(0, i + 1)
                .join('')
                .trimEnd();
        }
    }
    return truncated.join('').trimEnd() + '…';
}

/**
 * 프리웜된 SEO 스냅샷의 주 산문 필드에서, 해당 탭의 고유한 `<meta name="description">`
 * 발췌를 만든다. 앞에 `subject`를 붙인다. 탭을 모르거나, `content`가 객체가 아니거나,
 * 필드가 없거나 문자열이 아니거나, 트림 후 비어 있으면 `null`을 반환한다 — 호출부는
 * 그때 기존 템플릿 `buildSymbol*SeoContent(...).description`으로 폴백한다.
 *
 * `subject`는 짧은 {@link buildTitleSubject} 형태(`애플(AAPL)`, `삼성전자(005930)`)다.
 * 긴 표시명(`애플, Apple Inc. (AAPL)`, 최대 86 코드포인트 더 길다)을 쓰면 문장 예산을
 * 먹어 첫 문장이 들어가지 않는다. 그 뒤에 탭 `label`이 붙고, 접두는 클램프 **전에**
 * 붙인다 — 모든 템플릿 빌더(`buildSymbol*SeoContent`)가 subject로 시작하고, 목표 쿼리
 * ("AAPL 주가 분석")가 SERP 스니펫의 굵은 글씨 매칭에 그것을 필요로 하기 때문이다.
 * 제목은 더 이상 전망을 약속하지 않는다 — YMYL 페이지가 가격 예측을 주장하면 안 되어
 * 모든 `titleCore`에서 "전망"을 "분석"으로 바꿨고, 쿼리 매칭은 쿼리가 실제로 싣는
 * "주가"/"시세" 접두가 맡는다.
 *
 * `content`는 의도적으로 `unknown`이다 — `*SnapshotProse` 렌더러와 같은 방어적
 * 좁히기 규약(저장 타입이 `unknown`이고 탭마다 스키마가 다르다). 응답 전체 형태는
 * 검증하지 않고 읽는 필드 하나만 본다.
 */
export function buildSnapshotMetaDescription(
    tab: string,
    content: unknown,
    subject: string,
    /**
     * 프리웜이 함께 구워 둔 평이화 산문. 있으면 **이쪽을 먼저 시도한다.**
     *
     * SERP에 노출되는 두 줄이 여기서 나온다. 원문 필드는 전문 용어를 그대로
     * 싣는다(실측: `"기술적 이중천장 패턴과 … 재무 스코어카드 부진이…"`).
     * 평이화는 같은 내용을 일상어로 말하므로 클릭 판단에 쓸모가 있다.
     *
     * ⚠️ **문장 단위로만 담고, 한 문장도 안 들어가면 원문으로 떨어진다.**
     * 평이화에는 헤드라인 전용 필드가 없어 본문 첫 문장부터 쓰게 되는데 그게
     * 원문 `headlineKo`보다 길다(실측 40건, overall 평균 94자 → 104자). 그대로
     * 클램프하면 잘림이 2/40 → 11/40으로 늘었다. `takeWholeSentences`가 그
     * 교환을 없앤다 — 평이화를 쓰면 잘리지 않고, 잘릴 상황이면 아예 원문을 쓴다.
     */
    plain: string | null | undefined,
    // 기본값을 두지 않는다 — 두면 호출부에서 빠져도 컴파일이 통과하고,
    // 그 탭만 조용히 한국어 설명으로 되돌아간다(`buildDisplayName`과 같은 규약).
    locale: Locale,
    /**
     * 탭 라벨(`주가 분석`·`펀더멘털`…). {@link symbolTabDescriptionLabel}이 준다.
     *
     * 프리픽스를 `{subject} {label} — `로 만들어 **같은 종목의 두 탭이 같은
     * description을 낼 수 없게** 한다(2026-09-20 네이버 중복 감지, `/SOXS`). 기본값을
     * 두지 않는 이유는 `locale`과 같다 — 빠뜨린 탭만 조용히 충돌 가능 상태로 남는다.
     */
    label: string
): string | null {
    /**
     * 스냅샷은 **로케일 없이** 저장된다 — `getSeoSnapshotsStatic(ticker, …)`에
     * 로케일 인자가 없다. 그래서 `content`의 산문은 항상 한국어다.
     *
     * 이걸 그대로 쓰면 `/en/AAPL`의 `<meta name="description">`이
     * `Apple Inc. (AAPL) — 애플(AAPL) 주식은 최근 급락 이후…`가 되고, 같은
     * 문서의 `og:description`은 영어라 **한 페이지가 두 언어로 말한다.**
     *
     * 비-ko에서는 null을 반환해 템플릿 설명(번역됨)으로 떨어진다. 스냅샷이
     * 로케일별로 저장되면 이 게이트를 로케일 비교로 바꾸면 된다.
     */
    if (locale !== DEFAULT_LOCALE) return null;

    const field = SNAPSHOT_META_DESCRIPTION_FIELD[tab];
    if (field === undefined) return null;
    if (typeof content !== 'object' || content === null) return null;

    const prefix = `${subject} ${label}: `;
    const budget = SEO_SNAPSHOT_DESCRIPTION_MAX_LENGTH - [...prefix].length;

    if (typeof plain === 'string' && plain.trim().length > 0) {
        const whole = takeWholeSentences(collapseToSingleLine(plain), budget);
        if (whole !== null && [...whole].length >= PLAIN_DESCRIPTION_MIN_LENGTH)
            return `${prefix}${whole}`;
        // 한 문장도 예산에 안 들어가거나, 들어간 게 가격 한 줄처럼 너무 짧다 —
        // 아래 원문 경로로 떨어진다(`PLAIN_DESCRIPTION_MIN_LENGTH`).
    }

    const raw: unknown = Reflect.get(content, field);
    if (typeof raw !== 'string') return null;

    const singleLine = collapseRawToSingleLine(raw);
    if (singleLine.length === 0) return null;

    // 평이화 경로와 같은 규칙: 문장 단위로만 담는다. 첫 문장조차 예산에 안 들어갈 때만
    // 잘라 `…`를 붙인다 — 예전에는 하드 컷 지점에서 40자만 뒤로 훑어 종결부호를 찾았고,
    // 못 찾으면 문장 중간에서 끊겼다.
    const whole = takeWholeSentences(singleLine, budget);
    if (whole !== null) return `${prefix}${whole}`;
    return clampAtSentenceBoundary(
        `${prefix}${singleLine}`,
        SEO_SNAPSHOT_DESCRIPTION_MAX_LENGTH
    );
}
