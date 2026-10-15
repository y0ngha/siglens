/**
 * 한글 종목 검색의 **매칭 키** — 사용자가 치는 표기와 저장된 표기의 흔한 차이를 접는다.
 *
 * 외래어 회사명은 한글 표기가 사람마다 갈린다. 저장된 이름은 하나뿐이라 그대로 비교하면
 * `써클`(저장: `서클 인터넷 그룹`), `에스케이하이닉스`(저장: `SK하이닉스`)가 0건이 된다.
 * 별칭(`KOREAN_SEARCH_ALIASES`)으로 하나씩 메우는 대신, 규칙으로 설명되는 차이는 여기서
 * 양쪽(질의·저장명)에 같은 변환을 걸어 접는다.
 *
 * 접는 차이는 **외래어 표기에서 흔히 갈리는** 것으로 한정한다 — 넓게 접을수록
 * 서로 다른 회사가 같은 키를 갖는다.
 *
 * ⚠️ 감수한 대가: 된소리 접기는 외래어만 골라 접지 못해 고유어 최소쌍(`사`/`싸`,
 * `달`/`딸`)도 같은 키가 된다. 그래서 `싸` 질의에 `사`로 시작하는 종목도 걸린다.
 * 정확히 일치한 결과는 `rankByRelevance`가 원문 필드로 점수를 매기므로 접혀서 걸린
 * 결과보다 앞에 온다 — `koreanSearchKey.test.ts`가 이 순서를 고정한다.
 */

const HANGUL_BASE = 0xac00;
const HANGUL_LAST = 0xd7a3;
const VOWEL_COUNT = 21;
const CODA_COUNT = 28;
const SYLLABLES_PER_ONSET = VOWEL_COUNT * CODA_COUNT;

/**
 * 초성 된소리 → 예사소리. 외래어 표기법은 파열음에 된소리를 쓰지 않지만(`서클`·`실스큐`)
 * 사용자는 발음대로 친다(`써클`·`씰스큐`).
 * 인덱스는 유니코드 초성 순서: ㄱ0 ㄲ1 ㄴ2 ㄷ3 ㄸ4 ㄹ5 ㅁ6 ㅂ7 ㅃ8 ㅅ9 ㅆ10 ㅇ11 ㅈ12 ㅉ13 …
 */
const ONSET_FOLD: ReadonlyMap<number, number> = new Map([
    [1, 0],
    [4, 3],
    [8, 7],
    [10, 9],
    [13, 12],
]);

/**
 * 현대 표준 발음에서 구별되지 않는 모음 → 대표 모음.
 * ㅐ1→ㅔ5, ㅒ3→ㅖ7, ㅙ10·ㅚ11→ㅞ15. (`캐피털`/`케피털`, `웨이브`/`왜이브`)
 */
const VOWEL_FOLD: ReadonlyMap<number, number> = new Map([
    [1, 5],
    [3, 7],
    [10, 15],
    [11, 15],
]);

function foldSyllable(char: string): string {
    const code = char.charCodeAt(0);
    if (code < HANGUL_BASE || code > HANGUL_LAST) return char;
    const offset = code - HANGUL_BASE;
    const onset = Math.floor(offset / SYLLABLES_PER_ONSET);
    const vowel = Math.floor((offset % SYLLABLES_PER_ONSET) / CODA_COUNT);
    const coda = offset % CODA_COUNT;
    return String.fromCharCode(
        HANGUL_BASE +
            (ONSET_FOLD.get(onset) ?? onset) * SYLLABLES_PER_ONSET +
            (VOWEL_FOLD.get(vowel) ?? vowel) * CODA_COUNT +
            coda
    );
}

const WHITESPACE_REGEX = /\s+/g;

/**
 * 검색 키: 소문자화 → 공백 제거 → 한글 음절의 된소리·모음 접기.
 * 질의와 저장명 양쪽에 같은 함수를 건다 — 한쪽만 접으면 아무것도 맞지 않는다.
 */
export function koreanSearchKey(value: string): string {
    return Array.from(value.toLowerCase().replace(WHITESPACE_REGEX, ''))
        .map(foldSyllable)
        .join('');
}

/** 영문 알파벳의 한국어 이름 — 국립국어원 표기 관용(`SK`=에스케이, `LG`=엘지). */
const LATIN_LETTER_READING: Readonly<Record<string, string>> = {
    a: '에이',
    b: '비',
    c: '씨',
    d: '디',
    e: '이',
    f: '에프',
    g: '지',
    h: '에이치',
    i: '아이',
    j: '제이',
    k: '케이',
    l: '엘',
    m: '엠',
    n: '엔',
    o: '오',
    p: '피',
    q: '큐',
    r: '알',
    s: '에스',
    t: '티',
    u: '유',
    v: '브이',
    w: '더블유',
    x: '엑스',
    y: '와이',
    z: '지',
};

const LATIN_LETTER_REGEX = /[a-z]/g;
const HAS_LATIN_REGEX = /[a-z]/i;

/**
 * 한글명에 섞인 영문 **약어**를 글자 이름으로 읽은 표기. 영문이 없으면 `null`.
 *
 * `SK하이닉스`를 `에스케이하이닉스`로, `LG에너지솔루션`을 `엘지에너지솔루션`으로 치는
 * 사용자를 위한 것이다. 한글명 안의 영문은 대개 약어(`SK`·`LG`·`IBM`·`AST`)라 글자
 * 단위로 읽는다 — 단어(`T-REX`)도 글자로 읽히지만 그런 표기를 치는 사용자는 없어 해가
 * 없다.
 */
export function spellLatinLetters(koreanName: string): string | null {
    if (!HAS_LATIN_REGEX.test(koreanName)) return null;
    return koreanName
        .toLowerCase()
        .replace(LATIN_LETTER_REGEX, letter => LATIN_LETTER_READING[letter]);
}
