/**
 * 뉴스 본문이 기사 전문이 아니라 잘린 발췌인지 판정한다.
 *
 * 이 판정이 필요한 이유: 피드는 전문보다 리드 조각을 주는 일이 훨씬 잦고, 그 절단이
 * 문장 중간에서 일어난다. 표시가 없으면 LLM이 조각을 온전한 기사로 읽는데, core 프롬프트는
 * "보고된 수치·성장률·가이던스를 보존하라"고 요구한다 — 잘려서 사라진 정보를 내놓으라는
 * 셈이라 모델이 스스로 채워 넣도록 유인된다. `NewsItem.bodyTruncated`(core v0.46.0)로
 * 알려 주면 프롬프트가 추측 대신 절제를 지시한다.
 *
 * **2026-08-17 실측** (문장이 온전히 끝난 비율):
 *   FMP news/stock         207~351자   2/10   ← 미국 종목 뉴스도 대부분 잘린다
 *   FMP news/general-latest  72~507자   8/10
 *   FMP news/crypto          66~315자  10/10
 *   네이버 description      117~130자   0     (항상 `…`으로 끝남)
 *
 * 소스별로 분기하지 않고 텍스트 형상만 본다. FMP는 `...` 표식조차 없이 끊기므로
 * "네이버만 잘린다"고 가정하면 미국 종목 뉴스 8/10이 미처리로 남는다.
 */

/**
 * 문장이 끝났다고 볼 수 있는 종결 문자.
 *
 * 닫는 인용부호·괄호를 포함하는 이유: `He said "we will grow."` 처럼 마침표 뒤에
 * 인용부호가 오는 정상 종료가 흔하다. 한국어 기사도 `…라고 밝혔다.`로 끝난다.
 */
const SENTENCE_END_RE = /[.!?。？！]["'”’»)\]]*\s*$/;

/** 말줄임 표기 — 절단을 명시적으로 알리는 신호. 유니코드 `…`와 ASCII `...` 모두. */
const ELLIPSIS_RE = /(\.{2,}|…)\s*$/;

/**
 * 판정을 시도할 최소 길이.
 *
 * 아주 짧은 본문(한 줄 헤드라인 요약 등)은 종결부호가 없어도 원래 그런 형태일 수 있어
 * 절단으로 단정하기 어렵다. 이 구간은 판정을 보류해 `false`를 돌려주고, 프롬프트의
 * 기존 "본문 근거가 얕음" 처리에 맡긴다 — 확실하지 않은 표시를 붙이는 것보다
 * 안 붙이는 쪽이 낫다.
 */
const MIN_LENGTH_FOR_JUDGEMENT = 40;

/**
 * 짧아도 절단이 확실한 형태 — **기능어로 끝나는 경우**.
 *
 * 길이 가드만 두면 실측 사례를 놓친다: FMP가 돌려준 `"Apple accounts for about"`(24자)은
 * 짧지만 명백히 문장 중간이다. 전치사·관사·접속사는 뒤에 목적어가 와야 하므로,
 * 이걸로 끝나는 텍스트는 길이와 무관하게 잘린 것이다.
 *
 * 헤드라인 요약은 명사구로 끝나지 이런 기능어로 끝나지 않아, 짧은 정상 본문을
 * 오탐할 위험이 낮다.
 */
const DANGLING_FUNCTION_WORD_RE =
    /\b(the|a|an|and|or|but|of|for|to|in|on|at|by|with|from|about|as|into|over|after|before|than|that|which|its|their|his|her)\s*$/i;

/**
 * `body`가 잘린 발췌인지 판정한다.
 *
 * 판정 순서:
 *   1. 없거나 공백뿐 → `false` (본문 부재는 프롬프트가 이미 별도로 다룬다)
 *   2. 말줄임으로 끝남 → `true` (명시적 절단)
 *   3. 기능어로 끝남 → `true` (길이 무관, 목적어가 빠진 문장)
 *   4. 너무 짧음 → `false` (판정 보류, 위 상수 주석 참조)
 *   5. 종결부호로 끝나지 않음 → `true` (문장 중간 절단)
 *
 * 오탐 방향을 의도적으로 보수적으로 잡았다. 잘렸는데 놓치면 모델이 없는 사실을 지어낼
 * 수 있지만, 안 잘렸는데 잘렸다고 표시하면 요약이 조금 더 신중해질 뿐이다. 그래도
 * 3번 가드를 둔 이유는, 짧은 정상 본문까지 전부 발췌로 표시하면 그 표시의 신호 가치가
 * 희석되기 때문이다.
 */
export function detectTruncatedBody(body: string | null | undefined): boolean {
    const text = body?.trimEnd();
    if (!text) return false;
    if (ELLIPSIS_RE.test(text)) return true;
    if (DANGLING_FUNCTION_WORD_RE.test(text)) return true;
    if (text.length < MIN_LENGTH_FOR_JUDGEMENT) return false;
    return !SENTENCE_END_RE.test(text);
}
