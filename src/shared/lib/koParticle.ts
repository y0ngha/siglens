/**
 * 한국어 조사 선택 규칙.
 *
 * 여기 있는 `'과'`/`'와'` 같은 값은 **번역 대상이 아니다** — 로케일 문구가 아니라
 * 한국어 문법 그 자체다. ICU는 받침 규칙을 모르므로 판정은 소스가 해야 하고,
 * ko 메시지가 `{v0}` 자리에 이미 조사가 붙은 값을 받는 식으로 쓴다.
 *
 * 다른 로케일은 이 모듈을 쓰지 않는다.
 */

/** 한글 음절 블록의 시작 코드포인트(`가`). */
const HANGUL_SYLLABLE_START = 0xac00;
/** 한글 음절 블록의 끝 코드포인트(`힣`). */
const HANGUL_SYLLABLE_END = 0xd7a3;
/** 초성 19 × 중성 21 = 종성 주기. 나머지가 0이면 받침이 없다. */
const JONGSEONG_CYCLE = 28;

/** 앞 음절에 받침이 있는가. 한글 음절이 아니면 `false`. */
export function hasBatchim(word: string): boolean {
    const last = word.codePointAt(word.length - 1) ?? 0;
    return (
        last >= HANGUL_SYLLABLE_START &&
        last <= HANGUL_SYLLABLE_END &&
        (last - HANGUL_SYLLABLE_START) % JONGSEONG_CYCLE !== 0
    );
}

/** 동반 조사 `과`/`와`를 고른다(`중립과`, `공포와`). */
export function koWithParticle(word: string): string {
    return `${word}${hasBatchim(word) ? '과' : '와'}`;
}
